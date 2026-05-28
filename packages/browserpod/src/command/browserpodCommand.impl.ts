import type {
  BrowserPodCommandRunOptions,
  BrowserPodCommandRunResult,
  BrowserPodCommandRunner,
} from "./browserpodCommand.interfaces";
import { AsyncTaskQueue } from "./asyncTaskQueue.impl";
import type { BrowserPodLike, BrowserPodTerminalLike } from "../runtime";

const DEFAULT_COMMAND_CWD = "/home/user";
const DEFAULT_TIMEOUT_MS = 15_000;

type RunSettlement =
  | { readonly type: "resolved"; readonly value: unknown }
  | { readonly type: "rejected"; readonly error: unknown }
  | { readonly type: "timeout" };

export class CustomTerminalCommandRunner implements BrowserPodCommandRunner {
  private readonly queue = new AsyncTaskQueue({ concurrency: 1 });
  private terminal: BrowserPodTerminalLike | null = null;
  private terminalPod: BrowserPodLike | null = null;
  private activeCommand: ((chunk: string) => void) | null = null;

  async run(
    pod: BrowserPodLike,
    command: string,
    args: readonly string[],
    options: BrowserPodCommandRunOptions = {},
  ): Promise<BrowserPodCommandRunResult> {
    if (!pod.run || !pod.createCustomTerminal) {
      throw new Error("BrowserPod command runner requires run and createCustomTerminal.");
    }
    const run = pod.run;

    return this.queue.enqueue(() => this.runQueued(pod, run, command, args, options));
  }

  async dispose(): Promise<void> {
    await this.queue.enqueue(async () => {
      const terminal = this.terminal;
      this.terminal = null;
      this.terminalPod = null;
      this.activeCommand = null;
      if (terminal) {
        await closeTerminal(terminal);
      }
    });
  }

  private async runQueued(
    pod: BrowserPodLike,
    run: NonNullable<BrowserPodLike["run"]>,
    command: string,
    args: readonly string[],
    options: BrowserPodCommandRunOptions,
  ): Promise<BrowserPodCommandRunResult> {
    const chunks: string[] = [];
    const cwd = options.cwd ?? DEFAULT_COMMAND_CWD;
    const terminal = await this.getTerminal(pod);
    this.activeCommand = (chunk) => {
      chunks.push(chunk);
    };

    try {
      const runOptions = options.env ? { terminal, cwd, echo: false, env: options.env } : { terminal, cwd, echo: false };
      const runReturn = run.call(pod, command, [...args], runOptions);
      return await waitForRunResult(chunks, runReturn, options);
    } finally {
      this.activeCommand = null;
    }
  }

  private async getTerminal(pod: BrowserPodLike): Promise<BrowserPodTerminalLike> {
    if (this.terminal && this.terminalPod === pod) {
      return this.terminal;
    }

    if (this.terminal) {
      await closeTerminal(this.terminal);
      this.terminal = null;
      this.terminalPod = null;
    }

    const terminal = await pod.createCustomTerminal?.({
      onOutput: (buffer) => {
        this.activeCommand?.(decodeTerminalChunk(buffer));
      },
    });
    if (!terminal) {
      throw new Error("BrowserPod command runner failed to create a custom terminal.");
    }

    this.terminal = terminal;
    this.terminalPod = pod;
    return terminal;
  }
}

function decodeTerminalChunk(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? new Uint8Array(buffer) : new Uint8Array(buffer.slice(0));
  return new TextDecoder().decode(bytes);
}

async function waitForRunResult(
  chunks: readonly string[],
  runReturn: unknown,
  options: BrowserPodCommandRunOptions,
): Promise<BrowserPodCommandRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const completion = resolveRunCompletion(runReturn);
  const result = await Promise.race([
    completion,
    new Promise<{ readonly type: "timeout" }>((resolve) => setTimeout(() => resolve({ type: "timeout" }), timeoutMs)),
  ]);

  const output = chunks.join("");
  if (result.type === "timeout") {
    void settleRun(completion);
    return { ok: false, code: "timeout", output };
  }

  if (result.type === "rejected") {
    return { ok: false, code: "failed", output };
  }

  const code = readExitCode(result.value);
  return {
    ok: code === undefined || code === 0,
    code,
    output,
  };
}

function resolveRunCompletion(runReturn: unknown): Promise<RunSettlement> {
  const target = readCosProcess(runReturn) ?? runReturn;
  if (!isPromiseLike(target)) {
    return Promise.resolve({ type: "resolved", value: target });
  }

  return new Promise((resolve) => {
    try {
      target.then(
        (value) => resolve({ type: "resolved", value }),
        (error) => resolve({ type: "rejected", error }),
      );
    } catch (error) {
      resolve({ type: "rejected", error });
    }
  });
}

async function settleRun(promise: Promise<RunSettlement>): Promise<void> {
  try {
    await promise;
  } catch {
    // Timeout callers already received the captured output.
  }
}

async function closeTerminal(terminal: BrowserPodTerminalLike): Promise<void> {
  try {
    await terminal.close?.();
  } catch {
    // Closing a custom terminal is best-effort in BrowserPod 2.8.0.
  }
}

function readCosProcess(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("cosProcess" in value)) return undefined;
  return (value as { readonly cosProcess?: unknown }).cosProcess;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value) && (typeof value === "object" || typeof value === "function") && typeof (value as { readonly then?: unknown }).then === "function";
}

function readExitCode(value: unknown): number | undefined {
  if (!value || typeof value !== "object" || !("exitCode" in value)) return undefined;
  const exitCode = (value as { readonly exitCode?: unknown }).exitCode;
  return typeof exitCode === "number" ? exitCode : undefined;
}

