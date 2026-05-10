import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { DEFAULT_SHELL_COMMAND, DEFAULT_TERMINAL_DIMENSIONS } from "./shellSpawnOptions";
import type {
  IShellSession,
  ShellExitInfo,
  ShellSessionOptions,
  ShellSessionState,
  Unsubscribe,
} from "./shellSession.interfaces";

function assertPositiveInt(name: string, n: number): void {
  if (!Number.isInteger(n) || n <= 0) {
    throw new TypeError(`${name} must be a positive integer, got ${n}`);
  }
}

/**
 * 基于 `WebContainer.spawn` 的 Shell 会话：输入输出透传，不做指令改写。
 */
export class ShellSession implements IShellSession {
  readonly #wc: WebContainer;
  readonly #options: ShellSessionOptions;

  #state: ShellSessionState = "idle";
  #process: WebContainerProcess | undefined;
  #inputWriter: WritableStreamDefaultWriter<string> | undefined;
  #writeChain: Promise<void> = Promise.resolve();
  #outputPump: Promise<void> | undefined;
  #exitHandled = false;
  #suppressExitEvent = false;

  readonly #outputListeners = new Set<(chunk: string) => void>();
  readonly #exitListeners = new Set<(info: ShellExitInfo) => void>();

  constructor(wc: WebContainer, options: ShellSessionOptions = {}) {
    this.#wc = wc;
    this.#options = options;
  }

  get state(): ShellSessionState {
    return this.#state;
  }

  async start(): Promise<void> {
    if (this.#state !== "idle") {
      throw new Error(`ShellSession.start: invalid state ${this.#state}`);
    }

    const command = this.#options.command ?? DEFAULT_SHELL_COMMAND;
    const args = this.#options.args;
    const terminal = this.#options.terminal ?? DEFAULT_TERMINAL_DIMENSIONS;
    assertPositiveInt("terminal.cols", terminal.cols);
    assertPositiveInt("terminal.rows", terminal.rows);

    const spawnOptions = {
      cwd: this.#options.cwd,
      env: this.#options.env,
      output: this.#options.output !== false,
      terminal,
    };

    const proc =
      args !== undefined && args.length > 0
        ? await this.#wc.spawn(command, args, spawnOptions)
        : await this.#wc.spawn(command, spawnOptions);

    this.#process = proc;
    this.#inputWriter = proc.input.getWriter();
    this.#state = "running";

    this.#outputPump = this.#pumpOutput(proc);

    proc.exit.then((code) => {
      void this.#finalizeExit(code);
    });
  }

  async write(chunk: string): Promise<void> {
    this.#assertCanWrite();
    const writer = this.#inputWriter!;
    this.#writeChain = this.#writeChain.then(() => writer.write(chunk));
    return this.#writeChain;
  }

  async writeBytes(chunk: Uint8Array): Promise<void> {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(chunk);
    return this.write(text);
  }

  resize(cols: number, rows: number): void {
    assertPositiveInt("cols", cols);
    assertPositiveInt("rows", rows);
    if (this.#state !== "running" || !this.#process) return;
    this.#process.resize({ cols, rows });
  }

  async dispose(): Promise<void> {
    if (this.#state === "disposed") return;

    if (this.#state === "idle") {
      this.#state = "disposed";
      return;
    }

    if (this.#state === "exited") {
      this.#state = "disposed";
      this.#outputListeners.clear();
      this.#exitListeners.clear();
      return;
    }

    this.#suppressExitEvent = true;

    const proc = this.#process;
    this.#process = undefined;

    try {
      proc?.kill();
    } catch {
      /* ignore */
    }

    const writer = this.#inputWriter;
    this.#inputWriter = undefined;
    if (writer) {
      try {
        await writer.close();
      } catch {
        try {
          await writer.abort();
        } catch {
          /* ignore */
        }
      }
    }

    if (this.#outputPump) {
      try {
        await this.#outputPump;
      } catch {
        /* ignore */
      }
      this.#outputPump = undefined;
    }

    if (proc) {
      try {
        await proc.exit;
      } catch {
        /* ignore */
      }
    }

    this.#suppressExitEvent = false;
    this.#state = "disposed";
    this.#outputListeners.clear();
    this.#exitListeners.clear();
  }

  onOutput(listener: (chunk: string) => void): Unsubscribe {
    this.#outputListeners.add(listener);
    return () => {
      this.#outputListeners.delete(listener);
    };
  }

  onExit(listener: (info: ShellExitInfo) => void): Unsubscribe {
    this.#exitListeners.add(listener);
    return () => {
      this.#exitListeners.delete(listener);
    };
  }

  #assertCanWrite(): void {
    if (this.#state !== "running" || !this.#inputWriter) {
      throw new Error(`ShellSession.write: invalid state ${this.#state}`);
    }
  }

  async #pumpOutput(proc: WebContainerProcess): Promise<void> {
    const reader = proc.output.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const fn of [...this.#outputListeners]) {
          fn(value);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async #finalizeExit(code: number): Promise<void> {
    if (this.#exitHandled) return;
    this.#exitHandled = true;

    const shouldNotify = !this.#suppressExitEvent && this.#state === "running";
    if (shouldNotify) {
      for (const fn of [...this.#exitListeners]) {
        fn({ code });
      }
    }

    if (this.#state === "running") {
      this.#state = "exited";
    }

    this.#process = undefined;

    const writer = this.#inputWriter;
    this.#inputWriter = undefined;
    if (writer) {
      try {
        await writer.close();
      } catch {
        try {
          await writer.abort();
        } catch {
          /* ignore */
        }
      }
    }

    if (this.#outputPump) {
      try {
        await this.#outputPump;
      } catch {
        /* ignore */
      }
      this.#outputPump = undefined;
    }
  }
}
