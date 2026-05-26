import { describe, expect, it, vi } from "vitest";
import type { BrowserPodLike } from "../runtime";
import { BrowserPodFileCommandRunner } from "./browserpodFileCommand.impl";

function createPodWithOutput(output: string, exitCode = 0): BrowserPodLike {
  const encoder = new TextEncoder();
  let onOutput: ((buffer: Uint8Array) => void) | null = null;

  return {
    createCustomTerminal: vi.fn(async (options) => {
      onOutput = options.onOutput;
      return {};
    }),
    run: vi.fn(async () => {
      onOutput?.(encoder.encode(output));
      return { exitCode };
    }),
  };
}

describe("BrowserPodFileCommandRunner", () => {
  it("parses ls -l output into directory entries", async () => {
    const pod = createPodWithOutput(
      [
        "total 8",
        "drwxr-xr-x 1 user user 0 May 27 00:00 src",
        "-rw-r--r-- 1 user user 12 May 27 00:01 README.md",
      ].join("\n"),
    );
    const runner = new BrowserPodFileCommandRunner();

    const snapshot = await runner.listDirectory(pod, "/home/user");

    expect(snapshot.path).toBe("/home/user");
    expect(snapshot.entries).toEqual([
      { name: "src", path: "/home/user/src", kind: "directory" },
      { name: "README.md", path: "/home/user/README.md", kind: "file" },
    ]);
    expect(pod.run).toHaveBeenCalledWith("sh", ["-lc", "ls -l '/home/user'"], {
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    });
  });

  it("runs file actions through simple shell commands", async () => {
    const pod = createPodWithOutput("");
    const runner = new BrowserPodFileCommandRunner();

    await runner.runFileAction(pod, "mv", ["/home/user/a.txt", "/home/user/b.txt"], "/home/user/a.txt", "Failed");

    expect(pod.run).toHaveBeenCalledWith("sh", ["-lc", "mv '/home/user/a.txt' '/home/user/b.txt'"], {
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    });
  });
});
