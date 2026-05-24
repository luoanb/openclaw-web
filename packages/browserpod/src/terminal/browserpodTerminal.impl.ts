import {
  TerminalContractError,
  TerminalStateMachine,
  type CreateTerminalOptions,
  type RuntimeSession,
  type TerminalErrorCode,
  type TerminalActionResult,
  type TerminalCapabilities,
  type TerminalEventListener,
  type TerminalInterruptTarget,
  type TerminalProcessSummary,
  type TerminalService,
  type TerminalSession,
  type TerminalSnapshot,
  type Unsubscribe,
} from "os-core";
import { BrowserPodRuntimeManager } from "../runtime/browserpodRuntime.impl";
import type { BrowserPodLike, BrowserPodTerminalLike } from "../runtime/browserpodRuntime.interfaces";
import { BrowserPodTerminalPath } from "./browserpodTerminalPath.impl";

const BROWSERPOD_TERMINAL_CAPABILITIES: TerminalCapabilities = {
  runningStdin: "partial",
  interruptForeground: false,
  resize: false,
  cwd: true,
};

export class BrowserPodTerminalService implements TerminalService {
  private nextTerminalIndex = 1;

  constructor(private readonly runtimeManager: BrowserPodRuntimeManager) {}

  async createTerminal(runtimeSession: RuntimeSession, options: CreateTerminalOptions = {}): Promise<TerminalSession> {
    const pod = this.runtimeManager.resolvePod(runtimeSession);
    if (!pod) {
      throw new TerminalContractError({
        code: "runtime-session-invalid",
        message: "BrowserPod runtime session is not available.",
        recoverable: true,
      });
    }

    const id = createTerminalId();
    const name = options.name ?? `Terminal ${this.nextTerminalIndex++}`;
    const element = options.element ?? createDetachedTerminalElement();
    const terminal = createBrowserPodTerminal(pod, element);

    return new BrowserPodTerminalSession({
      id,
      name,
      cwd: options.cwd,
      pod,
      terminal,
    });
  }
}

type BrowserPodTerminalSessionOptions = {
  readonly id: string;
  readonly name: string;
  readonly cwd?: string;
  readonly pod: BrowserPodLike;
  readonly terminal: BrowserPodTerminalLike;
};

class BrowserPodTerminalSession implements TerminalSession {
  readonly id: string;
  readonly name: string;
  readonly capabilities = BROWSERPOD_TERMINAL_CAPABILITIES;
  private readonly pod: BrowserPodLike;
  private readonly terminal: BrowserPodTerminalLike;
  private readonly state: TerminalStateMachine;

  constructor(options: BrowserPodTerminalSessionOptions) {
    this.id = options.id;
    this.name = options.name;
    this.pod = options.pod;
    this.terminal = options.terminal;
    this.state = new TerminalStateMachine({
      id: options.id,
      name: options.name,
      cwd: options.cwd,
      capabilities: this.capabilities,
    });
    this.state.setLifecycleStatus("open");
  }

  get cwd(): string {
    return this.state.cwd;
  }

  get lifecycleStatus() {
    return this.state.lifecycleStatus;
  }

  get interactionStatus() {
    return this.state.interactionStatus;
  }

  async submitCommand(command: string): Promise<TerminalActionResult> {
    const normalizedCommand = command.trim();
    if (this.lifecycleStatus !== "open") {
      return this.failAction("failed", "Terminal is not open.");
    }
    if (this.interactionStatus === "running") {
      return this.failAction("blocked", "A foreground command is already running.");
    }
    if (!normalizedCommand) {
      return { ok: true };
    }

    if (normalizedCommand === "clear") {
      this.state.clearOutput();
      return { ok: true };
    }

    const cdTarget = parseCdTarget(normalizedCommand);
    if (cdTarget !== null) {
      return this.changeDirectory(cdTarget);
    }

    return this.runShellCommand(normalizedCommand);
  }

  async writeStdin(input: string): Promise<TerminalActionResult> {
    if (this.interactionStatus !== "running") {
      return this.failAction("blocked", "No foreground process is waiting for stdin.");
    }
    if (typeof this.terminal.write !== "function") {
      const message = "This BrowserPod terminal does not expose stable programmatic stdin.";
      this.state.notice(message);
      return this.failAction("unsupported", message, "terminal-stdin-unsupported");
    }

    try {
      await this.terminal.write(input);
      return { ok: true };
    } catch (error) {
      return this.failAction("failed", "Failed to write stdin to BrowserPod terminal.", "terminal-stdin-blocked", error);
    }
  }

  async interrupt(_target: TerminalInterruptTarget = { type: "foreground-process" }): Promise<TerminalActionResult> {
    const message = "BrowserPod foreground interrupt is not supported by the current adapter.";
    this.state.notice(message);
    return this.failAction("unsupported", message, "terminal-interrupt-unsupported");
  }

  resize(cols: number, rows: number): TerminalActionResult {
    if (typeof this.terminal.resize !== "function") {
      return this.failAction("unsupported", "BrowserPod terminal resize is not supported.", "terminal-resize-unsupported");
    }

    try {
      this.terminal.resize(cols, rows);
      return { ok: true };
    } catch (error) {
      return this.failAction("failed", "Failed to resize BrowserPod terminal.", "terminal-resize-unsupported", error);
    }
  }

  async close(): Promise<TerminalActionResult> {
    if (this.lifecycleStatus === "closed") return { ok: true };

    this.state.setLifecycleStatus("closing");
    try {
      await this.terminal.close?.();
      this.state.setLifecycleStatus("closed");
      return { ok: true };
    } catch (error) {
      return this.failAction("failed", "Failed to close BrowserPod terminal.", "terminal-closed", error);
    }
  }

  getSnapshot(): TerminalSnapshot {
    return this.state.getSnapshot();
  }

  onEvent(listener: TerminalEventListener): Unsubscribe {
    return this.state.onEvent(listener);
  }

  private async changeDirectory(target: string): Promise<TerminalActionResult> {
    const nextCwd = BrowserPodTerminalPath.resolve(this.cwd, target);
    const result = await this.runShellCommand(`cd ${BrowserPodTerminalPath.shellQuote(nextCwd)}`, { updateReadyStatus: false });
    if (result.ok) {
      this.state.setCwd(nextCwd);
    }
    return result;
  }

  private async runShellCommand(
    command: string,
    options: { readonly updateReadyStatus?: boolean } = {},
  ): Promise<TerminalActionResult> {
    if (typeof this.pod.run !== "function") {
      return this.failAction("unsupported", "BrowserPod run is not available.", "terminal-command-failed");
    }

    const process: TerminalProcessSummary = {
      id: createProcessId(),
      command,
      startedAt: Date.now(),
    };
    this.state.startProcess(process);

    try {
      const result = await this.pod.run("sh", ["-c", command], {
        terminal: this.terminal,
        cwd: this.cwd,
      });
      const exitCode = readExitCode(result);
      this.state.endProcess({ endedAt: Date.now(), exitCode });
      if (options.updateReadyStatus === false) {
        this.state.setInteractionStatus("ready");
      }
      return { ok: true };
    } catch (error) {
      this.state.endProcess({ endedAt: Date.now(), exitCode: null });
      return this.failAction("failed", "BrowserPod command failed.", "terminal-command-failed", error);
    }
  }

  private failAction(
    reason: Exclude<TerminalActionResult, { ok: true }>["reason"],
    message: string,
    code: TerminalErrorCode = "unknown",
    cause?: unknown,
  ): TerminalActionResult {
    if (reason === "failed") {
      this.state.fail({ code, message, recoverable: true, cause });
    }

    return {
      ok: false,
      reason,
      message,
      error: { code, message, recoverable: true, cause },
    };
  }
}

function createBrowserPodTerminal(pod: BrowserPodLike, element: HTMLElement): BrowserPodTerminalLike {
  if (typeof pod.createDefaultTerminal !== "function") {
    throw new TerminalContractError({
      code: "terminal-create-failed",
      message: "BrowserPod default terminal API is not available.",
      recoverable: false,
    });
  }

  return pod.createDefaultTerminal(element);
}

function createDetachedTerminalElement(): HTMLElement {
  if (typeof document === "undefined") {
    throw new TerminalContractError({
      code: "terminal-create-failed",
      message: "BrowserPod terminal creation requires a DOM element.",
      recoverable: true,
    });
  }

  return document.createElement("div");
}

function parseCdTarget(command: string): string | null {
  if (command === "cd") return "/";
  const match = /^cd\s+(.+)$/.exec(command);
  return match?.[1]?.trim() ?? null;
}

function readExitCode(result: unknown): number | null {
  if (result && typeof result === "object" && "exitCode" in result) {
    const exitCode = result.exitCode;
    if (typeof exitCode === "number") return exitCode;
  }
  return null;
}

function createTerminalId(): string {
  return `browserpod-terminal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createProcessId(): string {
  return `browserpod-process-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
