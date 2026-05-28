import { describe, expect, it, vi } from "vitest";
import { PreviewTargetRegistryState } from "os-core";
import { BrowserPodPreviewDiscoveryService } from "./browserpodPreviewDiscovery.impl";
import { BrowserPodRuntimeManager } from "../runtime/browserpodRuntime.impl";
import type { BrowserPodOnPortal, BrowserPodPortalEvent, BrowserPodRuntimeConfig } from "../runtime/browserpodRuntime.interfaces";

function createConfig(onPortal?: BrowserPodOnPortal): BrowserPodRuntimeConfig {
  return {
    apiKeyProvider: () => "test-api-key",
    storageKeyResolver: () => "test-storage-key",
    environment: {
      isCrossOriginIsolated: () => true,
    },
    booter: {
      boot: vi.fn(async () => ({ run: vi.fn(), onPortal })),
    },
    injection: false,
  };
}

describe("BrowserPodPreviewDiscoveryService", () => {
  it("turns BrowserPod portal callbacks into preview targets", async () => {
    let callback: (event: BrowserPodPortalEvent) => void = () => undefined;
    const onPortal: BrowserPodOnPortal = vi.fn((nextCallback) => {
      callback = nextCallback;
    });
    const manager = new BrowserPodRuntimeManager(createConfig(onPortal));
    const runtimeSession = await manager.boot();
    const registry = new PreviewTargetRegistryState({ runtimeSessionId: runtimeSession.id });
    const service = new BrowserPodPreviewDiscoveryService(manager);

    await service.attach(runtimeSession, registry);
    callback({ url: "https://portal.example.test/", port: 5173 });

    expect(onPortal).toHaveBeenCalledTimes(1);
    expect(registry.getSnapshot().targets[0]).toMatchObject({
      url: "https://portal.example.test/",
      port: 5173,
      label: "Port 5173",
      source: "portal",
    });
  });

  it("deduplicates repeated portal callbacks through the registry", async () => {
    let callback: (event: BrowserPodPortalEvent) => void = () => undefined;
    const manager = new BrowserPodRuntimeManager(
      createConfig((nextCallback) => {
        callback = nextCallback;
      }),
    );
    const runtimeSession = await manager.boot();
    const registry = new PreviewTargetRegistryState({ runtimeSessionId: runtimeSession.id });
    await new BrowserPodPreviewDiscoveryService(manager).attach(runtimeSession, registry);

    callback({ url: "https://portal.example.test", port: 5173 });
    callback({ url: "https://portal.example.test/", port: 5174 });

    expect(registry.getSnapshot().targets).toHaveLength(1);
    expect(registry.getSnapshot().targets[0]?.port).toBe(5174);
  });

  it("throws a contract error when the portal API is unavailable", async () => {
    const manager = new BrowserPodRuntimeManager(createConfig(undefined));
    const runtimeSession = await manager.boot();
    const registry = new PreviewTargetRegistryState({ runtimeSessionId: runtimeSession.id });

    await expect(new BrowserPodPreviewDiscoveryService(manager).attach(runtimeSession, registry)).rejects.toMatchObject({
      error: { code: "portal-api-unavailable" },
    });
  });

  it("ignores stale portal callbacks after attachment close", async () => {
    let callback: (event: BrowserPodPortalEvent) => void = () => undefined;
    const manager = new BrowserPodRuntimeManager(
      createConfig((nextCallback) => {
        callback = nextCallback;
      }),
    );
    const runtimeSession = await manager.boot();
    const registry = new PreviewTargetRegistryState({ runtimeSessionId: runtimeSession.id });
    const attachment = await new BrowserPodPreviewDiscoveryService(manager).attach(runtimeSession, registry);

    attachment.close();
    callback({ url: "https://portal.example.test/", port: 5173 });

    expect(registry.getSnapshot().targets).toHaveLength(0);
  });
});
