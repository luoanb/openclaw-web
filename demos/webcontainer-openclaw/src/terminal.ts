import type { Terminal } from "@xterm/xterm";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";

/** 单行 shell 输入上限（与 Spec §3 Q1 一致） */
export const MAX_CMD_LEN = 8192;

/** 终端环形缓冲上限（Spec §3 Q5：约 400KB 文本） */
export const LOG_CAP_BYTES = 400 * 1024;

const TRUNCATE_MARKER = "\r\n[… 日志已截断 …]\r\n";

export type LogRing = { buf: string };

export function createLogRing(): LogRing {
  return { buf: "" };
}

/** 清空环形缓冲并清空 xterm 视口（一键 PoC 等场景） */
export function clearTerminal(term: Terminal, ring: LogRing): void {
  ring.buf = "";
  term.clear();
}

/**
 * 将 chunk 写入缓冲并按上限截断；超限时整屏重绘尾部。
 */
export function writeCapped(term: Terminal, ring: LogRing, chunk: string): void {
  ring.buf += chunk;
  if (ring.buf.length <= LOG_CAP_BYTES) {
    term.write(chunk);
    return;
  }
  const keep = LOG_CAP_BYTES - TRUNCATE_MARKER.length;
  ring.buf = TRUNCATE_MARKER + ring.buf.slice(-keep);
  term.clear();
  term.write(ring.buf);
}

export async function drainProcessOutput(
  stream: ReadableStream<string>,
  onChunk: (text: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) onChunk(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export type ProcessRef = { current: WebContainerProcess | null };

export function createProcessRef(): ProcessRef {
  return { current: null };
}

export function abortCurrentShell(ref: ProcessRef): void {
  ref.current?.kill();
}

function termDims(term: Terminal): { cols: number; rows: number } {
  return {
    cols: Math.max(term.cols, 40),
    rows: Math.max(term.rows, 12),
  };
}

/**
 * 统一 spawn + 输出泵 + 退出码行；用于 PoC 与用户命令。
 */
export async function runSpawn(
  wc: WebContainer,
  term: Terminal,
  ring: LogRing,
  processRef: ProcessRef,
  command: string,
  args: string[],
  echoLine: string,
  onProcessStarted?: () => void,
): Promise<number> {
  writeCapped(term, ring, `\r\n${echoLine}\r\n`);
  const proc = await wc.spawn(command, args, { terminal: termDims(term) });
  processRef.current = proc;
  onProcessStarted?.();
  try {
    const [, code] = await Promise.all([
      drainProcessOutput(proc.output, (t) => writeCapped(term, ring, t)),
      proc.exit,
    ]);
    writeCapped(term, ring, `\r\n[exit ${code}]\r\n`);
    return code;
  } finally {
    processRef.current = null;
  }
}

/**
 * `wc.spawn("sh", ["-c", line])`；M1 无交互 stdin，仅合并 stdout/stderr。
 */
export async function runShellLine(
  wc: WebContainer,
  line: string,
  term: Terminal,
  ring: LogRing,
  processRef: ProcessRef,
  onProcessStarted?: () => void,
): Promise<{ code: number }> {
  const trimmed = line.trim();
  if (!trimmed) {
    return { code: 0 };
  }
  if (trimmed.length > MAX_CMD_LEN) {
    writeCapped(
      term,
      ring,
      `\r\n[错误] 命令长度超过 ${MAX_CMD_LEN}，已拒绝执行。\r\n`,
    );
    return { code: 1 };
  }
  const code = await runSpawn(
    wc,
    term,
    ring,
    processRef,
    "sh",
    ["-c", trimmed],
    `$ ${trimmed}`,
    onProcessStarted,
  );
  return { code };
}
