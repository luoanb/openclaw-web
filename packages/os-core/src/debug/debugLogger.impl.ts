export type DebugLogLevel = "debug" | "info" | "warn" | "error";

export type DebugLogEvent =
  | "operation:start"
  | "operation:success"
  | "operation:error"
  | "operation:blocked"
  | "operation:cancelled";

export type DebugLogDetails = Record<string, unknown>;

export type DebugConsoleLike = Pick<Console, "debug" | "info" | "warn" | "error">;

export type DebugLoggerOptions = {
  readonly console?: DebugConsoleLike;
  readonly enabled?: boolean;
  readonly minLevel?: DebugLogLevel;
  readonly now?: () => number;
};

const LEVEL_WEIGHT: Record<DebugLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_KEYS = /^(content|base64|payload|token|secret|password|credential|env)$/i;
const MAX_STRING_LENGTH = 500;

export class DebugLogger {
  private readonly consoleLike: DebugConsoleLike;
  private readonly enabled: boolean;
  private readonly minLevel: DebugLogLevel;
  private readonly now: () => number;

  constructor(
    private readonly scope: string,
    options: DebugLoggerOptions = {},
  ) {
    this.consoleLike = options.console ?? console;
    this.enabled = options.enabled ?? true;
    this.minLevel = options.minLevel ?? "debug";
    this.now = options.now ?? (() => performance.now());
  }

  static createOperationId(prefix = "op"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  start(operation: string, details: DebugLogDetails = {}): number {
    this.debug("operation:start", { operation, ...details });
    return this.now();
  }

  success(operation: string, startedAt: number, details: DebugLogDetails = {}): void {
    this.debug("operation:success", {
      operation,
      durationMs: this.durationSince(startedAt),
      resultOk: true,
      ...details,
    });
  }

  blocked(operation: string, reason: string, details: DebugLogDetails = {}): void {
    this.warn("operation:blocked", { operation, reason, resultOk: false, ...details });
  }

  cancelled(operation: string, reason: string, details: DebugLogDetails = {}): void {
    this.info("operation:cancelled", { operation, reason, resultOk: false, ...details });
  }

  error(operation: string, error: unknown, startedAt?: number, details: DebugLogDetails = {}): void {
    this.write("error", "operation:error", {
      operation,
      resultOk: false,
      ...(startedAt === undefined ? {} : { durationMs: this.durationSince(startedAt) }),
      ...details,
      error: this.formatError(error),
    });
  }

  debug(event: DebugLogEvent, details: DebugLogDetails = {}): void {
    this.write("debug", event, details);
  }

  info(event: DebugLogEvent, details: DebugLogDetails = {}): void {
    this.write("info", event, details);
  }

  warn(event: DebugLogEvent, details: DebugLogDetails = {}): void {
    this.write("warn", event, details);
  }

  private write(level: DebugLogLevel, event: DebugLogEvent, details: DebugLogDetails): void {
    if (!this.shouldLog(level)) return;
    this.consoleLike[level](`[web-claw:${this.scope}] ${event}`, this.sanitize(details));
  }

  private shouldLog(level: DebugLogLevel): boolean {
    return this.enabled && LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[this.minLevel];
  }

  private durationSince(startedAt: number): number {
    return Math.round(this.now() - startedAt);
  }

  private sanitize(value: unknown): unknown {
    if (value instanceof Error) return this.formatError(value);
    if (typeof value === "string") return truncate(value);
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));

    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      sanitized[key] = REDACTED_KEYS.test(key) ? "[redacted]" : this.sanitize(item);
    }
    return sanitized;
  }

  private formatError(error: unknown): DebugLogDetails {
    if (error instanceof Error) {
      const details: DebugLogDetails = {
        name: error.name,
        message: truncate(error.message),
      };
      const maybeError = error as Error & {
        readonly code?: unknown;
        readonly recoverable?: unknown;
        readonly fileError?: {
          readonly code?: unknown;
          readonly recoverable?: unknown;
        };
      };
      const errorCode = maybeError.code ?? maybeError.fileError?.code;
      const recoverable = maybeError.recoverable ?? maybeError.fileError?.recoverable;
      if (errorCode) details.errorCode = errorCode;
      if (typeof recoverable === "boolean") details.recoverable = recoverable;
      return details;
    }
    if (isErrorDetailsLike(error)) {
      const details: DebugLogDetails = {
        message: truncate(error.message),
      };
      if (error.name) details.name = truncate(error.name);
      if (error.code) details.errorCode = error.code;
      if (typeof error.recoverable === "boolean") details.recoverable = error.recoverable;
      if ("cause" in error) details.cause = this.summarizeCause(error.cause);
      return details;
    }
    return { message: truncate(String(error)) };
  }

  private summarizeCause(cause: unknown): unknown {
    if (cause instanceof Error || isErrorDetailsLike(cause)) {
      return this.formatError(cause);
    }
    if (typeof cause === "string") return truncate(cause);
    if (!cause || typeof cause !== "object") return cause;
    if (Array.isArray(cause)) return { type: "array", length: cause.length };

    const source = cause as Record<string, unknown>;
    const summary: DebugLogDetails = {};
    if (typeof source.ok === "boolean") summary.ok = source.ok;
    if (typeof source.code === "string" || typeof source.code === "number") summary.code = source.code;
    if (typeof source.exitCode === "number") summary.exitCode = source.exitCode;
    if (typeof source.message === "string") summary.message = truncate(source.message);
    if (typeof source.output === "string") summary.outputLength = source.output.length;
    if (Object.keys(summary).length > 0) return summary;

    return {
      type: "object",
      keys: Object.keys(source).slice(0, 5),
    };
  }
}

function truncate(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

function isErrorDetailsLike(value: unknown): value is {
  readonly name?: string;
  readonly message: string;
  readonly code?: unknown;
  readonly recoverable?: unknown;
  readonly cause?: unknown;
} {
  return Boolean(value) && typeof value === "object" && typeof (value as { readonly message?: unknown }).message === "string";
}
