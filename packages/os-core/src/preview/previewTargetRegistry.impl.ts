import type { Unsubscribe } from "../runtime";
import type { PreviewTargetError } from "./preview.errors";
import type {
  PreviewTarget,
  PreviewTargetActionResult,
  PreviewTargetInput,
  PreviewTargetRegistry,
  PreviewTargetRegistryEvent,
  PreviewTargetRegistryEventListener,
  PreviewTargetRegistrySnapshot,
} from "./preview.interfaces";

export type PreviewTargetRegistryStateOptions = {
  readonly runtimeSessionId: string;
  readonly now?: () => number;
  readonly createId?: () => string;
};

/**
 * Runtime-agnostic registry for discovered preview targets.
 *
 * It only stores service-address facts. User selection and iframe render
 * status belong to the application layer.
 */
export class PreviewTargetRegistryState implements PreviewTargetRegistry {
  readonly runtimeSessionId: string;
  private readonly listeners = new Set<PreviewTargetRegistryEventListener>();
  private readonly now: () => number;
  private readonly createId: () => string;
  private targets: PreviewTarget[] = [];
  private updatedAt: number;

  constructor(options: PreviewTargetRegistryStateOptions) {
    this.runtimeSessionId = options.runtimeSessionId;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? createPreviewTargetId;
    this.updatedAt = this.now();
  }

  addTarget(input: PreviewTargetInput): PreviewTargetActionResult {
    const normalized = PreviewTargetUrl.normalize(input.url);
    if (!normalized.ok) {
      return this.fail("invalid-url", normalized.error);
    }

    const now = this.now();
    const existing = this.targets.find((target) => target.url === normalized.url);
    if (existing) {
      const target: PreviewTarget = {
        ...existing,
        port: input.port ?? existing.port,
        label: input.label ?? (input.port ? `Port ${input.port}` : existing.label),
        source: input.source,
        discoveredAt: now,
        metadata: input.metadata ?? existing.metadata,
      };
      this.targets = this.targets.map((candidate) => candidate.id === existing.id ? target : candidate);
      this.touch();
      this.emit({ type: "preview-target-updated", target });
      return { ok: true, target };
    }

    const target: PreviewTarget = {
      id: this.createId(),
      url: normalized.url,
      port: input.port,
      label: input.label ?? (input.port ? `Port ${input.port}` : PreviewTargetUrl.labelFromUrl(normalized.url)),
      source: input.source,
      discoveredAt: now,
      metadata: input.metadata,
    };
    this.targets = [...this.targets, target];
    this.touch();
    this.emit({ type: "preview-target-added", target });
    return { ok: true, target };
  }

  removeTarget(targetId: string): PreviewTargetActionResult {
    const target = this.targets.find((candidate) => candidate.id === targetId);
    if (!target) return this.notFound(targetId);

    this.targets = this.targets.filter((candidate) => candidate.id !== targetId);
    this.touch();
    this.emit({ type: "preview-target-removed", targetId });
    return { ok: true, target };
  }

  clearTargets(): PreviewTargetActionResult {
    const removedTargets = this.targets;
    this.targets = [];
    this.touch();
    for (const target of removedTargets) {
      this.emit({ type: "preview-target-removed", targetId: target.id });
    }
    return { ok: true };
  }

  getSnapshot(): PreviewTargetRegistrySnapshot {
    return {
      runtimeSessionId: this.runtimeSessionId,
      targets: [...this.targets].sort((a, b) => b.discoveredAt - a.discoveredAt),
      updatedAt: this.updatedAt,
    };
  }

  onEvent(listener: PreviewTargetRegistryEventListener): Unsubscribe {
    this.listeners.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
    };
  }

  private fail(reason: "invalid-url" | "failed", error: PreviewTargetError): PreviewTargetActionResult {
    this.emit({ type: "preview-target-registry-error", error });
    return { ok: false, reason, error };
  }

  private notFound(targetId: string): PreviewTargetActionResult {
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

  private touch(): void {
    this.updatedAt = this.now();
  }

  private emit(event: PreviewTargetRegistryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export class PreviewTargetUrl {
  static normalize(input: string):
    | { readonly ok: true; readonly url: string }
    | { readonly ok: false; readonly error: PreviewTargetError } {
    try {
      const url = new URL(input.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return {
          ok: false,
          error: {
            code: "invalid-url",
            message: "Only http and https preview target URLs are supported.",
            recoverable: true,
          },
        };
      }
      if (PreviewTargetUrl.isLocalhost(url)) {
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
          message: "Enter a valid http or https preview target URL.",
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

function createPreviewTargetId(): string {
  return `preview-target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
