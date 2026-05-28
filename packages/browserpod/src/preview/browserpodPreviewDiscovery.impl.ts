import {
  PreviewTargetContractError,
  type PreviewDiscoveryAttachment,
  type PreviewTargetActionResult,
  type PreviewTargetDiscoveryService,
  type PreviewTargetRegistry,
  type RuntimeSession,
} from "os-core";
import { BrowserPodRuntimeManager } from "../runtime/browserpodRuntime.impl";
import type { BrowserPodPortalEvent } from "../runtime/browserpodRuntime.interfaces";

export class BrowserPodPreviewDiscoveryService implements PreviewTargetDiscoveryService {
  constructor(private readonly runtimeManager: BrowserPodRuntimeManager) {}

  async attach(
    runtimeSession: RuntimeSession,
    registry: PreviewTargetRegistry,
  ): Promise<PreviewDiscoveryAttachment> {
    const pod = this.runtimeManager.resolvePod(runtimeSession);
    if (!pod) {
      throw new PreviewTargetContractError({
        code: "runtime-not-running",
        message: "BrowserPod runtime session is not available.",
        recoverable: true,
      });
    }

    if (typeof pod.onPortal !== "function") {
      throw new PreviewTargetContractError({
        code: "portal-api-unavailable",
        message: "BrowserPod portal API is not available.",
        recoverable: true,
      });
    }

    const attachment = new BrowserPodPreviewDiscoveryAttachment(registry);
    pod.onPortal((event) => {
      attachment.handlePortal(event);
    });
    return attachment;
  }
}

export class BrowserPodPreviewDiscoveryAttachment implements PreviewDiscoveryAttachment {
  private closed = false;

  constructor(private readonly registry: PreviewTargetRegistry) {}

  close(): PreviewTargetActionResult {
    this.closed = true;
    return { ok: true };
  }

  handlePortal(event: BrowserPodPortalEvent): void {
    if (this.closed) return;
    this.registry.addTarget({
      url: event.url,
      port: event.port,
      label: `Port ${event.port}`,
      source: "portal",
    });
  }
}
