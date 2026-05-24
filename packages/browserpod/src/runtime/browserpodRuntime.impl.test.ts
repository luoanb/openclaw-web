import { describe, expect, it, vi } from "vitest";
import { RuntimeContractError } from "os-core";
import { BrowserPodRuntimeManager } from "./browserpodRuntime.impl";
import type { BrowserPodBooter, BrowserPodRuntimeConfig } from "./browserpodRuntime.interfaces";

function createConfig(overrides: Partial<BrowserPodRuntimeConfig> = {}): BrowserPodRuntimeConfig {
  return {
    apiKeyProvider: () => "test-api-key",
    storageKeyResolver: () => "test-storage-key",
    environment: {
      isCrossOriginIsolated: () => true,
    },
    booter: {
      boot: vi.fn(async () => ({ run: vi.fn() })),
    },
    ...overrides,
  };
}

describe("BrowserPodRuntimeManager", () => {
  it("checks BrowserPod prerequisites without booting", async () => {
    const booter: BrowserPodBooter = {
      boot: vi.fn(async () => ({ run: vi.fn() })),
    };
    const manager = new BrowserPodRuntimeManager(createConfig({ booter }));

    const result = await manager.check();

    expect(result).toEqual({ ok: true, status: "supported", issues: [] });
    expect(manager.status).toBe("supported");
    expect(booter.boot).not.toHaveBeenCalled();
  });

  it("reports cross-origin isolation as unsupported", async () => {
    const manager = new BrowserPodRuntimeManager(
      createConfig({
        environment: {
          isCrossOriginIsolated: () => false,
        },
      }),
    );

    const result = await manager.check();

    expect(result.ok).toBe(false);
    expect(result.status).toBe("unsupported");
    expect(manager.status).toBe("unsupported");
    expect(result.issues[0]?.code).toBe("isolation-unavailable");
  });

  it("boots BrowserPod and reuses the running session for the same context", async () => {
    const boot = vi.fn(async () => ({ run: vi.fn() }));
    const manager = new BrowserPodRuntimeManager(createConfig({ booter: { boot } }));

    const first = await manager.boot({ sessionKey: "app-open" });
    const second = await manager.boot({ sessionKey: "app-open" });

    expect(first).toBe(second);
    expect(boot).toHaveBeenCalledTimes(1);
    expect(manager.status).toBe("running");
    expect(manager.getSnapshot().session?.id).toBe(first.id);
  });

  it("maps missing API key check to failed runtime status", async () => {
    const manager = new BrowserPodRuntimeManager(
      createConfig({
        apiKeyProvider: () => "",
      }),
    );

    const result = await manager.check();

    expect(result.ok).toBe(false);
    expect(result.status).toBe("misconfigured");
    expect(manager.status).toBe("failed");
    expect(result.issues[0]?.code).toBe("auth-missing");
  });

  it("maps missing API key to runtime contract error", async () => {
    const manager = new BrowserPodRuntimeManager(
      createConfig({
        apiKeyProvider: () => "",
      }),
    );

    await expect(manager.boot()).rejects.toBeInstanceOf(RuntimeContractError);
    expect(manager.status).toBe("failed");
    expect(manager.getSnapshot().lastError?.code).toBe("auth-missing");
  });

  it("stops by invalidating the current session and adapter reference", async () => {
    const manager = new BrowserPodRuntimeManager(createConfig());
    const session = await manager.boot();

    expect(manager.resolvePod(session)).not.toBeNull();

    const result = await manager.stop();

    expect(result).toEqual({ ok: true });
    expect(manager.status).toBe("stopped");
    expect(manager.currentSession).toBeNull();
    expect(manager.resolvePod(session)).toBeNull();
  });
});
