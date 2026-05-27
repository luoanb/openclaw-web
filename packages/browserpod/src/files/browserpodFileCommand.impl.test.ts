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

  it("detects text files through grep-compatible shell output", async () => {
    const pod = createPodWithOutput("\u001b[32m__OPENCLAW_TEXT_FILE__\u001b[0m\n$ ");
    const runner = new BrowserPodFileCommandRunner();

    await expect(runner.isTextFile(pod, "/home/user/README")).resolves.toBe(true);
    expect(pod.run).toHaveBeenCalledWith(
      "sh",
      [
        "-lc",
        [
          "p='/home/user/README'",
          'if [ ! -f "$p" ]; then exit 2; fi',
          "if [ ! -s \"$p\" ]; then printf '__OPENCLAW_TEXT_FILE__'; exit 0; fi",
          "if LC_ALL=C grep -Iq \"\" \"$p\"; then printf '__OPENCLAW_TEXT_FILE__'; exit 0; fi",
          "status=$?",
          "if [ \"$status\" -eq 1 ]; then printf '__OPENCLAW_BINARY_FILE__'; exit 0; fi",
          'exit "$status"',
        ].join("; "),
      ],
      {
        terminal: expect.any(Object),
        cwd: "/",
        echo: false,
      },
    );
  });

  it("detects binary files through grep-compatible shell output", async () => {
    const pod = createPodWithOutput("__OPENCLAW_BINARY_FILE__");
    const runner = new BrowserPodFileCommandRunner();

    await expect(runner.isTextFile(pod, "/home/user/image.txt")).resolves.toBe(false);
  });
});
