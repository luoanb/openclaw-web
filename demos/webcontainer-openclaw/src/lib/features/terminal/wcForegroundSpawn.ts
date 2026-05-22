import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import type { Terminal } from "@xterm/xterm";
import type { TerminalLogBuffer, TerminalUiConfig } from "./xtermLogBuffer";

export function termDims(term: Terminal): { cols: number; rows: number } {
  return {
    cols: Math.max(term.cols, 40),
    rows: Math.max(term.rows, 12),
  };
}

async function drainProcessOutput(
  stream: ReadableStream<string>,
  onChunk: (text: string) => void,
): Promise<void> {
  const reader = stream.getReader();
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
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

/** PoC / npm 等一次性前台进程：与 xterm  stdin 转发、中止共用。 */
export type ForegroundSpawnRefs = {
  process: WebContainerProcess | null;
  stdinWriter: WritableStreamDefaultWriter<string> | null;
};

export async function runSpawnInForeground(
  wc: WebContainer,
  term: Terminal,
  ring: TerminalLogBuffer,
  cfg: TerminalUiConfig,
  refs: ForegroundSpawnRefs,
  command: string,
  args: string[],
  logIntro: string,
  spawnOpts?: { cwd?: string },
): Promise<number> {
  ring.writeCapped(term, logIntro, cfg);
  const proc = await wc.spawn(command, args, {
    terminal: termDims(term),
    ...(spawnOpts?.cwd ? { cwd: spawnOpts.cwd } : {}),
  });
  refs.process = proc;
  try {
    proc.resize(termDims(term));
  } catch {
    /* noop */
  }
  const writer = proc.input.getWriter();
  refs.stdinWriter = writer;
  let exitCode = -1;
  try {
    const [, code] = await Promise.all([
      drainProcessOutput(proc.output, (t) =>
        ring.writeCapped(term, t, cfg, { streamingForeground: true }),
      ),
      proc.exit,
    ]);
    exitCode = code;
  } finally {
    try {
      ring.compactToCap(term, cfg);
    } catch {
      /* noop */
    }
    refs.stdinWriter = null;
    try {
      await writer.close();
    } catch {
      /* noop */
    }
    try {
      writer.releaseLock();
    } catch {
      /* noop */
    }
    refs.process = null;
    ring.writeCapped(term, `\r\n[exit ${exitCode}]\r\n`, cfg);
  }
  return exitCode;
}

export function abortForegroundSpawn(refs: ForegroundSpawnRefs): void {
  try {
    void refs.stdinWriter?.write("\x03");
  } catch {
    /* noop */
  }
  try {
    refs.process?.kill();
  } catch {
    /* noop */
  }
}
