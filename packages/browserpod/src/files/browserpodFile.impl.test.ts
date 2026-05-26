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
    expect(pod.createFile).toHaveBeenCalledWith("/home/user/src/hello.txt", "w");
    expect(file.write).toHaveBeenCalledWith("hello");
    expect(pod.run).not.toHaveBeenCalled();
  });
});
