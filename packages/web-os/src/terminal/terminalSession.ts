import type { Terminal } from "@xterm/xterm";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import type { TerminalConfig } from "./config.contracts";
import type {
  IWebContainerTerminalSession,
  RunShellLineOptions,
  SpawnExtraOptions,
  WebContainerTerminalSessionOptions,
  WebContainerTerminalSessionSpawnOptions,
} from "./terminalSession.contracts";
import { TerminalLogBuffer } from "./logBuffer";
import {
  OutputReaderRef,
  StdinForwardRef,
  WebContainerProcessRef,
} from "./refs";
import { terminalCwdPrompt } from "./cwdPrompt";

type ProcessRefLike = { current: WebContainerProcess | null };

function termDims(term: Terminal): { cols: number; rows: number } {
  return {
    cols: Math.max(term.cols, 40),
    rows: Math.max(term.rows, 12),
  };
}

async function drainProcessOutput(
  stream: ReadableStream<string>,
  onChunk: (text: string) => void,
  outReaderRef?: OutputReaderRef,
): Promise<void> {
  const reader = stream.getReader();
  if (outReaderRef) outReaderRef.current = reader;
  try {
    for (; ;) {
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

function abortCurrentShell(
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

async function runSpawnCore(
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
    terminal: termDims(term),
    ...(cwd ? { cwd } : {}),
  });
  processRef.current = proc;
  const writer = proc.input.getWriter();
  stdinForwardRef.current = writer;
  onProcessStarted?.();
  try {
    const [, code] = await Promise.all([
      drainProcessOutput(
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

async function runShellLineCore(
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

  const code = await runSpawnCore(
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

/**
 * 单面板终端会话：封装 `TerminalLogBuffer`、进程与 IO 引用，以及会话 `cwdRel`。
 * 先 `new`，在 `WebContainer` 就绪后调用 `bindWebContainer`，再执行 `runLine` / `runSpawn`。
 */
export class WebContainerTerminalSession implements IWebContainerTerminalSession {
  private _wc: WebContainer | null = null;
  private readonly _term: WebContainerTerminalSessionOptions["term"];
  private readonly _cfg: WebContainerTerminalSessionOptions["config"];
  private _cwdRel: string;
  private readonly _ring: TerminalLogBuffer;
  private readonly _processRef: WebContainerProcessRef;
  private readonly _stdinForwardRef: StdinForwardRef;
  private readonly _outputReaderRef: OutputReaderRef;
  private readonly _onForegroundChange?: (running: boolean) => void;
  private readonly _onCwdRelChange?: (cwdRel: string) => void;

  constructor(options: WebContainerTerminalSessionOptions) {
    this._term = options.term;
    this._cfg = options.config;
    this._cwdRel = options.initialCwdRel ?? "";
    this._ring = new TerminalLogBuffer();
    this._processRef = new WebContainerProcessRef();
    this._stdinForwardRef = new StdinForwardRef();
    this._outputReaderRef = new OutputReaderRef();
    this._onForegroundChange = options.onForegroundChange;
    this._onCwdRelChange = options.onCwdRelChange;
  }

  bindWebContainer(wc: WebContainer): void {
    this._wc = wc;
  }

  get hasForegroundProcess(): boolean {
    return this._processRef.current != null;
  }

  get cwdRel(): string {
    return this._cwdRel;
  }

  set cwdRel(value: string) {
    this._cwdRel = value;
    this._onCwdRelChange?.(this._cwdRel);
  }

  formatPromptLine(workdir: string): string {
    return terminalCwdPrompt.formatPromptLine(workdir, this._cwdRel);
  }

  get logBuffer(): TerminalLogBuffer {
    return this._ring;
  }

  get processRef(): WebContainerProcessRef {
    return this._processRef;
  }

  get stdinForwardRef(): StdinForwardRef {
    return this._stdinForwardRef;
  }

  get outputReaderRef(): OutputReaderRef {
    return this._outputReaderRef;
  }

  private requireWc(): WebContainer {
    if (!this._wc) {
      throw new Error(
        "WebContainer 未绑定：请先调用 bindWebContainer(wc)，再执行 runLine / runSpawn。",
      );
    }
    return this._wc;
  }

  private syncForeground(): void {
    this._onForegroundChange?.(this.hasForegroundProcess);
  }

  abort(): void {
    abortCurrentShell(this._processRef, {
      stdinRef: this._stdinForwardRef,
      outputReaderRef: this._outputReaderRef,
    });
    queueMicrotask(() => this.syncForeground());
  }

  async runSpawn(
    command: string,
    args: string[],
    options?: WebContainerTerminalSessionSpawnOptions,
  ): Promise<number> {
    const wc = this.requireWc();
    const extraCwd = options?.cwd?.trim();
    const spawnExtra =
      extraCwd !== undefined && extraCwd !== ""
        ? { cwd: extraCwd }
        : this._cwdRel.trim() !== ""
          ? { cwd: this._cwdRel.trim() }
          : undefined;
    const logIntro =
      options?.intro ?? `\r\n$ ${[command, ...args].join(" ")}\r\n`;
    try {
      return await runSpawnCore(
        wc,
        this._term,
        this._ring,
        this._processRef,
        command,
        args,
        logIntro,
        this._cfg,
        this._stdinForwardRef,
        () => this.syncForeground(),
        this._outputReaderRef,
        spawnExtra,
      );
    } finally {
      this.syncForeground();
    }
  }

  async runLine(
    line: string,
    options?: RunShellLineOptions,
  ): Promise<{ code: number }> {
    const wc = this.requireWc();
    const shellOpts: RunShellLineOptions = {
      ...options,
      cwd:
        options?.cwd !== undefined
          ? options.cwd
          : this._cwdRel.trim() || undefined,
    };
    try {
      const result = await runShellLineCore(
        wc,
        line,
        this._term,
        this._ring,
        this._processRef,
        this._cfg,
        this._stdinForwardRef,
        () => this.syncForeground(),
        shellOpts,
        this._outputReaderRef,
      );
      const trimmed = line.trim();
      if (
        result.code === 0 &&
        terminalCwdPrompt.isCdOnlyLine(trimmed)
      ) {
        this._cwdRel = terminalCwdPrompt.resolveCdArg(
          this._cwdRel,
          terminalCwdPrompt.cdArgFromLine(trimmed),
        );
        this._onCwdRelChange?.(this._cwdRel);
      }
      return result;
    } finally {
      this.syncForeground();
    }
  }
}
