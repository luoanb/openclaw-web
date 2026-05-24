import type {
  RuntimeCapabilities,
  RuntimeKind,
  RuntimeSession,
  RuntimeSessionEvent,
  RuntimeSessionEventListener,
  RuntimeSessionRef,
  RuntimeSessionSummary,
  Unsubscribe,
} from "./runtime.interfaces";

export type RuntimeSessionStateOptions = {
  readonly id: string;
  readonly kind: RuntimeKind;
  readonly capabilities: RuntimeCapabilities;
  readonly sessionKey?: string;
  readonly ref?: RuntimeSessionRef;
};

export class RuntimeSessionState implements RuntimeSession {
  readonly id: string;
  readonly kind: RuntimeKind;
  readonly status = "running";
  readonly sessionKey?: string;
  readonly capabilities: RuntimeCapabilities;
  readonly ref: RuntimeSessionRef;

  private readonly listeners = new Set<RuntimeSessionEventListener>();

  constructor(options: RuntimeSessionStateOptions) {
    this.id = options.id;
    this.kind = options.kind;
    this.sessionKey = options.sessionKey;
    this.capabilities = options.capabilities;
    this.ref = options.ref ?? {
      kind: options.kind,
      sessionId: options.id,
      token: {},
    };
  }

  onEvent(listener: RuntimeSessionEventListener): Unsubscribe {
    this.listeners.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
    };
  }

  emit(event: RuntimeSessionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  toSummary(status: RuntimeSessionSummary["status"] = "running"): RuntimeSessionSummary {
    return {
      id: this.id,
      kind: this.kind,
      status,
      sessionKey: this.sessionKey,
      capabilities: this.capabilities,
    };
  }
}
