import type { RuntimeError, RuntimeErrorCode } from "os-core";

export class BrowserPodErrorMapper {
  static toRuntimeError(error: unknown, fallbackCode: RuntimeErrorCode = "unknown"): RuntimeError {
    if (isRuntimeError(error)) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("api") && (lowerMessage.includes("key") || lowerMessage.includes("auth"))) {
      return {
        code: "auth-invalid",
        message: "BrowserPod authentication failed.",
        recoverable: true,
        cause: error,
      };
    }

    return {
      code: fallbackCode,
      message: message || "BrowserPod runtime operation failed.",
      recoverable: fallbackCode !== "browser-unsupported" && fallbackCode !== "isolation-unavailable",
      cause: error,
    };
  }
}

function isRuntimeError(error: unknown): error is RuntimeError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      "message" in error &&
      "recoverable" in error,
  );
}
