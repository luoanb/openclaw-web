import type { TerminalError } from "./terminal.errors";
import type {
  TerminalCapabilities,
  TerminalEvent,
  TerminalEventListener,
  TerminalInteractionStatus,
  TerminalLifecycleStatus,
  TerminalProcessSummary,
  TerminalSnapshot,
} from "./terminal.interfaces";
import type { Unsubscribe } from "../runtime";

export type TerminalStateMachineOptions = {
  readonly id: string;
  readonly name: string;
  readonly cwd?: string;
  readonly capabilities: TerminalCapabilities;
  readonly now?: () => number;
};

/**
 * Reusable state holder for terminal adapters.
 *
 * Concrete adapters own process execution and SDK calls; this class keeps
 * status, snapshot and event semantics consistent across implementations.
 */
export class TerminalStateMachine {
  private readonly id: string;
  private readonly listeners = new Set<TerminalEventListener>();
  private readonly now: () => number;
  private snapshot: TerminalSnapshot;

  constructor(options: TerminalStateMachineOptions) {
    this.id = options.id;
    this.now = options.now ?? Date.now;
    this.snapshot = {
      id: options.id,
      name: options.name,
      cwd: options.cwd ?? "/",
      lifecycleStatus: "creating",
      interactionStatus: "ready",
      capabilities: options.capabilities,
      foregroundProcess: null,
      updatedAt: this.now(),
    };
  }

  get lifecycleStatus(): TerminalLifecycleStatus {
    return this.snapshot.lifecycleStatus;
  }

  get interactionStatus(): TerminalInteractionStatus {
    return this.snapshot.interactionStatus;
  }

  get cwd(): string {
    return this.snapshot.cwd;
  }

  get foregroundProcess(): TerminalProcessSummary | null {
    return this.snapshot.foregroundProcess;
  }

  getSnapshot(): TerminalSnapshot {
    return { ...this.snapshot };
  }

  onEvent(listener: TerminalEventListener): Unsubscribe {
    this.listeners.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
    };
  }

  setLifecycleStatus(status: TerminalLifecycleStatus): void {
    this.updateSnapshot({ lifecycleStatus: status });
    this.emit({ type: "terminal-lifecycle-status", terminalId: this.id, status });
  }

  setInteractionStatus(status: TerminalInteractionStatus): void {
    this.updateSnapshot({ interactionStatus: status });
    this.emit({ type: "terminal-interaction-status", terminalId: this.id, status });
  }

  setCwd(cwd: string): void {
    this.updateSnapshot({ cwd });
    this.emit({ type: "terminal-cwd", terminalId: this.id, cwd });
  }

  appendOutput(chunk: string): void {
    this.emit({ type: "terminal-output", terminalId: this.id, chunk });
  }

  clearOutput(): void {
    this.emit({ type: "terminal-clear", terminalId: this.id });
  }

  notice(message: string): void {
    this.emit({ type: "terminal-notice", terminalId: this.id, message });
  }

  startProcess(process: TerminalProcessSummary): void {
    this.updateSnapshot({
      foregroundProcess: process,
      interactionStatus: "running",
    });
    this.emit({ type: "process-started", terminalId: this.id, process });
    this.emit({ type: "terminal-interaction-status", terminalId: this.id, status: "running" });
  }

  endProcess(processPatch: Pick<TerminalProcessSummary, "endedAt" | "exitCode">): TerminalProcessSummary | null {
    const process = this.snapshot.foregroundProcess;
    if (!process) return null;

    const endedProcess = {
      ...process,
      ...processPatch,
    };
    this.updateSnapshot({
      foregroundProcess: null,
      interactionStatus: "ready",
    });
    this.emit({ type: "process-ended", terminalId: this.id, process: endedProcess });
    this.emit({ type: "terminal-interaction-status", terminalId: this.id, status: "ready" });
    return endedProcess;
  }

  fail(error: TerminalError): void {
    this.updateSnapshot({
      lifecycleStatus: "failed",
      interactionStatus: "failed",
    });
    this.emit({ type: "terminal-error", terminalId: this.id, error });
    this.emit({ type: "terminal-lifecycle-status", terminalId: this.id, status: "failed" });
    this.emit({ type: "terminal-interaction-status", terminalId: this.id, status: "failed" });
  }

  private updateSnapshot(patch: Partial<TerminalSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      updatedAt: this.now(),
    };
  }

  private emit(event: TerminalEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
