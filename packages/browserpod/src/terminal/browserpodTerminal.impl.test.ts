import { describe, expect, it, vi } from "vitest";
import { BrowserPodRuntimeManager } from "../runtime/browserpodRuntime.impl";
import type { BrowserPodLike, BrowserPodRuntimeConfig } from "../runtime/browserpodRuntime.interfaces";
import { BrowserPodTerminalService } from "./browserpodTerminal.impl";

function createConfig(pod: BrowserPodLike): BrowserPodRuntimeConfig {
  return {
    apiKeyProvider: () => "test-api-key",
    storageKeyResolver: () => "test-storage-key",
    environment: {
      isCrossOriginIsolated: () => true,
    },
    booter: {
      boot: vi.fn(async () => pod),
    },
    injection: false,
  };
}

describe("BrowserPodTerminalService", () => {
  it("runs submitted commands through sh -lc with the current cwd", async () => {
    const run = vi.fn(async () => ({ exitCode: 0 }));
    const terminal = {};
    const pod: BrowserPodLike = {
      run,
      createDefaultTerminal: vi.fn(() => terminal),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodTerminalService(runtimeManager);

    const session = await service.createTerminal(runtimeSession, {
      element: {} as HTMLElement,
      cwd: "/workspace",
    });
    const result = await session.submitCommand("echo hello");

    expect(result).toEqual({ ok: true });
    expect(run).toHaveBeenCalledWith("sh", ["-lc", "echo hello"], {
      echo: true,
      terminal,
      cwd: "/workspace",
    });
    expect(session.interactionStatus).toBe("ready");
  });

  it("uses BrowserPod's verified user home as the default cwd", async () => {
    const run = vi.fn(async () => ({ exitCode: 0 }));
    const terminal = {};
    const pod: BrowserPodLike = {
      run,
      createDefaultTerminal: vi.fn(() => terminal),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodTerminalService(runtimeManager);

    const session = await service.createTerminal(runtimeSession, {
      element: {} as HTMLElement,
    });
    const result = await session.submitCommand("echo hello");

    expect(result).toEqual({ ok: true });
    expect(session.cwd).toBe("/home/user");
    expect(run).toHaveBeenCalledWith("sh", ["-lc", "echo hello"], expect.objectContaining({
      echo: true,
      terminal,
      cwd: "/home/user",
    }));
  });

  it("awaits BrowserPod default terminal creation before running commands", async () => {
    const run = vi.fn(async () => ({ exitCode: 0 }));
    const terminal = {};
    const pod: BrowserPodLike = {
      run,
      createDefaultTerminal: vi.fn(async () => terminal),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodTerminalService(runtimeManager);

    const session = await service.createTerminal(runtimeSession, {
      element: {} as HTMLElement,
    });
    const result = await session.submitCommand("echo hello");

    expect(result).toEqual({ ok: true });
    expect(run).toHaveBeenCalledWith("sh", ["-lc", "echo hello"], expect.objectContaining({
      echo: true,
      terminal,
      cwd: "/home/user",
    }));
  });

  it("handles clear as a terminal UI event without running a process", async () => {
    const run = vi.fn(async () => ({ exitCode: 0 }));
    const pod: BrowserPodLike = {
      run,
      createDefaultTerminal: vi.fn(() => ({})),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodTerminalService(runtimeManager);
    const session = await service.createTerminal(runtimeSession, { element: {} as HTMLElement });
    let didClear = false;

    session.onEvent((event) => {
      if (event.type === "terminal-clear") didClear = true;
    });

    const result = await session.submitCommand("clear");

    expect(result).toEqual({ ok: true });
    expect(didClear).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("updates cwd after cd succeeds", async () => {
    const run = vi.fn(async () => ({ exitCode: 0 }));
    const pod: BrowserPodLike = {
      run,
      createDefaultTerminal: vi.fn(() => ({})),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodTerminalService(runtimeManager);
    const session = await service.createTerminal(runtimeSession, {
      element: {} as HTMLElement,
      cwd: "/workspace",
    });

    const result = await session.submitCommand("cd packages/os-core");

    expect(result).toEqual({ ok: true });
    expect(session.cwd).toBe("/workspace/packages/os-core");
    expect(run).toHaveBeenCalledWith("sh", ["-lc", "cd '/workspace/packages/os-core'"], expect.objectContaining({
      echo: true,
      terminal: expect.any(Object),
      cwd: "/workspace",
    }));
  });

  it("returns unsupported for programmatic stdin when terminal does not expose write", async () => {
    const pendingRun = new Promise(() => undefined);
    const pod: BrowserPodLike = {
      run: vi.fn(async () => pendingRun),
      createDefaultTerminal: vi.fn(() => ({})),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodTerminalService(runtimeManager);
    const session = await service.createTerminal(runtimeSession, { element: {} as HTMLElement });

    void session.submitCommand("read value");
    const result = await session.writeStdin("hello\n");

    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported",
    });
  });

  it("includes BrowserPod command failure details in action results", async () => {
    const pod: BrowserPodLike = {
      run: vi.fn(async () => {
        throw new Error("sdk rejected command");
      }),
      createDefaultTerminal: vi.fn(() => ({})),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodTerminalService(runtimeManager);
    const session = await service.createTerminal(runtimeSession, { element: {} as HTMLElement });

    const result = await session.submitCommand("echo hello");

    expect(result).toMatchObject({
      ok: false,
      reason: "failed",
      message: "BrowserPod command failed: sdk rejected command",
    });
  });
});
