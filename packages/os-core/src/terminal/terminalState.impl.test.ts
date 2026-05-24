import { describe, expect, it } from "vitest";
import { TerminalStateMachine } from "./terminalState.impl";
import type { TerminalCapabilities } from "./terminal.interfaces";

const capabilities: TerminalCapabilities = {
  runningStdin: "partial",
  interruptForeground: false,
  resize: false,
  cwd: true,
};

describe("TerminalStateMachine", () => {
  it("tracks lifecycle and interaction status events", () => {
    const state = new TerminalStateMachine({
      id: "terminal-1",
      name: "Terminal 1",
      capabilities,
    });
    const events: string[] = [];

    state.onEvent((event) => {
      if (event.type === "terminal-lifecycle-status") events.push(event.status);
      if (event.type === "terminal-interaction-status") events.push(event.status);
    });

    state.setLifecycleStatus("open");
    state.setInteractionStatus("running");
    state.setInteractionStatus("ready");

    expect(events).toEqual(["open", "running", "ready"]);
    expect(state.getSnapshot()).toMatchObject({
      lifecycleStatus: "open",
      interactionStatus: "ready",
    });
  });

  it("tracks foreground process start and end", () => {
    let tick = 0;
    const state = new TerminalStateMachine({
      id: "terminal-1",
      name: "Terminal 1",
      capabilities,
      now: () => ++tick,
    });

    state.startProcess({
      id: "process-1",
      command: "echo hello",
      startedAt: 10,
    });

    expect(state.interactionStatus).toBe("running");
    expect(state.foregroundProcess?.command).toBe("echo hello");

    const ended = state.endProcess({ endedAt: 20, exitCode: 0 });

    expect(ended).toMatchObject({ id: "process-1", exitCode: 0 });
    expect(state.interactionStatus).toBe("ready");
    expect(state.foregroundProcess).toBeNull();
  });

  it("makes unsubscribe idempotent", () => {
    const state = new TerminalStateMachine({
      id: "terminal-1",
      name: "Terminal 1",
      capabilities,
    });
    let calls = 0;

    const unsubscribe = state.onEvent(() => {
      calls += 1;
    });

    unsubscribe();
    unsubscribe();
    state.notice("hidden");

    expect(calls).toBe(0);
  });
});
