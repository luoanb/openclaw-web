import { describe, expect, it, vi } from "vitest";
import { BrowserPodRuntimeManager, type BrowserPodFileLike, type BrowserPodLike, type BrowserPodRuntimeConfig } from "../runtime";
import { BrowserPodFileService } from "./browserpodFile.impl";

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
  };
}

function createPodWithFile(file: BrowserPodFileLike, commandOutput: string): BrowserPodLike {
  const encoder = new TextEncoder();
  let onOutput: ((buffer: Uint8Array) => void) | null = null;

  return {
    createCustomTerminal: vi.fn(async (options) => {
      onOutput = options.onOutput;
      return {};
    }),
    run: vi.fn(async () => {
      onOutput?.(encoder.encode(commandOutput));
      return { exitCode: 0 };
    }),
    openFile: vi.fn(async () => file),
  };
}

describe("BrowserPodFileService", () => {
  it("uses BrowserPod SDK APIs for directory and file creation", async () => {
    const file: BrowserPodFileLike = {
      write: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    };
    const pod: BrowserPodLike = {
      run: vi.fn(),
      createDirectory: vi.fn(async () => undefined),
      createFile: vi.fn(async () => file),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const createDirectoryResult = await service.createDirectory(runtimeSession, "/home/user/src");
    const createFileResult = await service.createFile(runtimeSession, "/home/user/src/hello.txt", "hello");

    expect(createDirectoryResult).toEqual({ ok: true });
    expect(createFileResult).toEqual({ ok: true });
    expect(pod.createDirectory).toHaveBeenCalledWith("/home/user/src", { recursive: true });
    expect(pod.createFile).toHaveBeenCalledWith("/home/user/src/hello.txt", "utf-8");
    expect(file.write).toHaveBeenCalledWith("hello");
    expect(pod.run).not.toHaveBeenCalled();
  });

  it("opens a text file without relying on its extension", async () => {
    const file: BrowserPodFileLike = {
      getSize: vi.fn(async () => 5),
      read: vi.fn(async () => "hello"),
      close: vi.fn(async () => undefined),
    };
    const pod = createPodWithFile(file, "__OPENCLAW_TEXT_FILE__");
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const snapshot = await service.readTextFile(runtimeSession, "/home/user/README");

    expect(snapshot.content).toBe("hello");
    expect(snapshot.encoding).toBe("utf-8");
    expect(pod.openFile).toHaveBeenCalledWith("/home/user/README", "utf-8");
    expect(pod.openFile).toHaveBeenCalledTimes(1);
    expect(pod.run).toHaveBeenCalled();
  });

  it("rejects binary content even when the extension looks textual", async () => {
    const file: BrowserPodFileLike = {
      getSize: vi.fn(async () => 8),
      read: vi.fn(async () => "ignored"),
      close: vi.fn(async () => undefined),
    };
    const pod = createPodWithFile(file, "__OPENCLAW_BINARY_FILE__");
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    await expect(service.readTextFile(runtimeSession, "/home/user/image.txt")).rejects.toMatchObject({
      fileError: { code: "unsupported-file-type" },
    });
    expect(file.read).not.toHaveBeenCalled();
  });

  it("accepts empty files as text files", async () => {
    const file: BrowserPodFileLike = {
      getSize: vi.fn(async () => 0),
      read: vi.fn(async () => ""),
      close: vi.fn(async () => undefined),
    };
    const pod = createPodWithFile(file, "__OPENCLAW_TEXT_FILE__");
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const snapshot = await service.readTextFile(runtimeSession, "/home/user/empty");

    expect(snapshot.content).toBe("");
    expect(snapshot.size).toBe(0);
  });

  it("accepts blank-line-only files when grep-compatible inspection reports text", async () => {
    const file: BrowserPodFileLike = {
      getSize: vi.fn(async () => 2),
      read: vi.fn(async () => "\n\n"),
      close: vi.fn(async () => undefined),
    };
    const pod = createPodWithFile(file, "__OPENCLAW_TEXT_FILE__");
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const snapshot = await service.readTextFile(runtimeSession, "/home/user/blank-lines");

    expect(snapshot.content).toBe("\n\n");
    expect(snapshot.size).toBe(2);
  });

  it("rejects files above the text edit size limit before content inspection", async () => {
    const file: BrowserPodFileLike = {
      getSize: vi.fn(async () => 1024 * 1024 + 1),
      read: vi.fn(async () => "ignored"),
      close: vi.fn(async () => undefined),
    };
    const pod = createPodWithFile(file, "__OPENCLAW_TEXT_FILE__");
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    await expect(service.readTextFile(runtimeSession, "/home/user/large.txt")).rejects.toMatchObject({
      fileError: { code: "file-too-large" },
    });
    expect(pod.run).not.toHaveBeenCalled();
    expect(file.read).not.toHaveBeenCalled();
  });

  it("reads binary file bytes through base64 command output", async () => {
    const pod = createPodWithFile(
      {},
      "__OPENCLAW_FILE_BASE64_START__\naGVsbG8=\n__OPENCLAW_FILE_BASE64_END__",
    );
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const snapshot = await service.readFileBytes(runtimeSession, "/home/user/file.bin");

    expect(new TextDecoder().decode(snapshot.content)).toBe("hello");
    expect(snapshot.size).toBe(5);
  });

  it("writes binary file bytes through BrowserPod binary file API", async () => {
    const binaryFile: BrowserPodFileLike = {
      write: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    };
    const encoder = new TextEncoder();
    let onOutput: ((buffer: Uint8Array) => void) | null = null;
    const pod: BrowserPodLike = {
      createCustomTerminal: vi.fn(async (options) => {
        onOutput = options.onOutput;
        return {};
      }),
      run: vi.fn(async () => {
        onOutput?.(encoder.encode("__OPENCLAW_PATH_MISSING__"));
        return { exitCode: 0 };
      }),
      createFile: vi.fn(async () => binaryFile),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);
    const content = new TextEncoder().encode("hello").buffer;

    const result = await service.writeFileBytes(runtimeSession, "/home/user/file.bin", content);

    expect(result).toEqual({ ok: true });
    expect(pod.createFile).toHaveBeenCalledWith("/home/user/file.bin", "binary");
    expect(binaryFile.write).toHaveBeenCalledWith(content);
    expect(binaryFile.close).toHaveBeenCalled();
  });

  it("does not overwrite an existing binary file by default", async () => {
    const encoder = new TextEncoder();
    let onOutput: ((buffer: Uint8Array) => void) | null = null;
    const pod: BrowserPodLike = {
      createCustomTerminal: vi.fn(async (options) => {
        onOutput = options.onOutput;
        return {};
      }),
      run: vi.fn(async () => {
        onOutput?.(encoder.encode("__OPENCLAW_PATH_EXISTS__"));
        return { exitCode: 0 };
      }),
      createFile: vi.fn(),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const result = await service.writeFileBytes(runtimeSession, "/home/user/file.bin", new TextEncoder().encode("hello").buffer);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "path-already-exists" },
    });
    expect(pod.createFile).not.toHaveBeenCalled();
  });

  it("copies paths through the BrowserPod command runner", async () => {
    const encoder = new TextEncoder();
    let onOutput: ((buffer: Uint8Array) => void) | null = null;
    const outputs = ["__OPENCLAW_PATH_MISSING__", ""];
    const pod: BrowserPodLike = {
      createCustomTerminal: vi.fn(async (options) => {
        onOutput = options.onOutput;
        return {};
      }),
      run: vi.fn(async () => {
        onOutput?.(encoder.encode(outputs.shift() ?? ""));
        return { exitCode: 0 };
      }),
    };
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const result = await service.copyPath(runtimeSession, "/home/user/src", "/home/user/src_copy", "directory");

    expect(result).toEqual({ ok: true });
    expect(pod.run).toHaveBeenCalled();
  });

  it("returns a failure when delete target is not removed", async () => {
    const pod = createPodWithFile({}, "__OPENCLAW_DELETE_STILL_EXISTS__");
    const runtimeManager = new BrowserPodRuntimeManager(createConfig(pod));
    const runtimeSession = await runtimeManager.boot();
    const service = new BrowserPodFileService(runtimeManager);

    const result = await service.delete(runtimeSession, "/home/user/stuck.txt");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "delete-failed" },
    });
  });
});
