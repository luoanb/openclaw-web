import type { RuntimeSession } from "../runtime";
import type { FileError } from "./file.errors";

export type FileEntryKind = "file" | "directory" | "unknown";

export type FileEntry = {
  readonly name: string;
  readonly path: string;
  readonly kind: FileEntryKind;
  readonly size?: number;
  readonly mtimeMs?: number;
};

export type DirectorySnapshot = {
  readonly path: string;
  readonly entries: readonly FileEntry[];
  readonly readAt: number;
};

export type TextFileSnapshot = {
  readonly path: string;
  readonly content: string;
  readonly encoding: "utf-8";
  readonly readAt: number;
  readonly size?: number;
};

export type TextFileInspectionResult =
  | {
      readonly ok: true;
      readonly path: string;
      readonly encoding: "utf-8";
      readonly size?: number;
    }
  | {
      readonly ok: false;
      readonly path: string;
      readonly reason: FileActionFailureReason;
      readonly message: string;
      readonly error?: FileError;
      readonly size?: number;
    };

export type FileWriteOptions = {
  readonly overwrite?: boolean;
};

export type FileDeleteOptions = {
  readonly recursive?: boolean;
};

export type FileActionFailureReason = "blocked" | "unsupported" | "failed";

export type FileActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: FileActionFailureReason;
      readonly message: string;
      readonly error?: FileError;
    };

export interface FileService {
  getDefaultPath(runtimeSession: RuntimeSession): string;
  listDirectory(runtimeSession: RuntimeSession, path: string): Promise<DirectorySnapshot>;
  inspectTextFile(runtimeSession: RuntimeSession, path: string): Promise<TextFileInspectionResult>;
  readTextFile(runtimeSession: RuntimeSession, path: string): Promise<TextFileSnapshot>;
  writeTextFile(
    runtimeSession: RuntimeSession,
    path: string,
    content: string,
    options?: FileWriteOptions,
  ): Promise<FileActionResult>;
  createFile(runtimeSession: RuntimeSession, path: string, content?: string): Promise<FileActionResult>;
  createDirectory(runtimeSession: RuntimeSession, path: string): Promise<FileActionResult>;
  rename(runtimeSession: RuntimeSession, fromPath: string, toPath: string): Promise<FileActionResult>;
  delete(runtimeSession: RuntimeSession, path: string, options?: FileDeleteOptions): Promise<FileActionResult>;
}
