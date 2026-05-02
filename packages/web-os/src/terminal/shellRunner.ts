import type { Terminal } from "@xterm/xterm";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import type { TerminalConfig } from "./config";
import { TerminalLogBuffer } from "./logBuffer";
import type { OutputReaderRef, StdinForwardRef } from "./refs";
import { WebContainerProcessRef } from "./refs";

type ProcessRefLike = { current: WebContainerProcess | null };

export class WebContainerShellRunner {
  /**
   * 先尝试与 PTY/Node 上常见行为一致：发 Ctrl-C，并取消读侧 pump，再 kill 进程。
   */
  static abortCurrentShell(
    processRef: ProcessRefLike,
    opts?: { stdinRef?: StdinForwardRef; outputReaderRef?: OutputReaderRef },
  ): void {
    try {
      void opts?.outputReaderRef?.current?.cancel("aborted");
    } catch {
      /* noop */
    }
    const w = opts?.stdinRef?.current;
    if (w) {
      try {
        void w.write("\x03");
      } catch {
        /* 已关 writer 等 */
      }
    }
    processRef.current?.kill();
  }

  /**
   * 统一 spawn + 输出泵 + 退出码；运行期间将 `stdinForwardRef` 指向 `proc.input` 的 writer，供 xterm onData 转发。
   */
  static async runSpawn(
    wc: WebContainer,
    term: Terminal,
    ring: TerminalLogBuffer,
    processRef: WebContainerProcessRef,
    command: string,
    args: string[],
    logIntro: string,
    cfg: TerminalConfig,
    stdinForwardRef: StdinForwardRef,
    onProcessStarted?: () => void,
    outputReaderRef?: OutputReaderRef,
    spawnExtra?: SpawnExtraOptions,
  ): Promise<number> {
    ring.writeCapped(term, logIntro, cfg);
    const cwd = spawnExtra?.cwd?.trim();
    const proc = await wc.spawn(command, args, {
      terminal: WebContainerShellRunner.termDims(term),
      ...(cwd ? { cwd } : {}),
    });
    processRef.current = proc;
    const writer = proc.input.getWriter();
    stdinForwardRef.current = writer;
    onProcessStarted?.();
    try {
      const [, code] = await Promise.all([
        WebContainerShellRunner.drainProcessOutput(
          proc.output,
          (t) => ring.writeCapped(term, t, cfg),
          outputReaderRef,
        ),
        proc.exit,
      ]);
      ring.writeCapped(term, `\r\n[exit ${code}]\r\n`, cfg);
      return code;
    } finally {
      stdinForwardRef.current = null;
      try {
        await writer.close();
      } catch {
        /* 子进程已关闭 stdin 时可能失败 */
      }
      try {
        writer.releaseLock();
      } catch {
        /* noop */
      }
      processRef.current = null;
    }
  }

  static async runShellLine(
    wc: WebContainer,
    line: string,
    term: Terminal,
    ring: TerminalLogBuffer,
    processRef: WebContainerProcessRef,
    cfg: TerminalConfig,
    stdinForwardRef: StdinForwardRef,
    onProcessStarted?: () => void,
    options?: RunShellLineOptions,
    outputReaderRef?: OutputReaderRef,
  ): Promise<{ code: number }> {
    const trimmed = line.trim();
    if (!trimmed) {
      return { code: 0 };
    }
    if (trimmed.length > cfg.maxCmdLen) {
      ring.writeCapped(
        term,
        `\r\n[错误] 命令长度超过 ${cfg.maxCmdLen}，已拒绝执行。\r\n`,
        cfg,
      );
      return { code: 1 };
    }
    const logIntro = options?.noCommandEcho
      ? "\r\n"
      : `\r\n$ ${trimmed}\r\n`;
    const spawnExtra: SpawnExtraOptions | undefined =
      options?.cwd != null && String(options.cwd).trim() !== ""
        ? { cwd: String(options.cwd).trim() }
        : undefined;

    const code = await WebContainerShellRunner.runSpawn(
      wc,
      term,
      ring,
      processRef,
      "sh",
      ["-c", trimmed],
      logIntro,
      cfg,
      stdinForwardRef,
      onProcessStarted,
      outputReaderRef,
      spawnExtra,
    );
    return { code };
  }

  private static termDims(term: Terminal): { cols: number; rows: number } {
    return {
      cols: Math.max(term.cols, 40),
      rows: Math.max(term.rows, 12),
    };
  }

  private static async drainProcessOutput(
    stream: ReadableStream<string>,
    onChunk: (text: string) => void,
    outReaderRef?: OutputReaderRef,
  ): Promise<void> {
    const reader = stream.getReader();
    if (outReaderRef) outReaderRef.current = reader;
    try {
      for (;;) {
        let res: ReadableStreamReadResult<string>;
        try {
          res = await reader.read();
        } catch {
          break;
        }
        if (res.done) break;
        if (res.value) onChunk(res.value);
      }
    } finally {
      if (outReaderRef) outReaderRef.current = null;
      try {
        reader.releaseLock();
      } catch {
        /* noop */
      }
    }
  }
}

/** 相对 WebContainer `workdir`；省略或空串表示默认 workdir */
export type SpawnExtraOptions = {
  cwd?: string;
};

export type RunShellLineOptions = {
  /** 与 TerminalPanel 本地行回显为 true 时不再打印 `$ cmd`，避免重复一行 */
  noCommandEcho?: boolean;
  /** 相对 WebContainer `workdir`；省略或空串表示默认 workdir */
  cwd?: string;
};
