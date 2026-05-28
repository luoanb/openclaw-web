import {
  DebugLogger,
  FileContractError,
  type BinaryFileSnapshot,
  type DirectorySnapshot,
  type FileActionFailureReason,
  type FileActionResult,
  type FileBytesWriteOptions,
  type FileCopyKind,
  type FileCopyOptions,
  type FileDeleteOptions,
  type FileErrorCode,
  type FileService,
  type RuntimeSession,
  type TextFileInspectionResult,
  type TextFileSnapshot,
} from "os-core";
import { BrowserPodRuntimeManager } from "../runtime";
import type { BrowserPodFileLike, BrowserPodLike } from "../runtime";
import { BrowserPodFileCommandRunner } from "./browserpodFileCommand.impl";
import { BrowserPodFilePath } from "./browserpodFilePath.impl";

const BROWSERPOD_DEFAULT_FILE_PATH = "/home/user";
const DEFAULT_TEXT_FILE_LIMIT_BYTES = 1024 * 1024;
const DEFAULT_BINARY_FILE_LIMIT_BYTES = 100 * 1024 * 1024;
const BROWSERPOD_TEXT_FILE_MODE = "utf-8";
const BROWSERPOD_BINARY_FILE_MODE = "binary";

export class BrowserPodFileService implements FileService {
  private readonly fileCommandRunner = new BrowserPodFileCommandRunner();
  private readonly logger = new DebugLogger("browserpod.file");

  constructor(private readonly runtimeManager: BrowserPodRuntimeManager) {}

  getDefaultPath(_runtimeSession: RuntimeSession): string {
    return BROWSERPOD_DEFAULT_FILE_PATH;
  }

  async listDirectory(runtimeSession: RuntimeSession, path: string): Promise<DirectorySnapshot> {
    return this.fileCommandRunner.listDirectory(this.resolvePod(runtimeSession), path);
  }

  async inspectTextFile(runtimeSession: RuntimeSession, path: string): Promise<TextFileInspectionResult> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const pod = this.resolvePod(runtimeSession);
    try {
      const file = await this.openReadableFile(pod, normalizedPath);
      let size: number;
      try {
        size = await readFileSize(file);
      } finally {
        await closeFile(file);
      }

      if (size > DEFAULT_TEXT_FILE_LIMIT_BYTES) {
        return {
          ok: false,
          path: normalizedPath,
          reason: "unsupported",
          message: `File is larger than ${DEFAULT_TEXT_FILE_LIMIT_BYTES} bytes: ${normalizedPath}`,
          error: {
            code: "file-too-large",
            message: `File is larger than ${DEFAULT_TEXT_FILE_LIMIT_BYTES} bytes: ${normalizedPath}`,
            recoverable: true,
          },
          size,
        };
      }

      const isText = await this.fileCommandRunner.isTextFile(pod, normalizedPath);
      if (!isText) {
        return {
          ok: false,
          path: normalizedPath,
          reason: "unsupported",
          message: `File is not a text file: ${normalizedPath}`,
          error: {
            code: "unsupported-file-type",
            message: `File is not a text file: ${normalizedPath}`,
            recoverable: true,
          },
          size,
        };
      }

      return {
        ok: true,
        path: normalizedPath,
        encoding: "utf-8",
        size,
      };
    } catch (error) {
      if (error instanceof FileContractError) {
        return {
          ok: false,
          path: normalizedPath,
          reason: "failed",
          message: error.message,
          error: error.fileError,
        };
      }
      return {
        ok: false,
        path: normalizedPath,
        reason: "failed",
        message: `Failed to inspect file ${normalizedPath}.`,
        error: {
          code: "file-read-failed",
          message: `Failed to inspect file ${normalizedPath}.`,
          recoverable: true,
          cause: error,
        },
      };
    }
  }

  async readTextFile(runtimeSession: RuntimeSession, path: string): Promise<TextFileSnapshot> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const pod = this.resolvePod(runtimeSession);
    const file = await this.openReadableFile(pod, normalizedPath);
    try {
      const size = await readFileSize(file);
      if (size > DEFAULT_TEXT_FILE_LIMIT_BYTES) {
        throw new FileContractError({
          code: "file-too-large",
          message: `File is larger than ${DEFAULT_TEXT_FILE_LIMIT_BYTES} bytes: ${normalizedPath}`,
          recoverable: true,
        });
      }

      const isText = await this.fileCommandRunner.isTextFile(pod, normalizedPath);
      if (!isText) {
        throw new FileContractError({
          code: "unsupported-file-type",
          message: `File is not a text file: ${normalizedPath}`,
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

  async readFileBytes(runtimeSession: RuntimeSession, path: string): Promise<BinaryFileSnapshot> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const startedAt = this.logger.start("readFileBytes", { path: normalizedPath });
    try {
      const base64 = await this.fileCommandRunner.readFileBase64(pod, normalizedPath, DEFAULT_BINARY_FILE_LIMIT_BYTES);
      const content = base64ToArrayBuffer(base64);
      this.logger.success("readFileBytes", startedAt, {
        path: normalizedPath,
        size: content.byteLength,
        payloadLength: base64.length,
      });
      return {
        path: normalizedPath,
        content,
        readAt: Date.now(),
        size: content.byteLength,
      };
    } catch (error) {
      this.logger.error("readFileBytes", error, startedAt, { path: normalizedPath });
      throw error;
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

  async writeFileBytes(
    runtimeSession: RuntimeSession,
    path: string,
    content: ArrayBuffer,
    options: FileBytesWriteOptions = {},
  ): Promise<FileActionResult> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const startedAt = this.logger.start("writeFileBytes", {
      targetPath: normalizedPath,
      size: content.byteLength,
      overwrite: Boolean(options.overwrite),
    });
    if (content.byteLength > DEFAULT_BINARY_FILE_LIMIT_BYTES) {
      this.logger.blocked("writeFileBytes", "file-too-large", {
        targetPath: normalizedPath,
        size: content.byteLength,
      });
      return this.fail(
        "unsupported",
        "file-too-large",
        `File is larger than ${DEFAULT_BINARY_FILE_LIMIT_BYTES} bytes: ${normalizedPath}`,
      );
    }
    try {
      if (!options.overwrite && (await this.fileCommandRunner.pathExists(pod, normalizedPath))) {
        this.logger.blocked("writeFileBytes", "path-already-exists", { targetPath: normalizedPath });
        return this.fail("failed", "path-already-exists", `Path already exists: ${normalizedPath}`);
      }

      const file = await this.openWritableBinaryFile(pod, normalizedPath, options);
      try {
        if (!file.write) {
          return this.fail("unsupported", "file-write-failed", "BrowserPod file write API is unavailable.");
        }
        await file.write(content);
      } finally {
        await closeFile(file);
      }
      this.logger.success("writeFileBytes", startedAt, {
        targetPath: normalizedPath,
        size: content.byteLength,
        mode: BROWSERPOD_BINARY_FILE_MODE,
      });
      return { ok: true };
    } catch (error) {
      this.logger.error("writeFileBytes", error, startedAt, { targetPath: normalizedPath });
      if (error instanceof FileContractError) {
        return this.fail("failed", error.fileError.code, error.message, error);
      }
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
      const file = await pod.createFile(normalizedPath, BROWSERPOD_TEXT_FILE_MODE);
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

  async copyPath(
    runtimeSession: RuntimeSession,
    fromPath: string,
    toPath: string,
    kind: FileCopyKind,
    options: FileCopyOptions = {},
  ): Promise<FileActionResult> {
    const pod = this.resolvePod(runtimeSession);
    const normalizedFrom = BrowserPodFilePath.normalize(fromPath);
    const normalizedTo = BrowserPodFilePath.normalize(toPath);
    const startedAt = this.logger.start("copyPath", {
      sourcePath: normalizedFrom,
      targetPath: normalizedTo,
      kind,
      overwrite: Boolean(options.overwrite),
    });
    try {
      await this.fileCommandRunner.copyPath(pod, normalizedFrom, normalizedTo, kind, options);
      this.logger.success("copyPath", startedAt, {
        sourcePath: normalizedFrom,
        targetPath: normalizedTo,
        kind,
      });
      return { ok: true };
    } catch (error) {
      this.logger.error("copyPath", error, startedAt, {
        sourcePath: normalizedFrom,
        targetPath: normalizedTo,
        kind,
      });
      if (error instanceof FileContractError) {
        return this.fail("failed", error.fileError.code, error.message, error);
      }
      return this.fail("failed", "copy-failed", `Failed to copy ${normalizedFrom} to ${normalizedTo}.`, error);
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
    const startedAt = this.logger.start("deletePath", {
      path: normalizedPath,
      recursive: Boolean(options.recursive),
    });
    try {
      await this.fileCommandRunner.deletePath(pod, normalizedPath, options);
      this.logger.success("deletePath", startedAt, {
        path: normalizedPath,
        recursive: Boolean(options.recursive),
      });
      return { ok: true };
    } catch (error) {
      this.logger.error("deletePath", error, startedAt, {
        path: normalizedPath,
        recursive: Boolean(options.recursive),
      });
      if (error instanceof FileContractError) {
        return this.fail("failed", error.fileError.code, error.message, error);
      }
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
    return pod.openFile(path, BROWSERPOD_TEXT_FILE_MODE);
  }

  private async openWritableFile(pod: BrowserPodLike, path: string): Promise<BrowserPodFileLike> {
    if (pod.openFile) {
      return pod.openFile(path, BROWSERPOD_TEXT_FILE_MODE);
    }
    if (pod.createFile) {
      return pod.createFile(path, BROWSERPOD_TEXT_FILE_MODE);
    }
    throw new FileContractError({
      code: "file-write-failed",
      message: "BrowserPod writable file API is unavailable.",
      recoverable: true,
    });
  }

  private async openWritableBinaryFile(
    pod: BrowserPodLike,
    path: string,
    options: FileBytesWriteOptions,
  ): Promise<BrowserPodFileLike> {
    if (options.overwrite && pod.openFile) {
      return pod.openFile(path, BROWSERPOD_BINARY_FILE_MODE);
    }
    if (pod.createFile) {
      return pod.createFile(path, BROWSERPOD_BINARY_FILE_MODE);
    }
    throw new FileContractError({
      code: "file-create-failed",
      message: "BrowserPod binary file create API is unavailable.",
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

function base64ToArrayBuffer(content: string): ArrayBuffer {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
