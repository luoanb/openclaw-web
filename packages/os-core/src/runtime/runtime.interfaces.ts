import type { RuntimeError } from "./runtime.errors";

export type RuntimeStatus =
  | "idle"
  | "checking"
  | "booting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | "unsupported";

export type RuntimeKind = "browserpod" | "webcontainer" | (string & {});

export type RuntimeBootOptions = {
  readonly reason?: "app-open" | "manual" | "retry";
  readonly sessionKey?: string;
};

export type RuntimeCheckOptions = {
  readonly reason?: "app-open" | "manual" | "retry";
};

export type RuntimeStopOptions = {
  readonly reason?: "manual" | "app-close";
};

export type RuntimeCapabilityLevel = "supported" | "partial" | "unsupported" | "unknown";

export type RuntimeCapabilities = {
  readonly multipleTerminals: boolean;
  readonly commandRun: boolean;
  readonly processStdin: RuntimeCapabilityLevel;
  readonly abortProcess: boolean;
  readonly shutdown: "supported" | "unsupported" | "unknown";
  readonly filePersistence: boolean;
  readonly servicePreview: boolean;
};

export const UNKNOWN_RUNTIME_CAPABILITIES: RuntimeCapabilities = {
  multipleTerminals: false,
  commandRun: false,
  processStdin: "unknown",
  abortProcess: false,
  shutdown: "unknown",
  filePersistence: false,
  servicePreview: false,
};

export type RuntimeCheckIssueCode =
  | "isolation-unavailable"
  | "browser-unsupported"
  | "auth-missing"
  | "auth-invalid"
  | "storage-key-invalid"
  | "unknown";

export type RuntimeCheckIssue = {
  readonly code: RuntimeCheckIssueCode;
  readonly message: string;
  readonly recoverable: boolean;
};

export type RuntimeCheckResult = {
  readonly ok: boolean;
  readonly status: "supported" | "unsupported" | "misconfigured";
  readonly issues: readonly RuntimeCheckIssue[];
};

export type RuntimeActionFailureReason =
  | "not-running"
  | "unsupported"
  | "invalid-state"
  | "failed";

export type RuntimeActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RuntimeActionFailureReason; readonly error?: RuntimeError };

export type RuntimeSessionRef = {
  readonly kind: RuntimeKind;
  readonly sessionId: string;
  readonly token: object;
};

export type RuntimeSessionSummary = {
  readonly id: string;
  readonly kind: RuntimeKind;
  readonly status: "running" | "stopped" | "failed";
  readonly sessionKey?: string;
  readonly capabilities: RuntimeCapabilities;
};

export type RuntimeSnapshot = {
  readonly status: RuntimeStatus;
  readonly capabilities: RuntimeCapabilities;
  readonly session: RuntimeSessionSummary | null;
  readonly lastCheck?: RuntimeCheckResult;
  readonly lastError?: RuntimeError;
  readonly updatedAt: number;
};

export interface RuntimeSession {
  readonly id: string;
  readonly kind: RuntimeKind;
  readonly status: "running";
  readonly sessionKey?: string;
  readonly capabilities: RuntimeCapabilities;
  readonly ref: RuntimeSessionRef;

  onEvent(listener: RuntimeSessionEventListener): Unsubscribe;
}

export interface RuntimeManager {
  readonly status: RuntimeStatus;
  readonly capabilities: RuntimeCapabilities;
  readonly currentSession: RuntimeSession | null;

  check?(options?: RuntimeCheckOptions): Promise<RuntimeCheckResult>;
  boot(options?: RuntimeBootOptions): Promise<RuntimeSession>;
  stop(options?: RuntimeStopOptions): Promise<RuntimeActionResult>;
  getSnapshot(): RuntimeSnapshot;
  onEvent(listener: RuntimeEventListener): Unsubscribe;
}

export type Unsubscribe = () => void;

export type RuntimeEvent =
  | { readonly type: "runtime-status"; readonly status: RuntimeStatus }
  | { readonly type: "runtime-check"; readonly result: RuntimeCheckResult }
  | { readonly type: "runtime-session-created"; readonly session: RuntimeSessionSummary }
  | { readonly type: "runtime-session-stopped"; readonly sessionId: string }
  | { readonly type: "runtime-capabilities"; readonly capabilities: RuntimeCapabilities }
  | { readonly type: "runtime-error"; readonly error: RuntimeError };

export type RuntimeEventListener = (event: RuntimeEvent) => void;

export type RuntimeSessionEvent =
  | {
      readonly type: "runtime-session-status";
      readonly sessionId: string;
      readonly status: "running" | "stopped" | "failed";
    }
  | {
      readonly type: "runtime-session-capabilities";
      readonly sessionId: string;
      readonly capabilities: RuntimeCapabilities;
    }
  | { readonly type: "runtime-session-error"; readonly sessionId: string; readonly error: RuntimeError };

export type RuntimeSessionEventListener = (event: RuntimeSessionEvent) => void;
