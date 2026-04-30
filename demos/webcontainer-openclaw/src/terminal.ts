import type { Terminal } from "@xterm/xterm";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import rawConfig from "../terminal.config.json";

/** 与 `terminal.config.json` 字段一致；缺失项由默认值补齐 */
export type TerminalConfig = {
  logMaxBytes: number;
  logMaxLines: number;
  maxCmdLen: number;
  truncateStrategy: "drop-head";
  truncateMarker: string;
};

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  logMaxBytes: 409600,
  logMaxLines: 2000,
  maxCmdLen: 8192,
  truncateStrategy: "drop-head",
  truncateMarker: "\r\n[… 日志已截断 …]\r\n",
};

export function loadTerminalConfig(): TerminalConfig {
  const u = rawConfig as Partial<TerminalConfig>;
  return {
    ...DEFAULT_TERMINAL_CONFIG,
    ...u,
    truncateStrategy: "drop-head",
  };
}

export type LogRing = { buf: string };

export function createLogRing(): LogRing {
  return { buf: "" };
}

export function clearTerminal(term: Terminal, ring: LogRing): void {
  ring.buf = "";
  term.clear();
}

function applyLineCap(s: string, maxLines: number, marker: string): string {
  const lines = s.split(/\r?\n/);
  if (lines.length <= maxLines) return s;
  return marker + lines.slice(-maxLines).join("\n");
}

/**
 * 将 chunk 写入缓冲并按配置截断（字节 + 行数上限）。
 */
export function writeCapped(
  term: Terminal,
  ring: LogRing,
  chunk: string,
  cfg: TerminalConfig,
): void {
  ring.buf += chunk;
  let out = ring.buf;
  const marker = cfg.truncateMarker;
  if (out.length > cfg.logMaxBytes) {
    const keep = cfg.logMaxBytes - marker.length;
    out = marker + out.slice(-keep);
  }
  out = applyLineCap(out, cfg.logMaxLines, marker);
  if (out !== ring.buf) {
    ring.buf = out;
    term.clear();
    term.write(out);
    return;
  }
  term.write(chunk);
}

export type ProcessRef = { current: WebContainerProcess | null };

export function createProcessRef(): ProcessRef {
  return { current: null };
}

export type StdinForwardRef = {
  current: ReturnType<WritableStream<string>["getWriter"]> | null;
};

export function createStdinForwardRef(): StdinForwardRef {
  return { current: null };
}

export type CurrentOutputReader = {
  current: ReadableStreamDefaultReader<string> | null;
};

export function createOutputReaderRef(): CurrentOutputReader {
  return { current: null };
}

/**
 * 先尝试与 PTY/Node 上常见行为一致：发 Ctrl-C，并取消读侧 pump，再 kill 进程。
 * 单用 kill 在部分子进程/管道场景下可长时间不落盘、UI 不回收。
 */
export function abortCurrentShell(
  processRef: ProcessRef,
  opts?: { stdinRef?: StdinForwardRef; outputReaderRef?: CurrentOutputReader },
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

export async function drainProcessOutput(
  stream: ReadableStream<string>,
  onChunk: (text: string) => void,
  outReaderRef?: CurrentOutputReader,
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

function termDims(term: Terminal): { cols: number; rows: number } {
  return {
    cols: Math.max(term.cols, 40),
    rows: Math.max(term.rows, 12),
  };
}

/**
 * 统一 spawn + 输出泵 + 退出码；运行期间将 `stdinForwardRef` 指向 `proc.input` 的 writer，供 xterm onData 转发。
 */
export async function runSpawn(
  wc: WebContainer,
  term: Terminal,
  ring: LogRing,
  processRef: ProcessRef,
  command: string,
  args: string[],
  logIntro: string,
  cfg: TerminalConfig,
  stdinForwardRef: StdinForwardRef,
  onProcessStarted?: () => void,
  outputReaderRef?: CurrentOutputReader,
): Promise<number> {
  writeCapped(term, ring, logIntro, cfg);
  const proc = await wc.spawn(command, args, { terminal: termDims(term) });
  processRef.current = proc;
  const writer = proc.input.getWriter();
  stdinForwardRef.current = writer;
  onProcessStarted?.();
  try {
    const [, code] = await Promise.all([
      drainProcessOutput(
        proc.output,
        (t) => writeCapped(term, ring, t, cfg),
        outputReaderRef,
      ),
      proc.exit,
    ]);
    writeCapped(term, ring, `\r\n[exit ${code}]\r\n`, cfg);
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

export type RunShellLineOptions = {
  /** 与 TerminalPanel 本地行回显为 true 时不再打印 `$ cmd`，避免重复一行 */
  noCommandEcho?: boolean;
};

export async function runShellLine(
  wc: WebContainer,
  line: string,
  term: Terminal,
  ring: LogRing,
  processRef: ProcessRef,
  cfg: TerminalConfig,
  stdinForwardRef: StdinForwardRef,
  onProcessStarted?: () => void,
  options?: RunShellLineOptions,
  outputReaderRef?: CurrentOutputReader,
): Promise<{ code: number }> {
  const trimmed = line.trim();
  if (!trimmed) {
    return { code: 0 };
  }
  if (trimmed.length > cfg.maxCmdLen) {
    writeCapped(
      term,
      ring,
      `\r\n[错误] 命令长度超过 ${cfg.maxCmdLen}，已拒绝执行。\r\n`,
      cfg,
    );
    return { code: 1 };
  }
  const logIntro = options?.noCommandEcho
    ? "\r\n"
    : `\r\n$ ${trimmed}\r\n`;
  const code = await runSpawn(
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
  );
  return { code };
}
