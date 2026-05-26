export type FileErrorCode =
  | "runtime-session-invalid"
  | "path-invalid"
  | "path-not-found"
  | "directory-read-failed"
  | "file-read-failed"
  | "file-write-failed"
  | "file-create-failed"
  | "directory-create-failed"
  | "rename-failed"
  | "delete-failed"
  | "unsupported-file-type"
  | "file-too-large"
  | "unknown";

export type FileError = {
  readonly code: FileErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
};

export class FileContractError extends Error {
  readonly fileError: FileError;

  constructor(fileError: FileError) {
    super(fileError.message);
    this.name = "FileContractError";
    this.fileError = fileError;
  }
}
