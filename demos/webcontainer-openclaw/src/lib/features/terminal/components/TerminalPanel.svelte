<script lang="ts">
  import { onMount } from "svelte";
  import type { WebContainer } from "@webcontainer/api";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { bootWebContainer, ensureWorkspace, FEASIBILITY_PATH } from "$lib/core/webcontainer/boot";
  import {
    abortCurrentShell,
    clearTerminal,
    createLogRing,
    createOutputReaderRef,
    createProcessRef,
    createStdinForwardRef,
    loadTerminalConfig,
    runShellLine,
    runSpawn,
    writeCapped,
    type LogRing,
    type ProcessRef,
    type StdinForwardRef,
  } from "$lib/features/terminal/terminal";
  import { cn } from "$lib/ui/utils/cn";

  type Props = {
    isolated: boolean;
    wirePreview: (wc: WebContainer) => void;
  };

  let { isolated, wirePreview }: Props = $props();

  let hostEl: HTMLDivElement | undefined = $state();
  let term: Terminal | undefined;
  let fit: FitAddon | undefined;
  let ro: ResizeObserver | undefined;

  const cfg = loadTerminalConfig();
  const ring: LogRing = createLogRing();
  const processRef: ProcessRef = createProcessRef();
  const stdinForwardRef: StdinForwardRef = createStdinForwardRef();
  const outputReaderRef = createOutputReaderRef();
  /** 与 xterm onData 共享的可变行缓冲（避免 $state 闭包陈旧） */
  const lineBuf = { buf: "" };

  let busy = $state(false);
  /** 供 xterm onData 闭包读取，与 busy 同步 */
  const busyGate = { current: false };
  $effect(() => {
    busyGate.current = busy;
  });

  let hasForegroundProcess = $state(false);

  function syncProcessState(): void {
    hasForegroundProcess = processRef.current != null;
  }

  let canAbort = $derived(hasForegroundProcess);
  let canRunPoc = $derived(isolated && !busy);

  onMount(() => {
    if (!hostEl) return;
    const t = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      disableStdin: false,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
      },
    });
    const fa = new FitAddon();
    t.loadAddon(fa);
    t.open(hostEl);
    ro = new ResizeObserver(() => {
      try {
        fa.fit();
      } catch {
        /* host may be 0-sized briefly */
      }
    });
    ro.observe(hostEl);
    requestAnimationFrame(() => {
      fa.fit();
      t.focus();
    });
    term = t;
    fit = fa;

    t.onData((data) => {
      if (stdinForwardRef.current) {
        stdinForwardRef.current.write(data).catch(() => {});
        return;
      }
      if (busyGate.current) {
        writeCapped(
          t,
          ring,
          "\r\n[提示] 已有命令运行中，请先「中止」后再输入新命令。\r\n",
          cfg,
        );
        return;
      }
      for (let i = 0; i < data.length; i++) {
        const c = data[i]!;
        if (c === "\r" || c === "\n") {
          const line = lineBuf.buf;
          lineBuf.buf = "";
          void executeShellLine(line);
          return;
        }
        if (c === "\x7f" || c === "\b") {
          if (lineBuf.buf.length > 0) {
            lineBuf.buf = lineBuf.buf.slice(0, -1);
            writeCapped(t, ring, "\b \b", cfg);
          }
          continue;
        }
        if (c >= " " || c === "\t") {
          lineBuf.buf += c;
          writeCapped(t, ring, c, cfg);
        }
      }
    });

    writeCapped(
      t,
      ring,
      "在此输入命令，Enter 以 sh -c 执行；运行中按键送往子进程 stdin。非真 PTY，部分 CLI 可能异常。详见仓库 terminal.config.json。\r\n",
      cfg,
    );

    return () => {
      ro?.disconnect();
      ro = undefined;
      t.dispose();
      term = undefined;
      fit = undefined;
    };
  });

  async function executeShellLine(rawLine: string): Promise<void> {
    const line = rawLine.trim();
    if (!line) return;
    const t = term;
    if (!t) return;
    if (busy || !isolated) {
      if (!isolated) {
        writeCapped(t, ring, "\r\n[中止] 需要 crossOriginIsolated。\r\n", cfg);
      }
      return;
    }
    busy = true;
    lineBuf.buf = "";
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      await ensureWorkspace(wc);
      await runShellLine(
        wc,
        line,
        t,
        ring,
        processRef,
        cfg,
        stdinForwardRef,
        syncProcessState,
        { noCommandEcho: true },
        outputReaderRef,
      );
    } catch (e) {
      writeCapped(
        t,
        ring,
        `\r\n[错误] ${e instanceof Error ? e.message : String(e)}\r\n`,
        cfg,
      );
    } finally {
      busy = false;
      syncProcessState();
      requestAnimationFrame(() => fit?.fit());
    }
  }

  function onAbort(): void {
    abortCurrentShell(processRef, {
      stdinRef: stdinForwardRef,
      outputReaderRef,
    });
    queueMicrotask(() => syncProcessState());
  }

  async function onPoc(): Promise<void> {
    const t = term;
    if (!t) return;
    if (busy || !isolated) {
      if (!isolated) {
        writeCapped(t, ring, "\r\n[中止] 需要 crossOriginIsolated。\r\n", cfg);
      }
      return;
    }
    busy = true;
    lineBuf.buf = "";
    clearTerminal(t, ring);
    writeCapped(t, ring, "WebContainer.boot() …\r\n", cfg);
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      writeCapped(t, ring, "已 boot。mount package.json …\r\n", cfg);
      await ensureWorkspace(wc);
      const installCode = await runSpawn(
        wc,
        t,
        ring,
        processRef,
        "npm",
        ["install"],
        "\r\n$ npm install\r\n",
        cfg,
        stdinForwardRef,
        syncProcessState,
        outputReaderRef,
      );
      if (installCode !== 0) {
        writeCapped(
          t,
          ring,
          `\r\n[npm install 失败] 见 ${FEASIBILITY_PATH}\r\n`,
          cfg,
        );
        return;
      }
      await runSpawn(
        wc,
        t,
        ring,
        processRef,
        "npx",
        ["openclaw", "--help"],
        "\r\n$ npx openclaw --help\r\n",
        cfg,
        stdinForwardRef,
        syncProcessState,
        outputReaderRef,
      );
      writeCapped(
        t,
        ring,
        "\r\n[PoC 完成] CLI 可加载不代表完整 gateway；见可行性文档。\r\n",
        cfg,
      );
    } catch (e) {
      writeCapped(
        t,
        ring,
        `\r\n[错误] ${e instanceof Error ? e.message : String(e)}\r\n`,
        cfg,
      );
    } finally {
      busy = false;
      syncProcessState();
      requestAnimationFrame(() => fit?.fit());
    }
  }

  function presetPaste(text: string): void {
    term?.focus();
    term?.paste(text);
  }

  const btnSecondary = cn(
    "rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]",
    "hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50",
  );
  const btnDanger = cn(
    "rounded-lg border border-transparent bg-[var(--danger)] px-3 py-2 text-xs font-medium text-white",
    "hover:bg-[var(--danger-hover)] disabled:cursor-not-allowed disabled:opacity-50",
  );
  const btnGhost = cn(
    "rounded-md border border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)]",
    "hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
  );
</script>

<div class="mb-2 flex shrink-0 flex-wrap items-center gap-2">
  <button type="button" class={btnDanger} disabled={!canAbort} title="中止当前子进程" onclick={onAbort}>
    中止
  </button>
  <button type="button" class={btnSecondary} disabled={!canRunPoc} onclick={() => void onPoc()}>
    一键 PoC
  </button>
  <div class="flex flex-wrap gap-1.5" aria-label="预设命令">
    <button type="button" class={btnGhost} onclick={() => presetPaste("npx openclaw --help")}>
      openclaw --help
    </button>
    <button type="button" class={btnGhost} onclick={() => presetPaste("npm run dev")}>
      npm run dev
    </button>
    <button type="button" class={btnGhost} onclick={() => presetPaste("npx serve -l 3000")}>
      serve :3000
    </button>
  </div>
</div>

<!-- svelte-ignore a11y_no_noninteractive_tabindex: xterm 宿主需可聚焦以承接键盘输入 -->
<div
  bind:this={hostEl}
  class="min-h-48 flex-1 overflow-hidden rounded-lg border border-[var(--border-subtle)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
  role="log"
  aria-live="polite"
  aria-label="终端"
  tabindex="0"
></div>
