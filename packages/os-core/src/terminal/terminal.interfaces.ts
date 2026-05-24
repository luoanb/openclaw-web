import type { RuntimeCapabilityLevel, RuntimeSession, Unsubscribe } from "../runtime";
import type { TerminalError } from "./terminal.errors";

export type TerminalLifecycleStatus = "creating" | "open" | "closing" | "closed" | "failed";

export type TerminalInteractionStatus = "ready" | "running" | "blocked" | "unsupported" | "failed";

export type TerminalActionFailureReason = "blocked" | "unsupported" | "failed";

export type TerminalActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: TerminalActionFailureReason;
      readonly message: string;
      readonly error?: TerminalError;
    };

export type TerminalCapabilities = {
  readonly runningStdin: RuntimeCapabilityLevel;
  readonly interruptForeground: boolean;
  readonly resize: boolean;
  readonly cwd: boolean;
};

export type CreateTerminalOptions = {
  readonly name?: string;
  readonly cwd?: string;
  readonly element?: HTMLElement;
};

export type TerminalProcessSummary = {
  readonly id: string;
  readonly command: string;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly exitCode?: number | null;
};

export type TerminalSnapshot = {
  readonly id: string;
  readonly name: string;
  readonly cwd: string;
  readonly lifecycleStatus: TerminalLifecycleStatus;
  readonly interactionStatus: TerminalInteractionStatus;
  readonly capabilities: TerminalCapabilities;
  readonly foregroundProcess: TerminalProcessSummary | null;
  readonly updatedAt: number;
};

export interface TerminalSession {
  readonly id: string;
  readonly name: string;
  readonly cwd: string;
  readonly lifecycleStatus: TerminalLifecycleStatus;
  readonly interactionStatus: TerminalInteractionStatus;
  readonly capabilities: TerminalCapabilities;

  submitCommand(command: string): Promise<TerminalActionResult>;
  writeStdin(input: string): Promise<TerminalActionResult>;
  interrupt(target?: TerminalInterruptTarget): Promise<TerminalActionResult>;
  resize(cols: number, rows: number): TerminalActionResult;
  close(): Promise<TerminalActionResult>;
  getSnapshot(): TerminalSnapshot;
  onEvent(listener: TerminalEventListener): Unsubscribe;
}

export interface TerminalService {
  createTerminal(runtimeSession: RuntimeSession, options?: CreateTerminalOptions): Promise<TerminalSession>;
}

export type TerminalInterruptTarget =
  | { readonly type: "foreground-process" }
  | { readonly type: "terminal"; readonly terminalId: string };

export type TerminalEvent =
  | { readonly type: "terminal-output"; readonly terminalId: string; readonly chunk: string }
  | { readonly type: "terminal-clear"; readonly terminalId: string }
  | {
      readonly type: "terminal-lifecycle-status";
      readonly terminalId: string;
      readonly status: TerminalLifecycleStatus;
    }
  | {
      readonly type: "terminal-interaction-status";
      readonly terminalId: string;
      readonly status: TerminalInteractionStatus;
    }
  | { readonly type: "terminal-cwd"; readonly terminalId: string; readonly cwd: string }
  | { readonly type: "terminal-notice"; readonly terminalId: string; readonly message: string }
  | { readonly type: "process-started"; readonly terminalId: string; readonly process: TerminalProcessSummary }
  | { readonly type: "process-ended"; readonly terminalId: string; readonly process: TerminalProcessSummary }
  | { readonly type: "terminal-error"; readonly terminalId: string; readonly error: TerminalError };

export type TerminalEventListener = (event: TerminalEvent) => void;
