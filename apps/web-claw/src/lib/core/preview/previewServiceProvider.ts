import { BrowserPodPreviewDiscoveryService } from "browserpod";
import type { PreviewTargetDiscoveryService } from "os-core";
import { RuntimeManagerProvider } from "$lib/core/runtime";

export class PreviewServiceProvider {
  private static service: PreviewTargetDiscoveryService | null = null;

  static getPreviewDiscoveryService(): PreviewTargetDiscoveryService {
    PreviewServiceProvider.service ??= new BrowserPodPreviewDiscoveryService(
      RuntimeManagerProvider.getBrowserPodRuntimeManager(),
    );

    return PreviewServiceProvider.service;
  }
}
