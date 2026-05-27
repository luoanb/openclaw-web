import { describe, expect, it, vi } from "vitest";
import { BrowserPodServicePreviewService } from "./browserpodServicePreview.impl";
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
  };
}

describe("BrowserPodServicePreviewService", () => {
  it("turns BrowserPod portal callbacks into service preview entries", async () => {
    let callback: (event: BrowserPodPortalEvent) => void = () => undefined;
    const onPortal: BrowserPodOnPortal = vi.fn((nextCallback) => {
      callback = nextCallback;
    });
    const manager = new BrowserPodRuntimeManager(createConfig(onPortal));
    const runtimeSession = await manager.boot();
    const service = new BrowserPodServicePreviewService(manager);

    const previewSession = await service.attach(runtimeSession);
    callback?.({ url: "https://portal.example.test/", port: 5173 });

    expect(onPortal).toHaveBeenCalledTimes(1);
    expect(previewSession.getSnapshot().entries[0]).toMatchObject({
      url: "https://portal.example.test/",
      port: 5173,
      label: "Port 5173",
      source: "portal",
    });
  });

  it("deduplicates repeated portal callbacks", async () => {
    let callback: (event: BrowserPodPortalEvent) => void = () => undefined;
    const manager = new BrowserPodRuntimeManager(
      createConfig((nextCallback) => {
        callback = nextCallback;
      }),
    );
    const runtimeSession = await manager.boot();
    const previewSession = await new BrowserPodServicePreviewService(manager).attach(runtimeSession);

    callback?.({ url: "https://portal.example.test", port: 5173 });
    callback?.({ url: "https://portal.example.test/", port: 5174 });

    expect(previewSession.getSnapshot().entries).toHaveLength(1);
    expect(previewSession.getSnapshot().entries[0]?.port).toBe(5174);
  });

  it("throws a contract error when the portal API is unavailable", async () => {
    const manager = new BrowserPodRuntimeManager(createConfig(undefined));
    const runtimeSession = await manager.boot();

    await expect(new BrowserPodServicePreviewService(manager).attach(runtimeSession)).rejects.toMatchObject({
      error: { code: "portal-api-unavailable" },
    });
  });

  it("ignores stale portal callbacks after close", async () => {
    let callback: (event: BrowserPodPortalEvent) => void = () => undefined;
    const manager = new BrowserPodRuntimeManager(
      createConfig((nextCallback) => {
        callback = nextCallback;
      }),
    );
    const runtimeSession = await manager.boot();
    const previewSession = await new BrowserPodServicePreviewService(manager).attach(runtimeSession);

    previewSession.close();
    callback?.({ url: "https://portal.example.test/", port: 5173 });

    expect(previewSession.getSnapshot().entries).toHaveLength(0);
  });
});
