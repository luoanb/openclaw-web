import { describe, expect, it, vi } from "vitest";
import { RuntimeSessionState } from "os-core";
import type { BrowserPodFileLike, BrowserPodLike } from "../runtime/browserpodRuntime.interfaces";
import { BrowserPodInjectionService } from "./browserpodInjection.impl";
import type { BrowserPodInjectionScript } from "./browserpodInjection.interfaces";

function createScript(content: string, version = "1.0.0"): BrowserPodInjectionScript {
  return {
    id: "test-tool",
    command: "tool",
    runner: "node",
    version,
    asset: {
      sourcePath: "packages/browserpod/src/injection/scripts/tool.js",
      filename: "tool.js",
    },
    load: () => content,
  };
}

function createRuntimeSession() {
  return new RuntimeSessionState({
    id: "test-session",
    kind: "browserpod",
    capabilities: {
      multipleTerminals: true,
      commandRun: true,
      processStdin: "partial",
      abortProcess: false,
      shutdown: "unknown",
      filePersistence: true,
      servicePreview: true,
    },
  });
}

function createMemoryPod(
  files = new Map<string, string>(),
  options: {
    readonly volatileWritePaths?: readonly string[];
    readonly nonTruncatingOpenFilePaths?: readonly string[];
  } = {},
) {
  const directories: string[] = [];
  const volatileWritePaths = new Set(options.volatileWritePaths ?? []);
  const nonTruncatingOpenFilePaths = new Set(options.nonTruncatingOpenFilePaths ?? []);
  const pod: BrowserPodLike = {
    createDirectory: vi.fn(async (path) => {
      directories.push(path);
    }),
    openFile: vi.fn(async (path) => {
      if (!files.has(path)) {
        throw new Error(`missing file: ${path}`);
      }
      return nonTruncatingOpenFilePaths.has(path)
        ? createNonTruncatingMemoryFile(files, path)
        : createMemoryFile(files, path);
    }),
    createFile: vi.fn(async (path) => {
      if (volatileWritePaths.has(path)) {
        return createVolatileMemoryFile();
      }
      files.set(path, "");
      return createMemoryFile(files, path);
    }),
    createCustomTerminal: vi.fn(async () => {
      return {};
    }),
    run: vi.fn(async () => {
      return { exitCode: 0 };
    }),
  };
  return { pod, files, directories };
}

function createMemoryFile(files: Map<string, string>, path: string): BrowserPodFileLike {
  return {
    getSize: vi.fn(async () => files.get(path)?.length ?? 0),
    read: vi.fn(async () => files.get(path) ?? ""),
    write: vi.fn(async (content) => {
      if (typeof content !== "string") {
        throw new Error("memory file only supports string writes");
      }
      files.set(path, content);
      return content.length;
    }),
    close: vi.fn(async () => undefined),
  };
}

function createNonTruncatingMemoryFile(files: Map<string, string>, path: string): BrowserPodFileLike {
  return {
    getSize: vi.fn(async () => files.get(path)?.length ?? 0),
    read: vi.fn(async () => files.get(path) ?? ""),
    write: vi.fn(async (content) => {
      if (typeof content !== "string") {
        throw new Error("memory file only supports string writes");
      }
      const existing = files.get(path) ?? "";
      files.set(path, `${content}${existing.slice(content.length)}`);
      return content.length;
    }),
    close: vi.fn(async () => undefined),
  };
}

function createVolatileMemoryFile(): BrowserPodFileLike {
  return {
    getSize: vi.fn(async () => 0),
    read: vi.fn(async () => ""),
    write: vi.fn(async (content) => typeof content === "string" ? content.length : content.byteLength),
    close: vi.fn(async () => undefined),
  };
}

function createService(pod: BrowserPodLike, scripts: readonly BrowserPodInjectionScript[]) {
  const session = createRuntimeSession();
  const runtimeManager = {
    resolvePod: vi.fn(() => pod),
  };
  const service = new BrowserPodInjectionService(runtimeManager, {
    basePath: "/home/user/.container-tools",
    scripts,
  });
  return { service, session, runtimeManager };
}

describe("BrowserPodInjectionService", () => {
  it("creates managed directories, script files, shell alias config, and manifest", async () => {
    const script = createScript("console.log('hello');\n");
    const { pod, files, directories } = createMemoryPod();
    const { service, session } = createService(pod, [script]);

    const result = await service.inject(session, { reason: "boot" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("created");
    expect(directories).toEqual([
      "/home/user/.container-tools",
      "/home/user/.container-tools/scripts",
      "/home/user/.container-tools/meta",
      "/home/user/.container-tools/shell",
    ]);
    expect(files.get("/home/user/.container-tools/scripts/tool.js")).toBe("console.log('hello');\n");
    expect(files.has("/usr/local/bin/tool")).toBe(false);
    expect(files.get("/home/user/.container-tools/shell/container-tools.sh")).toBe("alias tool='node /home/user/.container-tools/scripts/tool.js'\n");
    expect(files.get("/home/user/.profile")).toContain("container-tools managed block");
    expect(files.get("/home/user/.bashrc")).toContain("container-tools managed block");
    expect(files.get("/home/user/.container-tools/meta/manifest.json")).toContain("\"id\": \"test-tool\"");
    expect(pod.run).not.toHaveBeenCalled();
  });

  it("is idempotent when injected repeatedly", async () => {
    const script = createScript("console.log('hello');\n");
    const { pod, files } = createMemoryPod();
    const { service, session } = createService(pod, [script]);

    await service.inject(session, { reason: "boot" });
    const profileBefore = files.get("/home/user/.profile");
    const result = await service.inject(session, { reason: "manual" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("unchanged");
    expect(files.get("/home/user/.profile")).toBe(profileBefore);
  });

  it("does not overwrite user-modified managed scripts without force", async () => {
    const script = createScript("console.log('hello');\n");
    const { pod, files } = createMemoryPod();
    const { service, session } = createService(pod, [script]);
    await service.inject(session, { reason: "boot" });
    files.set("/home/user/.container-tools/scripts/tool.js", "console.log('user change');\n");

    const result = await service.inject(session, { reason: "repair" });

    expect(result.ok).toBe(true);
    expect(result.warnings?.[0]).toContain("Skipped user-modified managed file");
    expect(files.get("/home/user/.container-tools/scripts/tool.js")).toBe("console.log('user change');\n");
  });

  it("overwrites managed scripts when force is enabled", async () => {
    const script = createScript("console.log('hello');\n");
    const { pod, files } = createMemoryPod();
    const { service, session } = createService(pod, [script]);
    await service.inject(session, { reason: "boot" });
    files.set("/home/user/.container-tools/scripts/tool.js", "console.log('user change');\n");

    const result = await service.inject(session, { reason: "repair", force: true });

    expect(result.ok).toBe(true);
    expect(files.get("/home/user/.container-tools/scripts/tool.js")).toBe("console.log('hello');\n");
  });

  it("recreates stale shell config when force is enabled", async () => {
    const script = createScript("console.log('hello');\n");
    const shellConfigPath = "/home/user/.container-tools/shell/container-tools.sh";
    const files = new Map<string, string>([
      [shellConfigPath, "alias tool='/usr/local/bin/tool'\n"],
    ]);
    const { pod, files: podFiles } = createMemoryPod(files, {
      nonTruncatingOpenFilePaths: [shellConfigPath],
    });
    const { service, session } = createService(pod, [script]);

    const result = await service.inject(session, { reason: "boot", force: true });

    expect(result.ok).toBe(true);
    expect(podFiles.get(shellConfigPath)).toBe("alias tool='node /home/user/.container-tools/scripts/tool.js'\n");
    expect(pod.createFile).toHaveBeenCalledWith(shellConfigPath, "utf-8");
  });

  it("fails when manifest write cannot be verified after alias installation", async () => {
    const script = createScript("console.log('hello');\n");
    const manifestPath = "/home/user/.container-tools/meta/manifest.json";
    const { pod, files } = createMemoryPod(new Map(), { volatileWritePaths: [manifestPath] });
    const { service, session } = createService(pod, [script]);

    const result = await service.inject(session, { reason: "boot" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected manifest verification to fail.");
    expect(result.error.code).toBe("write-failed");
    expect(files.get("/home/user/.container-tools/scripts/tool.js")).toBe("console.log('hello');\n");
    expect(files.get("/home/user/.container-tools/shell/container-tools.sh")).toContain("alias tool=");
    expect(files.has("/usr/local/bin/tool")).toBe(false);
    expect(files.has(manifestPath)).toBe(false);
  });
});
