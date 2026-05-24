export type RuntimeErrorCode =
  | "isolation-unavailable"
  | "browser-unsupported"
  | "auth-missing"
  | "auth-invalid"
  | "storage-key-invalid"
  | "boot-failed"
  | "stop-unsupported"
  | "stop-failed"
  | "session-not-running"
  | "capability-unsupported"
  | "unknown";

export type RuntimeError = {
  readonly code: RuntimeErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
};

export class RuntimeContractError extends Error {
  readonly runtimeError: RuntimeError;

  constructor(runtimeError: RuntimeError) {
    super(runtimeError.message);
    this.name = "RuntimeContractError";
    this.runtimeError = runtimeError;
  }
}
