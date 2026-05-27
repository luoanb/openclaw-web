import { BrowserPodServicePreviewService } from "browserpod";
import type { ServicePreviewService } from "os-core";
import { RuntimeManagerProvider } from "$lib/core/runtime";

export class PreviewServiceProvider {
  private static service: ServicePreviewService | null = null;

  static getPreviewService(): ServicePreviewService {
    PreviewServiceProvider.service ??= new BrowserPodServicePreviewService(
      RuntimeManagerProvider.getBrowserPodRuntimeManager(),
    );

    return PreviewServiceProvider.service;
  }
}
