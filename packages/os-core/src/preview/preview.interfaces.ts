import type { RuntimeSession, Unsubscribe } from "../runtime";
import type { PreviewTargetError } from "./preview.errors";

export type PreviewTargetSource = "portal" | "manual" | "terminal-output";

export type PreviewTarget = {
  readonly id: string;
  readonly url: string;
  readonly port?: number;
  readonly label: string;
  readonly source: PreviewTargetSource;
  readonly discoveredAt: number;
  readonly metadata?: Record<string, unknown>;
};

export type PreviewTargetRegistrySnapshot = {
  readonly runtimeSessionId: string;
  readonly targets: readonly PreviewTarget[];
  readonly updatedAt: number;
};

export type PreviewTargetActionFailureReason = "not-found" | "invalid-url" | "unsupported" | "failed";

export type PreviewTargetActionResult =
  | { readonly ok: true; readonly target?: PreviewTarget }
  | {
      readonly ok: false;
      readonly reason: PreviewTargetActionFailureReason;
      readonly error: PreviewTargetError;
    };

export type PreviewTargetRegistryEvent =
  | { readonly type: "preview-target-added"; readonly target: PreviewTarget }
  | { readonly type: "preview-target-updated"; readonly target: PreviewTarget }
  | { readonly type: "preview-target-removed"; readonly targetId: string }
  | { readonly type: "preview-target-registry-error"; readonly error: PreviewTargetError };

export type PreviewTargetRegistryEventListener = (event: PreviewTargetRegistryEvent) => void;

export type PreviewTargetInput = {
  readonly url: string;
  readonly port?: number;
  readonly label?: string;
  readonly source: PreviewTargetSource;
  readonly metadata?: Record<string, unknown>;
};

export interface PreviewTargetDiscoveryService {
  attach(runtimeSession: RuntimeSession, registry: PreviewTargetRegistry): Promise<PreviewDiscoveryAttachment>;
}

export interface PreviewTargetRegistry {
  readonly runtimeSessionId: string;

  addTarget(input: PreviewTargetInput): PreviewTargetActionResult;
  removeTarget(targetId: string): PreviewTargetActionResult;
  clearTargets(): PreviewTargetActionResult;
  getSnapshot(): PreviewTargetRegistrySnapshot;
  onEvent(listener: PreviewTargetRegistryEventListener): Unsubscribe;
}

export interface PreviewDiscoveryAttachment {
  close(): PreviewTargetActionResult;
}
