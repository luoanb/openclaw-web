<script lang="ts">
  import { onMount } from "svelte";
  import type { WebContainer } from "@webcontainer/api";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import {
    bootWebContainer,
    ensureWorkspace,
    FEASIBILITY_PATH,
  } from "$lib/core/webcontainer/boot";
  import WorkspaceFilesDialog from "$lib/features/terminal/components/WorkspaceFilesDialog.svelte";
  import {
    OutputReaderRef,
    StdinForwardRef,
    TerminalConfigLoader,
    TerminalCwdPrompt,
    TerminalLogBuffer,
    WebContainerProcessRef,
    WebContainerShellRunner,
    type TerminalConfig,
  } from "$lib/core/terminal";
  import Button from "$lib/ui/components/Button.svelte";
  import PanelFrame from "$lib/ui/components/PanelFrame.svelte";
  import { toast } from "$lib/ui/toast/toast.svelte";

  type Props = {
    isolated: boolean;
    wirePreview: (wc: WebContainer) => void;
    /** 为 false 时面板隐藏（多标签切换后用于触发 fit） */
    visible?: boolean;
  };

  let { isolated, wirePreview, visible = true }: Props = $props();

  let hostEl: HTMLDivElement | undefined = $state();
  let term: Terminal | undefined;
  let fit: FitAddon | undefined;
  let ro: ResizeObserver | undefined;

  const cfg: TerminalConfig = TerminalConfigLoader.load();
  const logBuffer = new TerminalLogBuffer();
  const processRef = new WebContainerProcessRef();
  const stdinForwardRef = new StdinForwardRef();
  const outputReaderRef = new OutputReaderRef();
  const lineBuf = { buf: "" };

  let busy = $state(false);
  const busyGate = { current: false };
  $effect(() => {
    busyGate.current = busy;
  });

  let hasForegroundProcess = $state(false);
  /** WebContainer `workdir` 绝对路径；首屏前为空串 */
  let sessionWorkdir = $state("");

  /** 相对 `workdir` 的会话 cwd */
  let cwdRel = $state("");

  function syncProcessState(): void {
    hasForegroundProcess = processRef.current != null;
  }

  let canAbort = $derived(hasForegroundProcess);
  let canRunPoc = $derived(isolated && !busy);

  let filesDialogOpen = $state(false);

  function promptLine(): string {
    return TerminalCwdPrompt.formatPromptLine(sessionWorkdir, cwdRel);
  }

  function writeInputPrompt(t: Terminal): void {
    logBuffer.writeCapped(t, `\r\n${promptLine()}`, cfg);
  }

  $effect(() => {
    if (!visible) return;
    const f = fit;
    const te = term;
    if (!f || !te) return;
    requestAnimationFrame(() => {
      try {
        f.fit();
      } catch {
        /* host may be 0-sized briefly */
      }
      te.focus();
    });
  });

  onMount(() => {
    if (!hostEl) return;
    const t = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      disableStdin: false,
      fontSize: 14,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
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
      logBuffer.writeCapped(t, promptLine(), cfg);
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
        toast("已有命令运行中，请先「中止」后再输入新命令。", {
          variant: "warning",
        });
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
            logBuffer.writeCapped(t, "\b \b", cfg);
          }
          continue;
        }
        if (c >= " " || c === "\t") {
          lineBuf.buf += c;
          logBuffer.writeCapped(t, c, cfg);
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

  async function ensureWorkdir(wc: WebContainer): Promise<void> {
    if (!sessionWorkdir) {
      sessionWorkdir = wc.workdir;
    }
  }

  /**
   * 与一键 PoC 相同的 `npm install` + `npx openclaw --help`（不含 boot / mount）。
   * @returns install 与后续命令是否顺利完成（npm 非 0 时为 false，并已 Toast）。
   */
  async function runNpmInstallAndOpenClawHelp(
    wc: WebContainer
  ): Promise<boolean> {
    const t = term;
    if (!t) return false;
    const spawnCwd = cwdRel.trim() ? { cwd: cwdRel.trim() } : undefined;
    const installCode = await WebContainerShellRunner.runSpawn(
      wc,
      t,
      logBuffer,
      processRef,
      "npm",
      ["install"],
      "\r\n$ npm install\r\n",
      cfg,
      stdinForwardRef,
      syncProcessState,
      outputReaderRef,
      spawnCwd
    );
    if (installCode !== 0) {
      toast(`npm install 失败，详见 ${FEASIBILITY_PATH}`, { variant: "error" });
      logBuffer.writeCapped(
        t,
        `\r\n[npm install 失败] 见 ${FEASIBILITY_PATH}\r\n`,
        cfg
      );
      return false;
    }
    await WebContainerShellRunner.runSpawn(
      wc,
      t,
      logBuffer,
      processRef,
      "npx",
      ["openclaw", "--help"],
      "\r\n$ npx openclaw --help\r\n",
      cfg,
      stdinForwardRef,
      syncProcessState,
      outputReaderRef,
      spawnCwd
    );
    return true;
  }

  /** 快照导入后：重装依赖并跑 openclaw --help（与 PoC 节后一致）。 */
  async function restartProjectAfterImport(wc: WebContainer): Promise<void> {
    const t = term;
    if (!t) return;
    busy = true;
    try {
      await ensureWorkdir(wc);
      const ok = await runNpmInstallAndOpenClawHelp(wc);
      if (ok) {
        toast("导入完成：依赖已重装。", { variant: "success" });
        logBuffer.writeCapped(
          t,
          "\r\n[导入完成] 工作区已从快照恢复并完成 npm install / openclaw --help。\r\n",
          cfg
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`重装步骤失败：${msg}`, { variant: "error" });
      logBuffer.writeCapped(t, `\r\n[错误] ${msg}\r\n`, cfg);
    } finally {
      busy = false;
      syncProcessState();
      writeInputPrompt(t);
      requestAnimationFrame(() => fit?.fit());
    }
  }

  async function executeShellLine(rawLine: string): Promise<void> {
    const t = term;
    if (!t) return;
    const trimmed = rawLine.trim();
    if (!trimmed) {
      writeInputPrompt(t);
      return;
    }
    if (busy || !isolated) {
      if (!isolated) {
        toast(
          "需要 crossOriginIsolated 环境才能执行命令。请通过本 demo 的 Vite dev/preview 访问并硬刷新。",
          {
            variant: "warning",
          }
        );
      }
      return;
    }
    busy = true;
    lineBuf.buf = "";
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      await ensureWorkspace(wc);
      await ensureWorkdir(wc);
      const shellOpts = { noCommandEcho: true, cwd: cwdRel || undefined };
      const { code } = await WebContainerShellRunner.runShellLine(
        wc,
        trimmed,
        t,
        logBuffer,
        processRef,
        cfg,
        stdinForwardRef,
        syncProcessState,
        shellOpts,
        outputReaderRef
      );
      if (code === 0 && TerminalCwdPrompt.isCdOnlyLine(trimmed)) {
        cwdRel = TerminalCwdPrompt.resolveCdArg(
          cwdRel,
          TerminalCwdPrompt.cdArgFromLine(trimmed)
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`执行失败：${msg}`, { variant: "error" });
      logBuffer.writeCapped(t, `\r\n[错误] ${msg}\r\n`, cfg);
    } finally {
      busy = false;
      syncProcessState();
      writeInputPrompt(t);
      requestAnimationFrame(() => fit?.fit());
    }
  }

  function onAbort(): void {
    WebContainerShellRunner.abortCurrentShell(processRef, {
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
        toast(
          "需要 crossOriginIsolated 环境才能运行一键 PoC。请通过本 demo 的 Vite dev/preview 访问并硬刷新。",
          {
            variant: "warning",
          }
        );
      }
      return;
    }
    busy = true;
    lineBuf.buf = "";
    logBuffer.clear(t);
    logBuffer.writeCapped(t, "WebContainer.boot() …\r\n", cfg);
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      logBuffer.writeCapped(t, "已 boot。mount package.json …\r\n", cfg);
      await ensureWorkspace(wc);
      await ensureWorkdir(wc);
      const ok = await runNpmInstallAndOpenClawHelp(wc);
      if (!ok) return;
      logBuffer.writeCapped(
        t,
        "\r\n[PoC 完成] CLI 可加载不代表完整 gateway；见可行性文档。\r\n",
        cfg
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`PoC 失败：${msg}`, { variant: "error" });
      logBuffer.writeCapped(t, `\r\n[错误] ${msg}\r\n`, cfg);
    } finally {
      busy = false;
      syncProcessState();
      writeInputPrompt(t);
      requestAnimationFrame(() => fit?.fit());
    }
  }
</script>

<div class="mb-3 flex shrink-0 flex-wrap items-center gap-2">
  <Button
    variant="danger"
    disabled={!canAbort}
    title="中止当前子进程"
    onclick={onAbort}
  >
    中止
  </Button>
  <Button variant="secondary" disabled={!canRunPoc} onclick={() => void onPoc()}
    >Claw初始化</Button
  >
  <Button
    variant="secondary"
    title="工作区导出 / 导入"
    onclick={() => (filesDialogOpen = true)}
  >
    文件
  </Button>
</div>

<WorkspaceFilesDialog
  bind:open={filesDialogOpen}
  {isolated}
  {busy}
  {wirePreview}
  {restartProjectAfterImport}
/>

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
