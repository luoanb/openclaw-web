import type { BrowserPodBooter, BrowserPodBootOptions, BrowserPodLike } from "./browserpodRuntime.interfaces";

type BrowserPodModule = {
  readonly BrowserPod: {
    boot(options: BrowserPodBootOptions): Promise<BrowserPodLike>;
  };
};

export class DefaultBrowserPodBooter implements BrowserPodBooter {
  async boot(options: BrowserPodBootOptions): Promise<BrowserPodLike> {
    const module = (await import("@leaningtech/browserpod")) as BrowserPodModule;
    return module.BrowserPod.boot(options);
  }
}
