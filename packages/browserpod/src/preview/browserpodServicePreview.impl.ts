import {
  ServicePreviewContractError,
  ServicePreviewState,
  type RuntimeSession,
  type ServicePreviewService,
  type ServicePreviewSession,
} from "os-core";
import { BrowserPodRuntimeManager } from "../runtime/browserpodRuntime.impl";
import type { BrowserPodPortalEvent } from "../runtime/browserpodRuntime.interfaces";

export class BrowserPodServicePreviewService implements ServicePreviewService {
  constructor(private readonly runtimeManager: BrowserPodRuntimeManager) {}

  async attach(runtimeSession: RuntimeSession): Promise<ServicePreviewSession> {
    const pod = this.runtimeManager.resolvePod(runtimeSession);
    if (!pod) {
      throw new ServicePreviewContractError({
        code: "runtime-not-running",
        message: "BrowserPod runtime session is not available.",
        recoverable: true,
      });
    }

    if (typeof pod.onPortal !== "function") {
      throw new ServicePreviewContractError({
        code: "portal-api-unavailable",
        message: "BrowserPod portal API is not available.",
        recoverable: true,
      });
    }

    const session = new BrowserPodServicePreviewSession(runtimeSession.id);
    pod.onPortal((event) => {
      session.handlePortal(event);
    });
    return session;
  }
}

export class BrowserPodServicePreviewSession extends ServicePreviewState {
  constructor(runtimeSessionId: string) {
    super({ runtimeSessionId });
  }

  handlePortal(event: BrowserPodPortalEvent): void {
    if (this.isClosed) return;
    this.addDiscoveredEntry({
      url: event.url,
      port: event.port,
      label: `Port ${event.port}`,
      source: "portal",
    });
  }
}
