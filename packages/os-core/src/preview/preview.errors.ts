export type PreviewTargetErrorCode =
  | "runtime-not-running"
  | "capability-unsupported"
  | "invalid-url"
  | "localhost-url-unresolved"
  | "portal-api-unavailable"
  | "unknown";

export type PreviewTargetError = {
  readonly code: PreviewTargetErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
};

export class PreviewTargetContractError extends Error {
  readonly error: PreviewTargetError;

  constructor(error: PreviewTargetError) {
    super(error.message);
    this.name = "PreviewTargetContractError";
    this.error = error;
  }
}
