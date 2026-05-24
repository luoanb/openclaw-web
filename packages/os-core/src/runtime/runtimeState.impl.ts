import type { RuntimeError } from "./runtime.errors";
import {
  UNKNOWN_RUNTIME_CAPABILITIES,
  type RuntimeCapabilities,
  type RuntimeCheckResult,
  type RuntimeEvent,
  type RuntimeEventListener,
  type RuntimeSession,
  type RuntimeSessionSummary,
  type RuntimeSnapshot,
  type RuntimeStatus,
  type Unsubscribe,
} from "./runtime.interfaces";

export type RuntimeStateMachineOptions = {
  readonly capabilities?: RuntimeCapabilities;
  readonly now?: () => number;
};

/**
 * Small reusable state holder for runtime adapters.
 *
 * It does not boot or stop a concrete runtime; adapters own those effects and
 * use this class to keep status, snapshot and listener semantics consistent.
 */
export class RuntimeStateMachine {
  private readonly listeners = new Set<RuntimeEventListener>();
  private readonly now: () => number;
  private snapshot: RuntimeSnapshot;
  private session: RuntimeSession | null = null;

  constructor(options: RuntimeStateMachineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.snapshot = {
      status: "idle",
      capabilities: options.capabilities ?? UNKNOWN_RUNTIME_CAPABILITIES,
      session: null,
      updatedAt: this.now(),
    };
  }

  get status(): RuntimeStatus {
    return this.snapshot.status;
  }

  get capabilities(): RuntimeCapabilities {
    return this.snapshot.capabilities;
  }

  get currentSession(): RuntimeSession | null {
    return this.session;
  }

  getSnapshot(): RuntimeSnapshot {
    return { ...this.snapshot };
  }

  onEvent(listener: RuntimeEventListener): Unsubscribe {
    this.listeners.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
    };
  }

  setStatus(status: RuntimeStatus): void {
    this.updateSnapshot({ status });
    this.emit({ type: "runtime-status", status });
  }

  setCapabilities(capabilities: RuntimeCapabilities): void {
    this.updateSnapshot({ capabilities });
    this.emit({ type: "runtime-capabilities", capabilities });
  }

  setCheckResult(result: RuntimeCheckResult): void {
    const status = RuntimeStateMachine.statusFromCheckResult(result);
    const statusChanged = status !== this.snapshot.status;
    this.updateSnapshot({ lastCheck: result, status });
    this.emit({ type: "runtime-check", result });
    if (statusChanged) {
      this.emit({ type: "runtime-status", status });
    }
  }

  setError(error: RuntimeError, status: RuntimeStatus = "failed"): void {
    this.updateSnapshot({ lastError: error, status });
    this.emit({ type: "runtime-error", error });
    this.emit({ type: "runtime-status", status });
  }

  setSession(session: RuntimeSession): RuntimeSessionSummary {
    this.session = session;
    const summary = sessionToSummary(session);
    this.updateSnapshot({
      status: "running",
      capabilities: session.capabilities,
      session: summary,
      lastError: undefined,
    });
    this.emit({ type: "runtime-session-created", session: summary });
    this.emit({ type: "runtime-status", status: "running" });
    return summary;
  }

  clearSession(status: RuntimeStatus = "stopped"): void {
    const sessionId = this.session?.id ?? this.snapshot.session?.id;
    this.session = null;
    this.updateSnapshot({ status, session: null });

    if (sessionId) {
      this.emit({ type: "runtime-session-stopped", sessionId });
    }
    this.emit({ type: "runtime-status", status });
  }

  private updateSnapshot(patch: Partial<RuntimeSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      updatedAt: this.now(),
    };
  }

  private emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private static statusFromCheckResult(result: RuntimeCheckResult): RuntimeStatus {
    if (result.status === "supported") return "supported";
    if (result.status === "unsupported") return "unsupported";
    return "failed";
  }
}

export function sessionToSummary(session: RuntimeSession): RuntimeSessionSummary {
  return {
    id: session.id,
    kind: session.kind,
    status: session.status,
    sessionKey: session.sessionKey,
    capabilities: session.capabilities,
  };
}
