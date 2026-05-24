import { describe, expect, it } from "vitest";
import { RuntimeSessionState } from "./runtimeSession.impl";
import { RuntimeStateMachine } from "./runtimeState.impl";
import type { RuntimeCapabilities } from "./runtime.interfaces";

const browserPodCapabilities: RuntimeCapabilities = {
  multipleTerminals: true,
  commandRun: true,
  processStdin: "partial",
  abortProcess: false,
  shutdown: "unknown",
  filePersistence: true,
  servicePreview: true,
};

describe("RuntimeStateMachine", () => {
  it("emits status changes and keeps snapshot timestamps", () => {
    let tick = 0;
    const state = new RuntimeStateMachine({ now: () => ++tick });
    const events: string[] = [];

    state.onEvent((event) => {
      if (event.type === "runtime-status") events.push(event.status);
    });

    state.setStatus("checking");
    state.setStatus("booting");

    expect(events).toEqual(["checking", "booting"]);
    expect(state.getSnapshot()).toMatchObject({
      status: "booting",
      updatedAt: 3,
    });
  });

  it("stores session summaries without exposing adapter objects", () => {
    const state = new RuntimeStateMachine();
    const session = new RuntimeSessionState({
      id: "runtime-1",
      kind: "browserpod",
      sessionKey: "app-open",
      capabilities: browserPodCapabilities,
    });

    const summary = state.setSession(session);

    expect(summary).toEqual({
      id: "runtime-1",
      kind: "browserpod",
      status: "running",
      sessionKey: "app-open",
      capabilities: browserPodCapabilities,
    });
    expect(state.currentSession).toBe(session);
    expect(state.getSnapshot().session).toEqual(summary);
    expect(state.getSnapshot().session).not.toHaveProperty("ref");
  });

  it("makes unsubscribe idempotent", () => {
    const state = new RuntimeStateMachine();
    let calls = 0;

    const unsubscribe = state.onEvent(() => {
      calls += 1;
    });

    unsubscribe();
    unsubscribe();
    state.setStatus("checking");

    expect(calls).toBe(0);
  });

  it("turns unsupported checks into unsupported runtime status", () => {
    const state = new RuntimeStateMachine();

    state.setCheckResult({
      ok: false,
      status: "unsupported",
      issues: [
        {
          code: "isolation-unavailable",
          message: "Cross-origin isolation is required.",
          recoverable: false,
        },
      ],
    });

    expect(state.status).toBe("unsupported");
    expect(state.getSnapshot().lastCheck?.status).toBe("unsupported");
  });
});
