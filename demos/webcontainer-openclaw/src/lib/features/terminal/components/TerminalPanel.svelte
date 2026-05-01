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
  import Button from "$lib/ui/components/Button.svelte";
  import PanelFrame from "$lib/ui/components/PanelFrame.svelte";
  import { toast } from "$lib/ui/toast/toast.svelte";

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
  const lineBuf = { buf: "" };

  let busy = $state(false);
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
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: {
        background: "var(--xterm-bg)",
        foreground: "var(--xterm-fg)",
        cursor: "var(--xterm-cursor)",
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
        toast("已有命令运行中，请先「中止」后再输入新命令。", { variant: "warning" });
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
        toast("需要 crossOriginIsolated 环境才能执行命令。请通过本 demo 的 Vite dev/preview 访问并硬刷新。", {
          variant: "warning",
        });
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
      const msg = e instanceof Error ? e.message : String(e);
      toast(`执行失败：${msg}`, { variant: "error" });
      writeCapped(t, ring, `\r\n[错误] ${msg}\r\n`, cfg);
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
        toast("需要 crossOriginIsolated 环境才能运行一键 PoC。请通过本 demo 的 Vite dev/preview 访问并硬刷新。", {
          variant: "warning",
        });
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
        toast(`npm install 失败，详见 ${FEASIBILITY_PATH}`, { variant: "error" });
        writeCapped(t, ring, `\r\n[npm install 失败] 见 ${FEASIBILITY_PATH}\r\n`, cfg);
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
      const msg = e instanceof Error ? e.message : String(e);
      toast(`PoC 失败：${msg}`, { variant: "error" });
      writeCapped(t, ring, `\r\n[错误] ${msg}\r\n`, cfg);
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
</script>

<div class="mb-3 flex shrink-0 flex-wrap items-center gap-2">
  <Button variant="danger" disabled={!canAbort} title="中止当前子进程" onclick={onAbort}>
    中止
  </Button>
  <Button variant="secondary" disabled={!canRunPoc} onclick={() => void onPoc()}>一键 PoC</Button>
  <div class="flex flex-wrap gap-1.5" aria-label="预设命令">
    <Button variant="ghost" onclick={() => presetPaste("npx openclaw --help")}>openclaw --help</Button>
    <Button variant="ghost" onclick={() => presetPaste("npm run dev")}>npm run dev</Button>
    <Button variant="ghost" onclick={() => presetPaste("npx serve -l 3000")}>serve :3000</Button>
  </div>
</div>

<!-- svelte-ignore a11y_no_noninteractive_tabindex: xterm 宿主需可聚焦以承接键盘输入 -->
<PanelFrame class="min-h-48 flex-1 overflow-hidden p-0">
  <div
    bind:this={hostEl}
    class="h-full min-h-[12rem] outline-none tab-panel-focus"
    role="log"
    aria-live="polite"
    aria-label="终端"
    tabindex="0"
  ></div>
</PanelFrame>
