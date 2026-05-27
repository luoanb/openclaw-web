export type ServicePreviewErrorCode =
  | "runtime-not-running"
  | "capability-unsupported"
  | "invalid-url"
  | "localhost-url-unresolved"
  | "portal-api-unavailable"
  | "iframe-load-failed"
  | "iframe-blocked"
  | "unknown";

export type ServicePreviewError = {
  readonly code: ServicePreviewErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
};

export class ServicePreviewContractError extends Error {
  readonly error: ServicePreviewError;

  constructor(error: ServicePreviewError) {
    super(error.message);
    this.name = "ServicePreviewContractError";
    this.error = error;
  }
}
