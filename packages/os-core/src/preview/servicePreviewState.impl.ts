import type { Unsubscribe } from "../runtime";
import type { ServicePreviewError } from "./preview.errors";
import type {
  AddServicePreviewEntryInput,
  ServicePreviewActionResult,
  ServicePreviewEntry,
  ServicePreviewEntryStatus,
  ServicePreviewEvent,
  ServicePreviewEventListener,
  ServicePreviewSession,
  ServicePreviewSnapshot,
  ServicePreviewSource,
} from "./preview.interfaces";

export type ServicePreviewStateOptions = {
  readonly runtimeSessionId: string;
  readonly now?: () => number;
  readonly createId?: () => string;
};

/**
 * Runtime-agnostic state holder for service preview sessions.
 *
 * Concrete adapters own discovery effects; this class centralizes URL
 * validation, de-duplication, selection and event semantics.
 */
export class ServicePreviewState implements ServicePreviewSession {
  readonly runtimeSessionId: string;
  private readonly listeners = new Set<ServicePreviewEventListener>();
  private readonly now: () => number;
  private readonly createId: () => string;
  private entries: ServicePreviewEntry[] = [];
  private selectedEntryId: string | null = null;
  private updatedAt: number;
  private closed = false;

  constructor(options: ServicePreviewStateOptions) {
    this.runtimeSessionId = options.runtimeSessionId;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? createServicePreviewEntryId;
    this.updatedAt = this.now();
  }

  addManualUrl(url: string): ServicePreviewActionResult {
    const normalized = ServicePreviewUrl.normalize(url);
    if (!normalized.ok) {
      return this.fail("invalid-url", normalized.error);
    }

    return this.addEntry({
      url: normalized.url,
      label: ServicePreviewUrl.labelFromUrl(normalized.url),
      source: "manual",
    }, true);
  }

  addDiscoveredEntry(input: AddServicePreviewEntryInput): ServicePreviewActionResult {
    const normalized = ServicePreviewUrl.normalize(input.url);
    if (!normalized.ok) {
      return this.fail("invalid-url", normalized.error);
    }

    return this.addEntry({
      ...input,
      url: normalized.url,
      label: input.label ?? (input.port ? `Port ${input.port}` : ServicePreviewUrl.labelFromUrl(normalized.url)),
    });
  }

  select(entryId: string): ServicePreviewActionResult {
    return this.updateEntry(entryId, (entry) => ({
      ...entry,
      status: "selected",
      lastOpenedAt: this.now(),
      lastError: undefined,
    }), { select: true });
  }

  markLoading(entryId: string): ServicePreviewActionResult {
    return this.setEntryStatus(entryId, "loading");
  }

  markReady(entryId: string): ServicePreviewActionResult {
    return this.setEntryStatus(entryId, "ready", { lastOpenedAt: this.now(), lastError: undefined });
  }

  markFailed(entryId: string, error: ServicePreviewError): ServicePreviewActionResult {
    return this.updateEntry(entryId, (entry) => ({
      ...entry,
      status: "failed",
      lastError: error,
    }));
  }

  clear(entryId: string): ServicePreviewActionResult {
    const entry = this.entries.find((candidate) => candidate.id === entryId);
    if (!entry) return this.notFound(entryId);

    this.entries = this.entries.filter((candidate) => candidate.id !== entryId);
    if (this.selectedEntryId === entryId) {
      this.selectedEntryId = this.entries[0]?.id ?? null;
      this.emit({ type: "service-preview-selection", entryId: this.selectedEntryId });
    }
    this.touch();
    this.emit({ type: "service-preview-entry-cleared", entryId });
    return { ok: true };
  }

  clearAll(): ServicePreviewActionResult {
    const entryIds = this.entries.map((entry) => entry.id);
    this.entries = [];
    this.selectedEntryId = null;
    this.touch();
    for (const entryId of entryIds) {
      this.emit({ type: "service-preview-entry-cleared", entryId });
    }
    this.emit({ type: "service-preview-selection", entryId: null });
    return { ok: true };
  }

  getSnapshot(): ServicePreviewSnapshot {
    return {
      runtimeSessionId: this.runtimeSessionId,
      entries: [...this.entries].sort((a, b) => this.compareEntries(a, b)),
      selectedEntryId: this.selectedEntryId,
      updatedAt: this.updatedAt,
    };
  }

  onEvent(listener: ServicePreviewEventListener): Unsubscribe {
    this.listeners.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
    };
  }

  close(): ServicePreviewActionResult {
    if (this.closed) return { ok: true };
    this.closed = true;
    this.listeners.clear();
    return { ok: true };
  }

  get isClosed(): boolean {
    return this.closed;
  }

  private addEntry(
    input: {
      readonly url: string;
      readonly port?: number;
      readonly label: string;
      readonly source: ServicePreviewSource;
    },
    select = false,
  ): ServicePreviewActionResult {
    if (this.closed) return { ok: true };

    const existing = this.entries.find((entry) => entry.url === input.url);
    if (existing) {
      return this.updateEntry(existing.id, (entry) => ({
        ...entry,
        port: input.port ?? entry.port,
        label: input.label,
        source: input.source,
        status: select ? "selected" : entry.status,
        discoveredAt: this.now(),
        lastOpenedAt: select ? this.now() : entry.lastOpenedAt,
        lastError: undefined,
      }), { select });
    }

    const now = this.now();
    const entry: ServicePreviewEntry = {
      id: this.createId(),
      url: input.url,
      port: input.port,
      label: input.label,
      source: input.source,
      status: select || this.selectedEntryId === null ? "selected" : "discovered",
      discoveredAt: now,
      lastOpenedAt: select || this.selectedEntryId === null ? now : undefined,
    };
    this.entries = [...this.entries, entry];
    this.touch();
    this.emit({ type: "service-preview-entry-discovered", entry });
    if (entry.status === "selected") {
      this.selectedEntryId = entry.id;
      this.emit({ type: "service-preview-selection", entryId: entry.id });
    }
    return { ok: true };
  }

  private setEntryStatus(
    entryId: string,
    status: ServicePreviewEntryStatus,
    patch: Partial<ServicePreviewEntry> = {},
  ): ServicePreviewActionResult {
    return this.updateEntry(entryId, (entry) => ({ ...entry, ...patch, status }));
  }

  private updateEntry(
    entryId: string,
    update: (entry: ServicePreviewEntry) => ServicePreviewEntry,
    options: { readonly select?: boolean } = {},
  ): ServicePreviewActionResult {
    const index = this.entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) return this.notFound(entryId);

    const nextEntry = update(this.entries[index]);
    this.entries = this.entries.map((entry, currentIndex) => currentIndex === index ? nextEntry : entry);
    if (options.select) {
      this.selectedEntryId = entryId;
      this.emit({ type: "service-preview-selection", entryId });
    }
    this.touch();
    this.emit({ type: "service-preview-entry-updated", entry: nextEntry });
    return { ok: true };
  }

  private fail(reason: "invalid-url" | "failed", error: ServicePreviewError): ServicePreviewActionResult {
    this.emit({ type: "service-preview-error", error });
    return { ok: false, reason, error };
  }

  private notFound(entryId: string): ServicePreviewActionResult {
    return {
      ok: false,
      reason: "not-found",
      error: {
        code: "unknown",
        message: `Service preview entry ${entryId} was not found.`,
        recoverable: true,
      },
    };
  }

  private touch(): void {
    this.updatedAt = this.now();
  }

  private emit(event: ServicePreviewEvent): void {
    if (this.closed) return;
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private compareEntries(a: ServicePreviewEntry, b: ServicePreviewEntry): number {
    if (a.id === this.selectedEntryId && b.id !== this.selectedEntryId) return -1;
    if (b.id === this.selectedEntryId && a.id !== this.selectedEntryId) return 1;
    return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) || b.discoveredAt - a.discoveredAt;
  }
}

export class ServicePreviewUrl {
  static normalize(input: string):
    | { readonly ok: true; readonly url: string }
    | { readonly ok: false; readonly error: ServicePreviewError } {
    try {
      const url = new URL(input.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return {
          ok: false,
          error: {
            code: "invalid-url",
            message: "Only http and https service preview URLs are supported.",
            recoverable: true,
          },
        };
      }
      if (ServicePreviewUrl.isLocalhost(url)) {
        return {
          ok: false,
          error: {
            code: "localhost-url-unresolved",
            message: "Localhost URLs cannot be previewed directly yet. Use the BrowserPod Portal URL.",
            recoverable: true,
          },
        };
      }
      return { ok: true, url: url.toString() };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: "invalid-url",
          message: "Enter a valid http or https service preview URL.",
          recoverable: true,
          cause,
        },
      };
    }
  }

  static labelFromUrl(url: string): string {
    const parsed = new URL(url);
    return parsed.host;
  }

  static sanitizeForLog(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return "[invalid-url]";
    }
  }

  private static isLocalhost(url: URL): boolean {
    return url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "0.0.0.0" ||
      url.hostname === "[::1]";
  }
}

function createServicePreviewEntryId(): string {
  return `service-preview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
