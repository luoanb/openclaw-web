export type TerminalErrorCode =
  | "terminal-create-failed"
  | "terminal-command-failed"
  | "terminal-stdin-blocked"
  | "terminal-stdin-unsupported"
  | "terminal-interrupt-unsupported"
  | "terminal-resize-unsupported"
  | "terminal-closed"
  | "runtime-session-invalid"
  | "unknown";

export type TerminalError = {
  readonly code: TerminalErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
};

export class TerminalContractError extends Error {
  readonly terminalError: TerminalError;

  constructor(terminalError: TerminalError) {
    super(terminalError.message);
    this.name = "TerminalContractError";
    this.terminalError = terminalError;
  }
}
