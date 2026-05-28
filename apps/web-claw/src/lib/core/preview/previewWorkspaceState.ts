import {
  PreviewTargetRegistryState,
  type RuntimeManager,
  type PreviewDiscoveryAttachment,
  type PreviewTarget,
  type PreviewTargetActionResult,
  type PreviewTargetDiscoveryService,
  type PreviewTargetRegistry,
  type PreviewTargetRegistrySnapshot,
  type Unsubscribe,
} from "os-core";

export type PreviewRenderError = {
  readonly code: "iframe-load-failed" | "iframe-blocked" | "unknown";
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
};

export type PreviewRenderStatus = "idle" | "loading" | "ready" | "failed" | "blocked";

export type PreviewSelectionState = {
  readonly selectedTargetId: string | null;
  readonly lastSelectedAt?: number;
};

export type PreviewRenderState = {
  readonly targetId: string | null;
  readonly status: PreviewRenderStatus;
  readonly error?: PreviewRenderError;
  readonly updatedAt: number;
};

export type PreviewWorkspaceSnapshot = {
  readonly runtimeStatus: ReturnType<RuntimeManager["getSnapshot"]>["status"];
  readonly registry: PreviewTargetRegistrySnapshot | null;
  readonly selection: PreviewSelectionState;
  readonly render: PreviewRenderState;
  readonly errorMessage: string | null;
  readonly portalUnavailable: boolean;
};

export type PreviewWorkspaceListener = (snapshot: PreviewWorkspaceSnapshot) => void;

export class PreviewWorkspaceState {
  private readonly listeners = new Set<PreviewWorkspaceListener>();
  private runtimeUnsubscribe: Unsubscribe | null = null;
  private registryUnsubscribe: Unsubscribe | null = null;
  private discoveryAttachment: PreviewDiscoveryAttachment | null = null;
  private registry: PreviewTargetRegistry | null = null;
  private attachedRuntimeSessionId: string | null = null;
  private selection: PreviewSelectionState = { selectedTargetId: null };
  private render: PreviewRenderState = { targetId: null, status: "idle", updatedAt: Date.now() };
  private errorMessage: string | null = null;
  private portalUnavailable = false;

  constructor(
    private readonly runtimeManager: RuntimeManager,
    private readonly discoveryService: PreviewTargetDiscoveryService,
    private readonly now: () => number = Date.now,
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
      registry: this.registry?.getSnapshot() ?? null,
      selection: this.selection,
      render: this.render,
      errorMessage: this.errorMessage,
      portalUnavailable: this.portalUnavailable,
    };
  }

  addManualUrl(url: string): PreviewTargetActionResult {
    const registry = this.ensureRegistry();
    const result = registry.addTarget({ url, source: "manual" });
    if (result.ok && result.target) {
      this.select(result.target.id);
    }
    this.notify();
    return result;
  }

  select(targetId: string): PreviewTargetActionResult {
    const target = this.findTarget(targetId);
    if (!target) return this.targetNotFound(targetId);

    this.selection = { selectedTargetId: targetId, lastSelectedAt: this.now() };
    this.render = { targetId, status: "loading", updatedAt: this.now() };
    this.notify();
    return { ok: true, target };
  }

  markLoading(targetId: string): PreviewTargetActionResult {
    const target = this.findTarget(targetId);
    if (!target) return this.targetNotFound(targetId);

    this.render = { targetId, status: "loading", updatedAt: this.now() };
    this.notify();
    return { ok: true, target };
  }

  markReady(targetId: string): PreviewTargetActionResult {
    const target = this.findTarget(targetId);
    if (!target) return this.targetNotFound(targetId);

    this.render = { targetId, status: "ready", updatedAt: this.now() };
    this.notify();
    return { ok: true, target };
  }

  markFailed(targetId: string, error: PreviewRenderError): PreviewTargetActionResult {
    const target = this.findTarget(targetId);
    if (!target) return this.targetNotFound(targetId);

    this.render = { targetId, status: "failed", error, updatedAt: this.now() };
    this.notify();
    return { ok: true, target };
  }

  clear(targetId: string): PreviewTargetActionResult {
    const registry = this.ensureRegistry();
    const result = registry.removeTarget(targetId);
    if (result.ok && this.selection.selectedTargetId === targetId) {
      const nextTarget = registry.getSnapshot().targets[0] ?? null;
      this.selection = { selectedTargetId: nextTarget?.id ?? null, lastSelectedAt: nextTarget ? this.now() : undefined };
      this.render = {
        targetId: nextTarget?.id ?? null,
        status: nextTarget ? "loading" : "idle",
        updatedAt: this.now(),
      };
    }
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

    if (this.attachedRuntimeSessionId === currentSession.id && this.registry) {
      this.notify();
      return;
    }

    this.detachPreview();
    this.errorMessage = null;
    this.portalUnavailable = false;
    this.registry = new PreviewTargetRegistryState({ runtimeSessionId: currentSession.id });
    this.registryUnsubscribe = this.registry.onEvent(() => {
      this.ensureSelection();
      this.notify();
    });
    try {
      this.discoveryAttachment = await this.discoveryService.attach(currentSession, this.registry);
    } catch (error) {
      this.portalUnavailable = true;
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.attachedRuntimeSessionId = currentSession.id;
    this.notify();
  }

  private detachPreview(): void {
    this.discoveryAttachment?.close();
    this.discoveryAttachment = null;
    this.registryUnsubscribe?.();
    this.registryUnsubscribe = null;
    this.registry = null;
    this.attachedRuntimeSessionId = null;
    this.selection = { selectedTargetId: null };
    this.render = { targetId: null, status: "idle", updatedAt: this.now() };
  }

  private ensureRegistry(): PreviewTargetRegistry {
    if (this.registry) return this.registry;

    const currentSession = this.runtimeManager.currentSession;
    const runtimeSessionId = currentSession?.id ?? "manual-preview";
    this.registry = new PreviewTargetRegistryState({ runtimeSessionId });
    this.attachedRuntimeSessionId = runtimeSessionId;
    this.registryUnsubscribe = this.registry.onEvent(() => {
      this.ensureSelection();
      this.notify();
    });
    return this.registry;
  }

  private ensureSelection(): void {
    const targets = this.registry?.getSnapshot().targets ?? [];
    if (targets.length === 0) {
      this.selection = { selectedTargetId: null };
      this.render = { targetId: null, status: "idle", updatedAt: this.now() };
      return;
    }
    if (this.selection.selectedTargetId && targets.some((target) => target.id === this.selection.selectedTargetId)) {
      return;
    }

    const target = targets[0];
    this.selection = { selectedTargetId: target.id, lastSelectedAt: this.now() };
    this.render = { targetId: target.id, status: "loading", updatedAt: this.now() };
  }

  private findTarget(targetId: string): PreviewTarget | null {
    return this.registry?.getSnapshot().targets.find((target) => target.id === targetId) ?? null;
  }

  private targetNotFound(targetId: string): PreviewTargetActionResult {
    return {
      ok: false,
      reason: "not-found",
      error: {
        code: "unknown",
        message: `Preview target ${targetId} was not found.`,
        recoverable: true,
      },
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
