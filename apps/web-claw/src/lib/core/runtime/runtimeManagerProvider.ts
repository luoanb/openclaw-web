import { BrowserPodRuntimeManager } from "browserpod";
import type { RuntimeManager } from "os-core";

const DEFAULT_STORAGE_KEY = "web-claw-runtime-default";

export class RuntimeManagerProvider {
  private static manager: BrowserPodRuntimeManager | null = null;

  static getRuntimeManager(): RuntimeManager {
    return RuntimeManagerProvider.getBrowserPodRuntimeManager();
  }

  static getBrowserPodRuntimeManager(): BrowserPodRuntimeManager {
    RuntimeManagerProvider.manager ??= new BrowserPodRuntimeManager({
      apiKeyProvider: () => import.meta.env.VITE_BP_APIKEY ?? "",
      storageKeyResolver: () => DEFAULT_STORAGE_KEY,
    });

    return RuntimeManagerProvider.manager;
  }
}
