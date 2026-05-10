<script lang="ts">
  import { onMount } from "svelte";
  import type { WebContainer } from "@webcontainer/api";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { webOsRuntime, FEASIBILITY_PATH, ShellSession } from "web-os";
  import WorkspaceFilesDialog from "$lib/features/terminal/components/WorkspaceFilesDialog.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import PanelFrame from "$lib/ui/components/PanelFrame.svelte";
  import { toast } from "$lib/ui/toast/toast.svelte";
  import {
    DEFAULT_TERMINAL_UI_CONFIG,
    TerminalLogBuffer,
    type TerminalUiConfig,
  } from "$lib/features/terminal/xtermLogBuffer";
  import {
    abortForegroundSpawn,
    runSpawnInForeground,
    termDims,
    type ForegroundSpawnRefs,
  } from "$lib/features/terminal/wcForegroundSpawn";

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

  const cfg: TerminalUiConfig = DEFAULT_TERMINAL_UI_CONFIG;
  const ring = new TerminalLogBuffer();
  const foregroundRefs: ForegroundSpawnRefs = {
    process: null,
    stdinWriter: null,
  };

  let shellSession: ShellSession | undefined;
  let wcCached: WebContainer | undefined;
  let shellUnsubs: (() => void)[] = [];
  let resizeDisposable: { dispose: () => void } | undefined;
  let mounted = false;

  /** 供 UI 响应：`ShellSession.state` 非响应式。 */
  let shellRunningFlag = $state(false);
  /** 前台 `npm`/`npx` 等一次性 spawn 期间为 true。 */
  let foregroundSpawnActive = $state(false);

  let busy = $state(false);

  let canAbort = $derived(
    isolated && (foregroundSpawnActive || shellRunningFlag),
  );
  let canRunPoc = $derived(isolated && !busy);

  let filesDialogOpen = $state(false);

  function clearShellSubscriptions(): void {
    for (const u of shellUnsubs) u();
    shellUnsubs = [];
  }

  async function stopInteractiveShell(): Promise<void> {
    shellRunningFlag = false;
    clearShellSubscriptions();
    if (shellSession) {
      await shellSession.dispose();
      shellSession = undefined;
    }
  }

  async function startInteractiveShell(wc: WebContainer): Promise<void> {
    const t = term;
    if (!t) return;
    await stopInteractiveShell();
    const session = new ShellSession(wc, { terminal: termDims(t) });
    shellSession = session;

    shellUnsubs.push(
      session.onOutput((chunk) => {
        ring.writeCapped(t, chunk, cfg, { streamingForeground: true });
      }),
    );

    shellUnsubs.push(
      session.onExit((info) => {
        try {
          ring.compactToCap(t, cfg);
        } catch {
          /* term disposed */
        }
        if (!mounted || !wcCached) return;
        ring.writeCapped(
          t,
          `\r\n[jsh 退出，码 ${info.code}] 正在重新启动交互 shell…\r\n`,
          cfg,
        );
        void startInteractiveShell(wcCached);
      }),
    );

    await session.start();
    const { cols, rows } = termDims(t);
    session.resize(cols, rows);
    shellRunningFlag = true;
  }

  async function runForegroundSpawn(
    wc: WebContainer,
    command: string,
    args: string[],
    logIntro: string,
    spawnOpts?: { cwd?: string },
  ): Promise<number> {
    const t = term;
    if (!t) return -1;
    foregroundSpawnActive = true;
    try {
      return await runSpawnInForeground(
        wc,
        t,
        ring,
        cfg,
        foregroundRefs,
        command,
        args,
        logIntro,
        spawnOpts,
      );
    } finally {
      foregroundSpawnActive = false;
    }
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
      const { cols, rows } = termDims(te);
      shellSession?.resize(cols, rows);
      try {
        foregroundRefs.process?.resize({ cols, rows });
      } catch {
        /* noop */
      }
    });
  });

  onMount(() => {
    if (!hostEl) return;
    mounted = true;
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

    resizeDisposable = t.onResize(({ cols, rows }) => {
      const c = Math.max(cols, 40);
      const r = Math.max(rows, 12);
      requestAnimationFrame(() => {
        shellSession?.resize(c, r);
        try {
          foregroundRefs.process?.resize({ cols: c, rows: r });
        } catch {
          /* noop */
        }
      });
    });

    t.onData((data) => {
      if (foregroundRefs.stdinWriter) {
        void foregroundRefs.stdinWriter.write(data).catch(() => {});
        return;
      }
      if (shellSession?.state === "running") {
        void shellSession.write(data).catch(() => {});
        return;
      }
      if (busy) {
        toast("请等待当前操作完成后再输入。", { variant: "warning" });
      }
    });

    requestAnimationFrame(() => {
      fa.fit();
      t.focus();
    });
    term = t;
    fit = fa;

    if (isolated) {
      void (async () => {
        busy = true;
        try {
          ring.writeCapped(t, "WebContainer 启动中…\r\n", cfg);
          const wc = await webOsRuntime.start();
          wirePreview(wc);
          wcCached = wc;
          await startInteractiveShell(wc);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          toast(`终端启动失败：${msg}`, { variant: "error" });
          ring.writeCapped(t, `\r\n[错误] ${msg}\r\n`, cfg);
        } finally {
          busy = false;
          requestAnimationFrame(() => fa.fit());
        }
      })();
    } else {
      ring.writeCapped(
        t,
        "需要 crossOriginIsolated 才能运行 WebContainer。请通过本 demo 的 Vite dev/preview 访问并硬刷新。\r\n",
        cfg,
      );
    }

    return () => {
      mounted = false;
      void stopInteractiveShell();
      resizeDisposable?.dispose();
      resizeDisposable = undefined;
      ro?.disconnect();
      ro = undefined;
      t.dispose();
      term = undefined;
      fit = undefined;
      wcCached = undefined;
    };
  });

  async function runNpmInstallAndOpenClawHelp(
    wc: WebContainer,
  ): Promise<boolean> {
    const t = term;
    if (!t) return false;
    const installCode = await runForegroundSpawn(
      wc,
      "npm",
      ["install"],
      "\r\n$ npm install\r\n",
    );
    if (installCode !== 0) {
      toast(`npm install 失败，详见 ${FEASIBILITY_PATH}`, { variant: "error" });
      ring.writeCapped(
        t,
        `\r\n[npm install 失败] 见 ${FEASIBILITY_PATH}\r\n`,
        cfg,
      );
      return false;
    }
    await runForegroundSpawn(
      wc,
      "npx",
      ["openclaw", "--help"],
      "\r\n$ npx openclaw --help\r\n",
    );
    return true;
  }

  /** 快照导入后：重装依赖并跑 openclaw --help（与 PoC 节后一致）。 */
  async function restartProjectAfterImport(wc: WebContainer): Promise<void> {
    const t = term;
    if (!t) return;
    busy = true;
    try {
      await stopInteractiveShell();
      wcCached = wc;
      const ok = await runNpmInstallAndOpenClawHelp(wc);
      if (ok) {
        toast("导入完成：依赖已重装。", { variant: "success" });
        ring.writeCapped(
          t,
          "\r\n[导入完成] 工作区已从快照恢复并完成 npm install / openclaw --help。\r\n",
          cfg,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`重装步骤失败：${msg}`, { variant: "error" });
      ring.writeCapped(t, `\r\n[错误] ${msg}\r\n`, cfg);
    } finally {
      busy = false;
      await startInteractiveShell(wc);
      requestAnimationFrame(() => fit?.fit());
    }
  }

  function onAbort(): void {
    abortForegroundSpawn(foregroundRefs);
    void shellSession?.write("\x03").catch(() => {});
  }

  async function onPoc(): Promise<void> {
    const t = term;
    if (!t) return;
    if (busy || !isolated) {
      if (!isolated) {
        toast(
          "需要 crossOriginIsolated 环境才能运行一键 PoC。请通过本 demo 的 Vite dev/preview 访问并硬刷新。",
          { variant: "warning" },
        );
      }
      return;
    }
    busy = true;
    try {
      await stopInteractiveShell();
      ring.clear(t);
      ring.writeCapped(t, "WebContainer.boot() …\r\n", cfg);
      const wc = await webOsRuntime.start();
      wirePreview(wc);
      wcCached = wc;
      ring.writeCapped(t, "已启动。mount 工作区 …\r\n", cfg);
      const ok = await runNpmInstallAndOpenClawHelp(wc);
      if (!ok) return;
      ring.writeCapped(
        t,
        "\r\n[PoC 完成] CLI 可加载不代表完整 gateway；见可行性文档。\r\n",
        cfg,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`PoC 失败：${msg}`, { variant: "error" });
      ring.writeCapped(t, `\r\n[错误] ${msg}\r\n`, cfg);
    } finally {
      busy = false;
      if (wcCached) await startInteractiveShell(wcCached);
      requestAnimationFrame(() => fit?.fit());
    }
  }
</script>

<div class="mb-3 flex shrink-0 flex-wrap items-center gap-2">
  <Button
    variant="danger"
    disabled={!canAbort}
    title="中止前台命令或向 shell 发送 Ctrl+C"
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
