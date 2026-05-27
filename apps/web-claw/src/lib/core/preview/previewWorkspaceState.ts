import {
  ServicePreviewState,
  type RuntimeManager,
  type ServicePreviewActionResult,
  type ServicePreviewError,
  type ServicePreviewService,
  type ServicePreviewSession,
  type ServicePreviewSnapshot,
  type Unsubscribe,
} from "os-core";

export type PreviewWorkspaceSnapshot = {
  readonly runtimeStatus: ReturnType<RuntimeManager["getSnapshot"]>["status"];
  readonly preview: ServicePreviewSnapshot | null;
  readonly errorMessage: string | null;
  readonly portalUnavailable: boolean;
};

export type PreviewWorkspaceListener = (snapshot: PreviewWorkspaceSnapshot) => void;

export class PreviewWorkspaceState {
  private readonly listeners = new Set<PreviewWorkspaceListener>();
  private runtimeUnsubscribe: Unsubscribe | null = null;
  private previewUnsubscribe: Unsubscribe | null = null;
  private previewSession: ServicePreviewSession | null = null;
  private attachedRuntimeSessionId: string | null = null;
  private errorMessage: string | null = null;
  private portalUnavailable = false;

  constructor(
    private readonly runtimeManager: RuntimeManager,
    private readonly previewService: ServicePreviewService,
  ) {}

  start(): Unsubscribe {
    this.runtimeUnsubscribe = this.runtimeManager.onEvent(() => {
      void this.syncWithRuntime();
    });
    void this.syncWithRuntime();

    return () => {
      this.stop();
    };
  }

  stop(): void {
    this.runtimeUnsubscribe?.();
    this.runtimeUnsubscribe = null;
    this.detachPreview();
    this.listeners.clear();
  }

  subscribe(listener: PreviewWorkspaceListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): PreviewWorkspaceSnapshot {
    return {
      runtimeStatus: this.runtimeManager.getSnapshot().status,
      preview: this.previewSession?.getSnapshot() ?? null,
      errorMessage: this.errorMessage,
      portalUnavailable: this.portalUnavailable,
    };
  }

  addManualUrl(url: string): ServicePreviewActionResult {
    const session = this.ensurePreviewSession();
    const result = session.addManualUrl(url);
    this.notify();
    return result;
  }

  select(entryId: string): ServicePreviewActionResult {
    const result = this.ensurePreviewSession().select(entryId);
    this.notify();
    return result;
  }

  markLoading(entryId: string): ServicePreviewActionResult {
    const result = this.ensurePreviewSession().markLoading(entryId);
    this.notify();
    return result;
  }

  markReady(entryId: string): ServicePreviewActionResult {
    const result = this.ensurePreviewSession().markReady(entryId);
    this.notify();
    return result;
  }

  markFailed(entryId: string, error: ServicePreviewError): ServicePreviewActionResult {
    const result = this.ensurePreviewSession().markFailed(entryId, error);
    this.notify();
    return result;
  }

  clear(entryId: string): ServicePreviewActionResult {
    const result = this.ensurePreviewSession().clear(entryId);
    this.notify();
    return result;
  }

  private async syncWithRuntime(): Promise<void> {
    const currentSession = this.runtimeManager.currentSession;
    if (this.runtimeManager.status !== "running" || !currentSession) {
      this.detachPreview();
      this.notify();
      return;
    }

    if (this.attachedRuntimeSessionId === currentSession.id && this.previewSession) {
      this.notify();
      return;
    }

    this.detachPreview();
    this.errorMessage = null;
    this.portalUnavailable = false;
    try {
      this.previewSession = await this.previewService.attach(currentSession);
    } catch (error) {
      this.portalUnavailable = true;
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.previewSession = new ServicePreviewState({ runtimeSessionId: currentSession.id });
    }
    this.attachedRuntimeSessionId = currentSession.id;
    this.previewUnsubscribe = this.previewSession.onEvent(() => {
      this.notify();
    });
    this.notify();
  }

  private detachPreview(): void {
    this.previewUnsubscribe?.();
    this.previewUnsubscribe = null;
    this.previewSession?.close();
    this.previewSession = null;
    this.attachedRuntimeSessionId = null;
  }

  private ensurePreviewSession(): ServicePreviewSession {
    if (this.previewSession) return this.previewSession;

    const currentSession = this.runtimeManager.currentSession;
    const runtimeSessionId = currentSession?.id ?? "manual-preview";
    this.previewSession = new ServicePreviewState({ runtimeSessionId });
    this.attachedRuntimeSessionId = runtimeSessionId;
    this.previewUnsubscribe = this.previewSession.onEvent(() => {
      this.notify();
    });
    return this.previewSession;
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
