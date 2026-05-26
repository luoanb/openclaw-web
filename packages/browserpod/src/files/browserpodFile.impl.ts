import {
  FileContractError,
  type DirectorySnapshot,
  type FileActionFailureReason,
  type FileActionResult,
  type FileDeleteOptions,
  type FileErrorCode,
  type FileService,
  type RuntimeSession,
  type TextFileSnapshot,
} from "os-core";
import { BrowserPodRuntimeManager } from "../runtime";
import type { BrowserPodFileLike, BrowserPodLike } from "../runtime";
import { BrowserPodFileCommandRunner } from "./browserpodFileCommand.impl";
import { BrowserPodFilePath } from "./browserpodFilePath.impl";

const BROWSERPOD_DEFAULT_FILE_PATH = "/home/user";
const DEFAULT_TEXT_FILE_LIMIT_BYTES = 1024 * 1024;

export class BrowserPodFileService implements FileService {
  private readonly fileCommandRunner = new BrowserPodFileCommandRunner();

  constructor(private readonly runtimeManager: BrowserPodRuntimeManager) {}

  getDefaultPath(_runtimeSession: RuntimeSession): string {
    return BROWSERPOD_DEFAULT_FILE_PATH;
  }

  async listDirectory(runtimeSession: RuntimeSession, path: string): Promise<DirectorySnapshot> {
    return this.fileCommandRunner.listDirectory(this.resolvePod(runtimeSession), path);
  }

  async readTextFile(runtimeSession: RuntimeSession, path: string): Promise<TextFileSnapshot> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const file = await this.openReadableFile(this.resolvePod(runtimeSession), normalizedPath);
    try {
      const size = await readFileSize(file);
      if (size > DEFAULT_TEXT_FILE_LIMIT_BYTES) {
        throw new FileContractError({
          code: "file-too-large",
          message: `File is larger than ${DEFAULT_TEXT_FILE_LIMIT_BYTES} bytes: ${normalizedPath}`,
          recoverable: true,
        });
      }
      const content = await readFileContent(file, size);
      return {
        path: normalizedPath,
        content,
        encoding: "utf-8",
        readAt: Date.now(),
        size,
      };
    } finally {
      await closeFile(file);
    }
  }

  async writeTextFile(
    runtimeSession: RuntimeSession,
    path: string,
    content: string,
  ): Promise<FileActionResult> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedPath = BrowserPodFilePath.normalize(path);
    try {
      const file = await this.openWritableFile(pod, normalizedPath);
      try {
        if (!file.write) {
          return this.fail("unsupported", "file-write-failed", "BrowserPod file write API is unavailable.");
        }
        await file.write(content);
        return { ok: true };
      } finally {
        await closeFile(file);
      }
    } catch (error) {
      return this.fail("failed", "file-write-failed", `Failed to write ${normalizedPath}.`, error);
    }
  }

  async createFile(runtimeSession: RuntimeSession, path: string, content = ""): Promise<FileActionResult> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedPath = BrowserPodFilePath.normalize(path);
    if (!pod.createFile) {
      return this.fail("unsupported", "file-create-failed", "BrowserPod createFile API is unavailable.");
    }

    try {
      const file = await pod.createFile(normalizedPath, "w");
      try {
        if (content && file.write) {
          await file.write(content);
        }
        return { ok: true };
      } finally {
        await closeFile(file);
      }
    } catch (error) {
      return this.fail("failed", "file-create-failed", `Failed to create ${normalizedPath}.`, error);
    }
  }

  async createDirectory(runtimeSession: RuntimeSession, path: string): Promise<FileActionResult> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedPath = BrowserPodFilePath.normalize(path);
    try {
      if (pod.createDirectory) {
        await pod.createDirectory(normalizedPath, { recursive: true });
      } else {
        await this.fileCommandRunner.runFileAction(
          pod,
          "mkdir",
          ["-p", normalizedPath],
          normalizedPath,
          "Failed to create directory",
        );
      }
      return { ok: true };
    } catch (error) {
      return this.fail("failed", "directory-create-failed", `Failed to create directory ${normalizedPath}.`, error);
    }
  }

  async rename(runtimeSession: RuntimeSession, fromPath: string, toPath: string): Promise<FileActionResult> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedFrom = BrowserPodFilePath.normalize(fromPath);
    const normalizedTo = BrowserPodFilePath.normalize(toPath);
    try {
      await this.fileCommandRunner.runFileAction(
        pod,
        "mv",
        [normalizedFrom, normalizedTo],
        normalizedFrom,
        "Failed to rename path",
      );
      return { ok: true };
    } catch (error) {
      return this.fail("failed", "rename-failed", `Failed to rename ${normalizedFrom}.`, error);
    }
  }

  async delete(runtimeSession: RuntimeSession, path: string, options: FileDeleteOptions = {}): Promise<FileActionResult> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const args = options.recursive ? ["-rf", normalizedPath] : ["-f", normalizedPath];
    try {
      await this.fileCommandRunner.runFileAction(
        pod,
        "rm",
        args,
        normalizedPath,
        "Failed to delete path",
      );
      return { ok: true };
    } catch (error) {
      return this.fail("failed", "delete-failed", `Failed to delete ${normalizedPath}.`, error);
    }
  }

  private resolvePod(runtimeSession: RuntimeSession): BrowserPodLike {
    const pod = this.runtimeManager.resolvePod(runtimeSession);
    if (!pod) {
      throw new FileContractError({
        code: "runtime-session-invalid",
        message: "BrowserPod runtime session is not available.",
        recoverable: true,
      });
    }
    return pod;
  }

  private async openReadableFile(pod: BrowserPodLike, path: string): Promise<BrowserPodFileLike> {
    if (!pod.openFile) {
      throw new FileContractError({
        code: "file-read-failed",
        message: "BrowserPod openFile API is unavailable.",
        recoverable: true,
      });
    }
    return pod.openFile(path, "r");
  }

  private async openWritableFile(pod: BrowserPodLike, path: string): Promise<BrowserPodFileLike> {
    if (pod.openFile) {
      return pod.openFile(path, "w");
    }
    if (pod.createFile) {
      return pod.createFile(path, "w");
    }
    throw new FileContractError({
      code: "file-write-failed",
      message: "BrowserPod writable file API is unavailable.",
      recoverable: true,
    });
  }

  private fail(
    reason: FileActionFailureReason,
    code: FileErrorCode,
    message: string,
    cause?: unknown,
  ): FileActionResult {
    return {
      ok: false,
      reason,
      message,
      error: { code, message, recoverable: true, cause },
    };
  }
}

async function readFileSize(file: BrowserPodFileLike): Promise<number> {
  if (!file.getSize) return DEFAULT_TEXT_FILE_LIMIT_BYTES;
  return file.getSize();
}

async function readFileContent(file: BrowserPodFileLike, size: number): Promise<string> {
  if (!file.read) {
    throw new FileContractError({
      code: "file-read-failed",
      message: "BrowserPod file read API is unavailable.",
      recoverable: true,
    });
  }
  const data = await file.read(size);
  if (typeof data === "string") return data;
  return new TextDecoder().decode(data);
}

async function closeFile(file: BrowserPodFileLike): Promise<void> {
  try {
    await file.close?.();
  } catch {
    // BrowserPod file close is best-effort for adapter cleanup.
  }
}
