import { describe, expect, it, vi } from "vitest";
import type { BrowserPodLike } from "../runtime";
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
});
