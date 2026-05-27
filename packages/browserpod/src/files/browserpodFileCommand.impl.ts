import { DebugLogger, FileContractError, type DirectorySnapshot, type FileEntry, type FileErrorCode } from "os-core";
import type { BrowserPodLike } from "../runtime";
import { CustomTerminalCommandRunner } from "../command";
import { BrowserPodFilePath } from "./browserpodFilePath.impl";

const TEXT_FILE_SENTINEL = "__OPENCLAW_TEXT_FILE__";
const BINARY_FILE_SENTINEL = "__OPENCLAW_BINARY_FILE__";
const FILE_BASE64_START_SENTINEL = "__OPENCLAW_FILE_BASE64_START__";
const FILE_BASE64_END_SENTINEL = "__OPENCLAW_FILE_BASE64_END__";
const PATH_EXISTS_SENTINEL = "__OPENCLAW_PATH_EXISTS__";
const PATH_MISSING_SENTINEL = "__OPENCLAW_PATH_MISSING__";
const DELETE_SUCCESS_SENTINEL = "__OPENCLAW_DELETE_SUCCESS__";
const DELETE_MISSING_SENTINEL = "__OPENCLAW_DELETE_MISSING__";
const DELETE_TYPE_MISMATCH_SENTINEL = "__OPENCLAW_DELETE_TYPE_MISMATCH__";
const DELETE_FAILED_SENTINEL = "__OPENCLAW_DELETE_FAILED__";
const DELETE_STILL_EXISTS_SENTINEL = "__OPENCLAW_DELETE_STILL_EXISTS__";
const MAX_COPY_TARGET_ATTEMPTS = 100;

export class BrowserPodFileCommandRunner {
  private readonly commandRunner = new CustomTerminalCommandRunner();
  private readonly logger = new DebugLogger("browserpod.file.command");

  async listDirectory(pod: BrowserPodLike, path: string): Promise<DirectorySnapshot> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const result = await this.commandRunner.run(pod, "sh", ["-lc", `ls -l ${BrowserPodFilePath.shellQuote(normalizedPath)}`], {
      cwd: "/",
      timeoutMs: 15_000,
    });

    if (!result.ok) {
      throw new FileContractError({
        code: result.code === "timeout" ? "directory-read-failed" : "path-not-found",
        message: `Failed to read directory ${normalizedPath}.`,
        recoverable: true,
        cause: result,
      });
    }

    const entries = parseLongListOutput(result.output, normalizedPath);
    if (!entries) {
      throw new FileContractError({
        code: "directory-read-failed",
        message: `BrowserPod returned invalid directory data for ${normalizedPath}.`,
        recoverable: true,
        cause: result.output,
      });
    }

    return {
      path: normalizedPath,
      entries,
      readAt: Date.now(),
    };
  }

  async runFileAction(
    pod: BrowserPodLike,
    command: string,
    args: readonly string[],
    pathForMessage: string,
    fallbackMessage: string,
  ): Promise<void> {
    const script = [command, ...args.map((arg) => BrowserPodFilePath.shellQuote(arg))].join(" ");
    const result = await this.commandRunner.run(pod, "sh", ["-lc", script], {
      cwd: "/",
      timeoutMs: 15_000,
    });

    if (!result.ok) {
      throw new FileContractError({
        code: "unknown",
        message: `${fallbackMessage}: ${pathForMessage}`,
        recoverable: true,
        cause: result,
      });
    }
  }

  async pathExists(pod: BrowserPodLike, path: string): Promise<boolean> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const shellPath = BrowserPodFilePath.shellQuote(normalizedPath);
    const result = await this.commandRunner.run(
      pod,
      "sh",
      [
        "-lc",
        `if [ -e ${shellPath} ]; then printf '${PATH_EXISTS_SENTINEL}'; else printf '${PATH_MISSING_SENTINEL}'; fi`,
      ],
      {
        cwd: "/",
        timeoutMs: 15_000,
      },
    );

    const output = stripAnsi(result.output);
    if (output.includes(PATH_EXISTS_SENTINEL)) {
      return true;
    }
    if (output.includes(PATH_MISSING_SENTINEL)) {
      return false;
    }
    throw new FileContractError({
      code: "path-invalid",
      message: `Failed to check path ${normalizedPath}.`,
      recoverable: true,
      cause: result,
    });
  }

  async deletePath(
    pod: BrowserPodLike,
    path: string,
    options: { readonly recursive?: boolean } = {},
  ): Promise<void> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const recursive = Boolean(options.recursive);
    const startedAt = this.logger.start("deletePath", {
      path: normalizedPath,
      recursive,
    });
    const shellPath = BrowserPodFilePath.shellQuote(normalizedPath);
    const typeCheck = recursive
      ? `if [ ! -d "$target" ]; then printf '${DELETE_TYPE_MISMATCH_SENTINEL}'; exit 0; fi`
      : `if [ -d "$target" ]; then printf '${DELETE_TYPE_MISMATCH_SENTINEL}'; exit 0; fi`;
    const removeCommand = recursive ? `rm -rf "$target"` : `rm -- "$target"`;
    const script = [
      `target=${shellPath}`,
      `if [ ! -e "$target" ]; then printf '${DELETE_MISSING_SENTINEL}'; exit 0; fi`,
      typeCheck,
      removeCommand,
      `status=$?`,
      `if [ "$status" -ne 0 ]; then printf '${DELETE_FAILED_SENTINEL}'; exit 0; fi`,
      `if [ -e "$target" ]; then printf '${DELETE_STILL_EXISTS_SENTINEL}'; else printf '${DELETE_SUCCESS_SENTINEL}'; fi`,
    ].join("; ");
    const result = await this.commandRunner.run(pod, "sh", ["-lc", script], {
      cwd: "/",
      timeoutMs: 15_000,
    });
    const output = stripAnsi(result.output);

    if (output.includes(DELETE_SUCCESS_SENTINEL)) {
      this.logger.success("deletePath", startedAt, {
        path: normalizedPath,
        recursive,
      });
      return;
    }

    const errorCode: FileErrorCode = output.includes(DELETE_MISSING_SENTINEL)
      ? "path-not-found"
      : output.includes(DELETE_TYPE_MISMATCH_SENTINEL)
        ? "path-invalid"
        : "delete-failed";
    const reason = output.includes(DELETE_MISSING_SENTINEL)
      ? "path-not-found"
      : output.includes(DELETE_TYPE_MISMATCH_SENTINEL)
        ? "type-mismatch"
        : output.includes(DELETE_STILL_EXISTS_SENTINEL)
          ? "path-still-exists"
          : output.includes(DELETE_FAILED_SENTINEL)
            ? "rm-failed"
            : "invalid-delete-sentinel";
    this.logger.error("deletePath", reason, startedAt, {
      path: normalizedPath,
      recursive,
      errorCode,
      reason,
      commandOk: result.ok,
      commandCode: result.code,
      outputLength: output.length,
    });
    throw new FileContractError({
      code: errorCode,
      message: `Failed to delete ${normalizedPath}.`,
      recoverable: true,
      cause: {
        ...result,
        deleteReason: reason,
      },
    });
  }

  async readFileBase64(pod: BrowserPodLike, path: string, maxBytes: number): Promise<string> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const shellPath = BrowserPodFilePath.shellQuote(normalizedPath);
    const startedAt = this.logger.start("readFileBase64", {
      path: normalizedPath,
      maxBytes,
    });
    const script = [
      `p=${shellPath}`,
      `if [ ! -f "$p" ]; then exit 2; fi`,
      `size=$(wc -c < "$p" | tr -d ' ')`,
      `if [ "$size" -gt ${maxBytes} ]; then exit 3; fi`,
      `printf '${FILE_BASE64_START_SENTINEL}\\n'`,
      `base64 "$p"`,
      `printf '\\n${FILE_BASE64_END_SENTINEL}'`,
    ].join("; ");
    const result = await this.commandRunner.run(pod, "sh", ["-lc", script], {
      cwd: "/",
      timeoutMs: 30_000,
    });

    if (!result.ok) {
      this.logger.error("readFileBase64", result, startedAt, {
        path: normalizedPath,
        maxBytes,
        exitCode: result.code,
        outputLength: result.output.length,
      });
      throw new FileContractError({
        code: result.code === 2 ? "path-not-found" : result.code === 3 ? "file-too-large" : "file-read-failed",
        message:
          result.code === 3
            ? `File is larger than ${maxBytes} bytes: ${normalizedPath}`
            : `Failed to read file ${normalizedPath}.`,
        recoverable: true,
        cause: result,
      });
    }

    const output = stripAnsi(result.output);
    const start = output.indexOf(FILE_BASE64_START_SENTINEL);
    const end = output.indexOf(FILE_BASE64_END_SENTINEL);
    if (start < 0 || end < 0 || end <= start) {
      this.logger.error("readFileBase64", "invalid-base64-sentinel", startedAt, {
        path: normalizedPath,
        sentinelMatched: false,
        outputLength: output.length,
      });
      throw new FileContractError({
        code: "file-read-failed",
        message: `BrowserPod returned invalid base64 data for ${normalizedPath}.`,
        recoverable: true,
        cause: result,
      });
    }

    const base64 = output
      .slice(start + FILE_BASE64_START_SENTINEL.length, end)
      .replace(/\s+/g, "");
    this.logger.success("readFileBase64", startedAt, {
      path: normalizedPath,
      payloadLength: base64.length,
      sentinelMatched: true,
    });
    return base64;
  }

  async writeFileBase64(
    pod: BrowserPodLike,
    targetPath: string,
    tempBase64Path: string,
    options: { readonly overwrite?: boolean } = {},
  ): Promise<void> {
    const normalizedTargetPath = BrowserPodFilePath.normalize(targetPath);
    const normalizedTempPath = BrowserPodFilePath.normalize(tempBase64Path);
    const startedAt = this.logger.start("writeFileBase64", {
      targetPath: normalizedTargetPath,
      tempPath: normalizedTempPath,
      overwrite: Boolean(options.overwrite),
    });
    const overwriteCheck = options.overwrite
      ? ""
      : `if [ -e "$target" ]; then rm -f "$tmp"; exit 4; fi;`;
    const script = [
      `target=${BrowserPodFilePath.shellQuote(normalizedTargetPath)}`,
      `tmp=${BrowserPodFilePath.shellQuote(normalizedTempPath)}`,
      overwriteCheck,
      `base64 -d "$tmp" > "$target"`,
      `status=$?`,
      `rm -f "$tmp"`,
      `exit "$status"`,
    ]
      .filter(Boolean)
      .join("; ");
    const result = await this.commandRunner.run(pod, "sh", ["-lc", script], {
      cwd: "/",
      timeoutMs: 30_000,
    });

    if (!result.ok) {
      this.logger.error("writeFileBase64", result, startedAt, {
        targetPath: normalizedTargetPath,
        exitCode: result.code,
        outputLength: result.output.length,
      });
      throw new FileContractError({
        code: result.code === 4 ? "path-already-exists" : "file-write-failed",
        message:
          result.code === 4
            ? `Path already exists: ${normalizedTargetPath}`
            : `Failed to write file ${normalizedTargetPath}.`,
        recoverable: true,
        cause: result,
      });
    }
    this.logger.success("writeFileBase64", startedAt, {
      targetPath: normalizedTargetPath,
      outputLength: result.output.length,
    });
  }

  async copyPath(
    pod: BrowserPodLike,
    fromPath: string,
    toPath: string,
    kind: "file" | "directory",
    options: { readonly overwrite?: boolean } = {},
  ): Promise<{ readonly targetPath: string }> {
    const normalizedFrom = BrowserPodFilePath.normalize(fromPath);
    const normalizedTo = BrowserPodFilePath.normalize(toPath);
    const startedAt = this.logger.start("copyPath", {
      sourcePath: normalizedFrom,
      targetPath: normalizedTo,
      kind,
      overwrite: Boolean(options.overwrite),
    });
    if (kind === "directory" && normalizedTo.startsWith(`${normalizedFrom}/`)) {
      this.logger.blocked("copyPath", "copy-directory-into-itself", {
        sourcePath: normalizedFrom,
        targetPath: normalizedTo,
        kind,
      });
      throw new FileContractError({
        code: "path-invalid",
        message: `Cannot copy a directory into itself: ${normalizedFrom}`,
        recoverable: true,
      });
    }

    const targetPath = await this.resolveCopyTarget(pod, normalizedTo, options);

    const sourceCheck = kind === "directory" ? `if [ ! -d "$src" ]; then exit 2; fi` : `if [ ! -f "$src" ]; then exit 2; fi`;
    const copyCommand = kind === "directory" ? `cp -r "$src" "$target"` : `cp ${options.overwrite ? "-f " : ""}"$src" "$target"`;
    const script = [
      `src=${BrowserPodFilePath.shellQuote(normalizedFrom)}`,
      `target=${BrowserPodFilePath.shellQuote(targetPath)}`,
      sourceCheck,
      copyCommand,
    ].join("; ");
    const result = await this.commandRunner.run(pod, "sh", ["-lc", script], {
      cwd: "/",
      timeoutMs: 30_000,
    });

    if (!result.ok) {
      this.logger.error("copyPath", result, startedAt, {
        sourcePath: normalizedFrom,
        targetPath,
        kind,
        exitCode: result.code,
      });
      throw new FileContractError({
        code: result.code === 2 ? "path-not-found" : "copy-failed",
        message: `Failed to copy ${normalizedFrom} to ${targetPath}.`,
        recoverable: true,
        cause: result,
      });
    }

    this.logger.success("copyPath", startedAt, {
      sourcePath: normalizedFrom,
      targetPath,
      kind,
    });
    return { targetPath };
  }

  private async resolveCopyTarget(
    pod: BrowserPodLike,
    normalizedTo: string,
    options: { readonly overwrite?: boolean },
  ): Promise<string> {
    const startedAt = this.logger.start("resolveCopyTarget", {
      targetPath: normalizedTo,
      overwrite: Boolean(options.overwrite),
    });
    if (options.overwrite) {
      this.logger.success("resolveCopyTarget", startedAt, {
        targetPath: normalizedTo,
        attempts: 0,
        overwrite: true,
      });
      return normalizedTo;
    }
    if (!(await this.pathExists(pod, normalizedTo))) {
      this.logger.success("resolveCopyTarget", startedAt, {
        targetPath: normalizedTo,
        attempts: 1,
      });
      return normalizedTo;
    }

    for (let index = 1; index <= MAX_COPY_TARGET_ATTEMPTS; index += 1) {
      const candidate = BrowserPodFilePath.copyName(normalizedTo, index);
      if (!(await this.pathExists(pod, candidate))) {
        this.logger.success("resolveCopyTarget", startedAt, {
          targetPath: candidate,
          attempts: index + 1,
        });
        return candidate;
      }
    }

    this.logger.error("resolveCopyTarget", "copy-target-exhausted", startedAt, {
      targetPath: normalizedTo,
      attempts: MAX_COPY_TARGET_ATTEMPTS,
    });
    throw new FileContractError({
      code: "path-already-exists",
      message: `No available copy target for ${normalizedTo}.`,
      recoverable: true,
    });
  }

  async isTextFile(pod: BrowserPodLike, path: string): Promise<boolean> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const shellPath = BrowserPodFilePath.shellQuote(normalizedPath);
    const script = [
      `p=${shellPath}`,
      `if [ ! -f "$p" ]; then exit 2; fi`,
      `if [ ! -s "$p" ]; then printf '${TEXT_FILE_SENTINEL}'; exit 0; fi`,
      `if LC_ALL=C grep -Iq "" "$p"; then printf '${TEXT_FILE_SENTINEL}'; exit 0; fi`,
      `status=$?`,
      `if [ "$status" -eq 1 ]; then printf '${BINARY_FILE_SENTINEL}'; exit 0; fi`,
      `exit "$status"`,
    ].join("; ");
    const result = await this.commandRunner.run(pod, "sh", ["-lc", script], {
      cwd: "/",
      timeoutMs: 15_000,
    });
    if (!result.ok) {
      throw new FileContractError({
        code: result.code === 2 ? "path-not-found" : "file-read-failed",
        message: `Failed to inspect file ${normalizedPath}.`,
        recoverable: true,
        cause: result,
      });
    }

    const output = stripAnsi(result.output);
    if (output.includes(TEXT_FILE_SENTINEL)) {
      return true;
    }
    if (output.includes(BINARY_FILE_SENTINEL)) {
      return false;
    }
    throw new FileContractError({
      code: "file-read-failed",
      message: `BrowserPod returned invalid file inspection data for ${normalizedPath}.`,
      recoverable: true,
      cause: result,
    });
  }
}

function parseLongListOutput(output: string, parentPath: string): readonly FileEntry[] | null {
  const lines = output.split(/\r?\n/).map((line) => stripAnsi(line).trim()).filter(Boolean);
  const entryLines = lines.filter((line) => !line.startsWith("total "));
  const entries = entryLines.map((line) => parseLongListEntry(line, parentPath)).filter((entry): entry is FileEntry => Boolean(entry));
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

function parseLongListEntry(line: string, parentPath: string): FileEntry | null {
  const match = /^(\S+)\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(line);
  if (!match) return null;
  const [, mode, rawName] = match;
  if (!mode || !rawName) return null;
  const name = rawName.replace(/\s+->\s+.+$/, "");

  return {
    name,
    path: BrowserPodFilePath.join(parentPath, name),
    kind: mode.startsWith("d") ? "directory" : "file",
  };
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}
