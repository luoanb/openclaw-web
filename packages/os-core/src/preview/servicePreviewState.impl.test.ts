import { describe, expect, it } from "vitest";
import { ServicePreviewState, ServicePreviewUrl } from "./servicePreviewState.impl";

describe("ServicePreviewState", () => {
  it("adds the first portal entry and selects it", () => {
    let tick = 0;
    const state = new ServicePreviewState({
      runtimeSessionId: "runtime-1",
      now: () => ++tick,
      createId: () => "entry-1",
    });
    const events: string[] = [];

    state.onEvent((event) => events.push(event.type));
    const result = state.addDiscoveredEntry({
      url: "https://preview.example.test/",
      port: 5173,
      source: "portal",
    });

    expect(result).toEqual({ ok: true });
    expect(state.getSnapshot()).toMatchObject({
      runtimeSessionId: "runtime-1",
      selectedEntryId: "entry-1",
    });
    expect(state.getSnapshot().entries[0]).toMatchObject({
      id: "entry-1",
      label: "Port 5173",
      status: "selected",
      source: "portal",
    });
    expect(events).toEqual(["service-preview-entry-discovered", "service-preview-selection"]);
  });

  it("deduplicates entries by normalized URL", () => {
    let index = 0;
    const state = new ServicePreviewState({
      runtimeSessionId: "runtime-1",
      now: () => 100 + index++,
      createId: () => `entry-${index}`,
    });

    state.addDiscoveredEntry({ url: "https://preview.example.test", port: 5173, source: "portal" });
    state.addDiscoveredEntry({ url: "https://preview.example.test/", port: 5174, source: "portal" });

    const snapshot = state.getSnapshot();
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      port: 5174,
      label: "Port 5174",
    });
  });

  it("rejects localhost manual URLs", () => {
    const state = new ServicePreviewState({ runtimeSessionId: "runtime-1" });

    const result = state.addManualUrl("http://localhost:5173");

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-url",
      error: { code: "localhost-url-unresolved" },
    });
    expect(state.getSnapshot().entries).toHaveLength(0);
  });

  it("sorts selected and recently opened entries first", () => {
    let tick = 0;
    let nextId = 0;
    const state = new ServicePreviewState({
      runtimeSessionId: "runtime-1",
      now: () => ++tick,
      createId: () => `entry-${++nextId}`,
    });

    state.addDiscoveredEntry({ url: "https://one.example.test", port: 3000, source: "portal" });
    state.addDiscoveredEntry({ url: "https://two.example.test", port: 4000, source: "portal" });
    state.select("entry-2");
    state.markReady("entry-2");

    expect(state.getSnapshot().entries.map((entry) => entry.id)).toEqual(["entry-2", "entry-1"]);
  });

  it("does not emit after close", () => {
    const state = new ServicePreviewState({ runtimeSessionId: "runtime-1" });
    let calls = 0;
    state.onEvent(() => {
      calls += 1;
    });

    state.close();
    state.addDiscoveredEntry({ url: "https://preview.example.test", port: 5173, source: "portal" });

    expect(calls).toBe(0);
    expect(state.getSnapshot().entries).toHaveLength(0);
  });
});

describe("ServicePreviewUrl", () => {
  it("removes query and hash from log-safe URLs", () => {
    expect(ServicePreviewUrl.sanitizeForLog("https://example.test/path?token=secret#hash")).toBe(
      "https://example.test/path",
    );
  });
});
