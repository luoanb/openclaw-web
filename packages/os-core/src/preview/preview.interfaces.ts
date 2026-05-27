import type { RuntimeSession, Unsubscribe } from "../runtime";
import type { ServicePreviewError } from "./preview.errors";

export type ServicePreviewSource = "portal" | "manual" | "terminal-output";

export type ServicePreviewEntryStatus = "discovered" | "selected" | "loading" | "ready" | "failed" | "cleared";

export type ServicePreviewEntry = {
  readonly id: string;
  readonly url: string;
  readonly port?: number;
  readonly label: string;
  readonly source: ServicePreviewSource;
  readonly status: ServicePreviewEntryStatus;
  readonly discoveredAt: number;
  readonly lastOpenedAt?: number;
  readonly lastError?: ServicePreviewError;
};

export type ServicePreviewSnapshot = {
  readonly runtimeSessionId: string;
  readonly entries: readonly ServicePreviewEntry[];
  readonly selectedEntryId: string | null;
  readonly updatedAt: number;
};

export type ServicePreviewActionFailureReason = "not-found" | "invalid-url" | "unsupported" | "failed";

export type ServicePreviewActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: ServicePreviewActionFailureReason;
      readonly error: ServicePreviewError;
    };

export type ServicePreviewEvent =
  | { readonly type: "service-preview-entry-discovered"; readonly entry: ServicePreviewEntry }
  | { readonly type: "service-preview-entry-updated"; readonly entry: ServicePreviewEntry }
  | { readonly type: "service-preview-entry-cleared"; readonly entryId: string }
  | { readonly type: "service-preview-selection"; readonly entryId: string | null }
  | { readonly type: "service-preview-error"; readonly error: ServicePreviewError };

export type ServicePreviewEventListener = (event: ServicePreviewEvent) => void;

export type AddServicePreviewEntryInput = {
  readonly url: string;
  readonly port?: number;
  readonly label?: string;
  readonly source: ServicePreviewSource;
};

export interface ServicePreviewService {
  attach(runtimeSession: RuntimeSession): Promise<ServicePreviewSession>;
}

export interface ServicePreviewSession {
  readonly runtimeSessionId: string;

  addManualUrl(url: string): ServicePreviewActionResult;
  addDiscoveredEntry(input: AddServicePreviewEntryInput): ServicePreviewActionResult;
  select(entryId: string): ServicePreviewActionResult;
  markLoading(entryId: string): ServicePreviewActionResult;
  markReady(entryId: string): ServicePreviewActionResult;
  markFailed(entryId: string, error: ServicePreviewError): ServicePreviewActionResult;
  clear(entryId: string): ServicePreviewActionResult;
  clearAll(): ServicePreviewActionResult;
  getSnapshot(): ServicePreviewSnapshot;
  onEvent(listener: ServicePreviewEventListener): Unsubscribe;
  close(): ServicePreviewActionResult;
}
