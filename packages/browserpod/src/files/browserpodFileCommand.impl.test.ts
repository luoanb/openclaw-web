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

function createPodWithOutputs(results: Array<{ readonly output: string; readonly exitCode?: number }>): BrowserPodLike {
  const encoder = new TextEncoder();
  let onOutput: ((buffer: Uint8Array) => void) | null = null;
  let runIndex = 0;

  return {
    createCustomTerminal: vi.fn(async (options) => {
      onOutput = options.onOutput;
      return {};
    }),
    run: vi.fn(async () => {
      const result = results[runIndex] ?? { output: "", exitCode: 0 };
      runIndex += 1;
      onOutput?.(encoder.encode(result.output));
      return { exitCode: result.exitCode ?? 0 };
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
    expect(pod.run).toHaveBeenCalledWith("sh", ["-lc", "ls -l '/home/user'"], expect.objectContaining({
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    }));
  });

  it("runs file actions through simple shell commands", async () => {
    const pod = createPodWithOutput("");
    const runner = new BrowserPodFileCommandRunner();

    await runner.runFileAction(pod, "mv", ["/home/user/a.txt", "/home/user/b.txt"], "/home/user/a.txt", "Failed");

    expect(pod.run).toHaveBeenCalledWith("sh", ["-lc", "mv '/home/user/a.txt' '/home/user/b.txt'"], expect.objectContaining({
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    }));
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
      expect.objectContaining({
        terminal: expect.any(Object),
        cwd: "/",
        echo: false,
      }),
    );
  });

  it("detects binary files through grep-compatible shell output", async () => {
    const pod = createPodWithOutput("__OPENCLAW_BINARY_FILE__");
    const runner = new BrowserPodFileCommandRunner();

    await expect(runner.isTextFile(pod, "/home/user/image.txt")).resolves.toBe(false);
  });

  it("deletes files through a verified shell command", async () => {
    const pod = createPodWithOutput("__OPENCLAW_DELETE_SUCCESS__");
    const runner = new BrowserPodFileCommandRunner();

    await runner.deletePath(pod, "/home/user/a file.txt");

    expect(pod.run).toHaveBeenCalledWith(
      "sh",
      [
        "-lc",
        [
          "target='/home/user/a file.txt'",
          "if [ ! -e \"$target\" ]; then printf '__OPENCLAW_DELETE_MISSING__'; exit 0; fi",
          "if [ -d \"$target\" ]; then printf '__OPENCLAW_DELETE_TYPE_MISMATCH__'; exit 0; fi",
          "rm -- \"$target\"",
          "status=$?",
          "if [ \"$status\" -ne 0 ]; then printf '__OPENCLAW_DELETE_FAILED__'; exit 0; fi",
          "if [ -e \"$target\" ]; then printf '__OPENCLAW_DELETE_STILL_EXISTS__'; else printf '__OPENCLAW_DELETE_SUCCESS__'; fi",
        ].join("; "),
      ],
      expect.objectContaining({
        terminal: expect.any(Object),
        cwd: "/",
        echo: false,
      }),
    );
  });

  it("does not treat a missing delete target as success", async () => {
    const pod = createPodWithOutput("__OPENCLAW_DELETE_MISSING__");
    const runner = new BrowserPodFileCommandRunner();

    await expect(runner.deletePath(pod, "/home/user/missing.txt")).rejects.toMatchObject({
      fileError: { code: "path-not-found" },
    });
  });

  it("does not treat a still-existing delete target as success", async () => {
    const pod = createPodWithOutput("__OPENCLAW_DELETE_STILL_EXISTS__");
    const runner = new BrowserPodFileCommandRunner();

    await expect(runner.deletePath(pod, "/home/user/stuck.txt")).rejects.toMatchObject({
      fileError: { code: "delete-failed" },
    });
  });

  it("reads base64 file payload between sentinels", async () => {
    const pod = createPodWithOutput("noise\n__OPENCLAW_FILE_BASE64_START__\naGVsbG8=\n__OPENCLAW_FILE_BASE64_END__\n$ ");
    const runner = new BrowserPodFileCommandRunner();

    await expect(runner.readFileBase64(pod, "/home/user/file.bin", 1024)).resolves.toBe("aGVsbG8=");
  });

  it("copies files without overwriting by default", async () => {
    const pod = createPodWithOutputs([
      { output: "__OPENCLAW_PATH_MISSING__" },
      { output: "", exitCode: 0 },
    ]);
    const runner = new BrowserPodFileCommandRunner();

    await runner.copyPath(pod, "/home/user/a.txt", "/home/user/b.txt", "file");

    expect(pod.run).toHaveBeenLastCalledWith("sh", ["-lc", "src='/home/user/a.txt'; target='/home/user/b.txt'; if [ ! -f \"$src\" ]; then exit 2; fi; cp \"$src\" \"$target\""], expect.objectContaining({
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    }));
  });

  it("copies colliding files to a copy target without confirmation", async () => {
    const pod = createPodWithOutputs([
      { output: "__OPENCLAW_PATH_EXISTS__" },
      { output: "__OPENCLAW_PATH_MISSING__" },
      { output: "", exitCode: 0 },
    ]);
    const runner = new BrowserPodFileCommandRunner();

    const result = await runner.copyPath(pod, "/home/user/a.txt", "/home/user/b.txt", "file");

    expect(result).toEqual({ targetPath: "/home/user/b.txt_copy" });
    expect(pod.run).toHaveBeenLastCalledWith("sh", ["-lc", "src='/home/user/a.txt'; target='/home/user/b.txt_copy'; if [ ! -f \"$src\" ]; then exit 2; fi; cp \"$src\" \"$target\""], expect.objectContaining({
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    }));
  });

  it("keeps probing copy targets until one is available", async () => {
    const pod = createPodWithOutputs([
      { output: "__OPENCLAW_PATH_EXISTS__" },
      { output: "__OPENCLAW_PATH_EXISTS__" },
      { output: "__OPENCLAW_PATH_MISSING__" },
      { output: "", exitCode: 0 },
    ]);
    const runner = new BrowserPodFileCommandRunner();

    const result = await runner.copyPath(pod, "/home/user/a.txt", "/home/user/b.txt", "file");

    expect(result).toEqual({ targetPath: "/home/user/b.txt_copy_2" });
    expect(pod.run).toHaveBeenLastCalledWith("sh", ["-lc", "src='/home/user/a.txt'; target='/home/user/b.txt_copy_2'; if [ ! -f \"$src\" ]; then exit 2; fi; cp \"$src\" \"$target\""], expect.objectContaining({
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    }));
  });

  it("copies colliding directories to a copy target", async () => {
    const pod = createPodWithOutputs([
      { output: "__OPENCLAW_PATH_EXISTS__" },
      { output: "__OPENCLAW_PATH_MISSING__" },
      { output: "", exitCode: 0 },
    ]);
    const runner = new BrowserPodFileCommandRunner();

    const result = await runner.copyPath(pod, "/home/user/src", "/home/user/src", "directory");

    expect(result).toEqual({ targetPath: "/home/user/src_copy" });
    expect(pod.run).toHaveBeenLastCalledWith("sh", ["-lc", "src='/home/user/src'; target='/home/user/src_copy'; if [ ! -d \"$src\" ]; then exit 2; fi; cp -r \"$src\" \"$target\""], expect.objectContaining({
      terminal: expect.any(Object),
      cwd: "/",
      echo: false,
    }));
  });

  it("rejects copying a directory into itself", async () => {
    const pod = createPodWithOutput("");
    const runner = new BrowserPodFileCommandRunner();

    await expect(runner.copyPath(pod, "/home/user/src", "/home/user/src/nested", "directory")).rejects.toMatchObject({
      fileError: { code: "path-invalid" },
    });
  });
});
