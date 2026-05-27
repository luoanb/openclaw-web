import { describe, expect, it, vi } from "vitest";
import type { BrowserPodLike, BrowserPodTerminalLike } from "../runtime";
import { CustomTerminalCommandRunner } from "./browserpodCommand.impl";

function createCustomTerminalPod(runReturnFactory: (emit: (output: string) => void) => unknown): BrowserPodLike {
  const encoder = new TextEncoder();
  let onOutput: ((buffer: Uint8Array) => void) | null = null;
  return {
    createCustomTerminal: vi.fn(async (options) => {
      onOutput = options.onOutput;
      return {
        close: vi.fn(),
      };
    }),
    run: vi.fn(() => runReturnFactory((output) => onOutput?.(encoder.encode(output)))),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("CustomTerminalCommandRunner", () => {
  it("does not depend on raw then return value", async () => {
    const pod = createCustomTerminalPod((emit) => ({
      then(onFulfilled: (value: unknown) => void) {
        emit("hello\n");
        onFulfilled({ exitCode: 0 });
        return undefined;
      },
    }));
    const runner = new CustomTerminalCommandRunner();

    const result = await runner.run(pod, "sh", ["-lc", "printf hello"], {
      cwd: "/home/user",
      timeoutMs: 1000,
    });

    expect(result).toEqual({ ok: true, code: 0, output: "hello\n" });
    expect(pod.run).toHaveBeenCalledWith("sh", ["-lc", "printf hello"], {
      terminal: expect.any(Object),
      cwd: "/home/user",
      echo: false,
    });
  });

  it("uses cosProcess when BrowserPod returns a process-like object", async () => {
    const pod = createCustomTerminalPod((emit) => ({
      cosProcess: Promise.resolve().then(() => {
        emit("done\n");
        return { exitCode: 0 };
      }),
    }));
    const runner = new CustomTerminalCommandRunner();

    const result = await runner.run(pod, "sh", ["-lc", "printf done"], {
      cwd: "/home/user",
      timeoutMs: 1000,
    });

    expect(result).toEqual({ ok: true, code: 0, output: "done\n" });
  });

  it("keeps BrowserPod as the run receiver", async () => {
    const encoder = new TextEncoder();
    let onOutput: ((buffer: Uint8Array) => void) | null = null;
    let receiver: unknown;
    const pod: BrowserPodLike = {
      createCustomTerminal: vi.fn(async (options) => {
        onOutput = options.onOutput;
        return { close: vi.fn() };
      }),
      run: vi.fn(function (this: unknown) {
        receiver = this;
        onOutput?.(encoder.encode("receiver-ok\n"));
        return { exitCode: 0 };
      }),
    };
    const runner = new CustomTerminalCommandRunner();

    const result = await runner.run(pod, "sh", ["-lc", "printf receiver-ok"], {
      timeoutMs: 1000,
    });

    expect(receiver).toBe(pod);
    expect(result).toEqual({ ok: true, code: 0, output: "receiver-ok\n" });
  });

  it("reuses one custom terminal and resolves concurrent calls in queue order", async () => {
    const encoder = new TextEncoder();
    const first = deferred<{ exitCode: number }>();
    const second = deferred<{ exitCode: number }>();
    const runs = [first, second];
    let onOutput: ((buffer: Uint8Array) => void) | null = null;
    const terminal: BrowserPodTerminalLike = { close: vi.fn() };
    const run = vi.fn(() => {
      const runIndex = run.mock.calls.length;
      onOutput?.(encoder.encode(`output-${runIndex}\n`));
      return runs[runIndex - 1]?.promise;
    });
    const pod: BrowserPodLike = {
      createCustomTerminal: vi.fn(async (options) => {
        onOutput = options.onOutput;
        return terminal;
      }),
      run,
    };
    const runner = new CustomTerminalCommandRunner();

    const firstResult = runner.run(pod, "sh", ["-lc", "first"], { timeoutMs: 1000 });
    const secondResult = runner.run(pod, "sh", ["-lc", "second"], { timeoutMs: 1000 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pod.createCustomTerminal).toHaveBeenCalledTimes(1);
    expect(pod.run).toHaveBeenCalledTimes(1);
    first.resolve({ exitCode: 0 });
    await expect(firstResult).resolves.toEqual({ ok: true, code: 0, output: "output-1\n" });

    expect(pod.createCustomTerminal).toHaveBeenCalledTimes(1);
    expect(pod.run).toHaveBeenCalledTimes(2);
    second.resolve({ exitCode: 0 });
    await expect(secondResult).resolves.toEqual({ ok: true, code: 0, output: "output-2\n" });
    expect(terminal.close).not.toHaveBeenCalled();
  });

  it("closes the reused custom terminal on dispose", async () => {
    const terminal: BrowserPodTerminalLike = { close: vi.fn() };
    const pod = createCustomTerminalPod((emit) => {
      emit("done\n");
      return { exitCode: 0 };
    });
    if (!pod.createCustomTerminal) throw new Error("missing createCustomTerminal");
    vi.mocked(pod.createCustomTerminal).mockResolvedValueOnce(terminal);
    const runner = new CustomTerminalCommandRunner();

    await runner.run(pod, "sh", ["-lc", "printf done"], { timeoutMs: 1000 });
    await runner.dispose();

    expect(terminal.close).toHaveBeenCalledTimes(1);
  });
});
