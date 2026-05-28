import { describe, expect, it } from "vitest";
import { PreviewTargetRegistryState, PreviewTargetUrl } from "./previewTargetRegistry.impl";

describe("PreviewTargetRegistryState", () => {
  it("adds portal targets without selecting or rendering them", () => {
    let tick = 0;
    const registry = new PreviewTargetRegistryState({
      runtimeSessionId: "runtime-1",
      now: () => ++tick,
      createId: () => "target-1",
    });
    const events: string[] = [];

    registry.onEvent((event) => events.push(event.type));
    const result = registry.addTarget({
      url: "https://preview.example.test/",
      port: 5173,
      source: "portal",
    });

    expect(result).toEqual({
      ok: true,
      target: {
        id: "target-1",
        url: "https://preview.example.test/",
        port: 5173,
        label: "Port 5173",
        source: "portal",
        discoveredAt: 2,
        metadata: undefined,
      },
    });
    expect(registry.getSnapshot()).toMatchObject({
      runtimeSessionId: "runtime-1",
      targets: [
        {
          id: "target-1",
          label: "Port 5173",
          source: "portal",
        },
      ],
    });
    expect(registry.getSnapshot()).not.toHaveProperty("selectedTargetId");
    expect(events).toEqual(["preview-target-added"]);
  });

  it("deduplicates targets by normalized URL", () => {
    let tick = 0;
    let nextId = 0;
    const registry = new PreviewTargetRegistryState({
      runtimeSessionId: "runtime-1",
      now: () => 100 + tick++,
      createId: () => `target-${++nextId}`,
    });

    registry.addTarget({ url: "https://preview.example.test", port: 5173, source: "portal" });
    registry.addTarget({ url: "https://preview.example.test/", port: 5174, source: "portal" });

    const snapshot = registry.getSnapshot();
    expect(snapshot.targets).toHaveLength(1);
    expect(snapshot.targets[0]).toMatchObject({
      id: "target-1",
      port: 5174,
      label: "Port 5174",
    });
  });

  it("rejects localhost URLs", () => {
    const registry = new PreviewTargetRegistryState({ runtimeSessionId: "runtime-1" });

    const result = registry.addTarget({ url: "http://localhost:5173", source: "manual" });

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-url",
      error: { code: "localhost-url-unresolved" },
    });
    expect(registry.getSnapshot().targets).toHaveLength(0);
  });

  it("removes and clears targets", () => {
    let nextId = 0;
    const registry = new PreviewTargetRegistryState({
      runtimeSessionId: "runtime-1",
      createId: () => `target-${++nextId}`,
    });
    const removed: string[] = [];
    registry.onEvent((event) => {
      if (event.type === "preview-target-removed") removed.push(event.targetId);
    });

    registry.addTarget({ url: "https://one.example.test", source: "manual" });
    registry.addTarget({ url: "https://two.example.test", source: "manual" });
    registry.removeTarget("target-1");
    registry.clearTargets();

    expect(removed).toEqual(["target-1", "target-2"]);
    expect(registry.getSnapshot().targets).toHaveLength(0);
  });
});

describe("PreviewTargetUrl", () => {
  it("removes query and hash from log-safe URLs", () => {
    expect(PreviewTargetUrl.sanitizeForLog("https://example.test/path?token=secret#hash")).toBe(
      "https://example.test/path",
    );
  });
});
