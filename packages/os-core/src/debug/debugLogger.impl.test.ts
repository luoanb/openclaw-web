import { describe, expect, it, vi } from "vitest";
import { DebugLogger } from "./debugLogger.impl";

function createConsoleMock() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("DebugLogger", () => {
  it("writes scoped structured logs", () => {
    const consoleMock = createConsoleMock();
    const logger = new DebugLogger("browserpod.file", { console: consoleMock });

    logger.debug("operation:start", {
      operation: "readFileBytes",
      path: "/home/user/file.bin",
    });

    expect(consoleMock.debug).toHaveBeenCalledWith("[web-claw:browserpod.file] operation:start", {
      operation: "readFileBytes",
      path: "/home/user/file.bin",
    });
  });

  it("filters logs below the configured level", () => {
    const consoleMock = createConsoleMock();
    const logger = new DebugLogger("browserpod.file", {
      console: consoleMock,
      minLevel: "warn",
    });

    logger.debug("operation:start", { operation: "readFileBytes" });
    logger.blocked("readFileBytes", "too-large", { path: "/home/user/file.bin" });

    expect(consoleMock.debug).not.toHaveBeenCalled();
    expect(consoleMock.warn).toHaveBeenCalledOnce();
  });

  it("adds deterministic operation duration when a clock is provided", () => {
    const consoleMock = createConsoleMock();
    let now = 100;
    const logger = new DebugLogger("files.panel", {
      console: consoleMock,
      now: () => now,
    });

    const startedAt = logger.start("uploadFile", { targetPath: "/home/user/a.png" });
    now = 142;
    logger.success("uploadFile", startedAt, { targetPath: "/home/user/a.png" });

    expect(consoleMock.debug).toHaveBeenLastCalledWith("[web-claw:files.panel] operation:success", {
      operation: "uploadFile",
      durationMs: 42,
      resultOk: true,
      targetPath: "/home/user/a.png",
    });
  });

  it("redacts content-like fields", () => {
    const consoleMock = createConsoleMock();
    const logger = new DebugLogger("browserpod.file.command", { console: consoleMock });

    logger.debug("operation:success", {
      operation: "readFileBase64",
      base64: "secret-payload",
      payloadLength: 16,
    });

    expect(consoleMock.debug).toHaveBeenCalledWith("[web-claw:browserpod.file.command] operation:success", {
      operation: "readFileBase64",
      base64: "[redacted]",
      payloadLength: 16,
    });
  });

  it("formats errors without dumping arbitrary objects", () => {
    const consoleMock = createConsoleMock();
    const logger = new DebugLogger("browserpod.file", { console: consoleMock });

    logger.error("copyPath", new Error("copy failed"), undefined, {
      sourcePath: "/home/user/a",
      targetPath: "/home/user/a_copy",
    });

    expect(consoleMock.error).toHaveBeenCalledWith("[web-claw:browserpod.file] operation:error", {
      operation: "copyPath",
      resultOk: false,
      sourcePath: "/home/user/a",
      targetPath: "/home/user/a_copy",
      error: {
        name: "Error",
        message: "copy failed",
      },
    });
  });

  it("formats file action error objects without stringifying them", () => {
    const consoleMock = createConsoleMock();
    const logger = new DebugLogger("files.panel", { console: consoleMock });

    logger.error(
      "uploadFile",
      {
        code: "file-write-failed",
        message: "Failed to write /home/user/center.png.",
        recoverable: true,
        cause: {
          ok: false,
          code: "failed",
          output: "permission denied",
        },
      },
      undefined,
      {
        targetPath: "/home/user/center.png",
      },
    );

    expect(consoleMock.error).toHaveBeenCalledWith("[web-claw:files.panel] operation:error", {
      operation: "uploadFile",
      resultOk: false,
      targetPath: "/home/user/center.png",
      error: {
        message: "Failed to write /home/user/center.png.",
        errorCode: "file-write-failed",
        recoverable: true,
        cause: {
          ok: false,
          code: "failed",
          outputLength: 17,
        },
      },
    });
  });
});
