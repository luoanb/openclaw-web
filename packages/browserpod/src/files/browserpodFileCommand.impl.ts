import { FileContractError, type DirectorySnapshot, type FileEntry } from "os-core";
import type { BrowserPodLike } from "../runtime";
import { CustomTerminalCommandRunner } from "../command";
import { BrowserPodFilePath } from "./browserpodFilePath.impl";

const TEXT_FILE_SENTINEL = "__OPENCLAW_TEXT_FILE__";
const BINARY_FILE_SENTINEL = "__OPENCLAW_BINARY_FILE__";
const FILE_BASE64_START_SENTINEL = "__OPENCLAW_FILE_BASE64_START__";
const FILE_BASE64_END_SENTINEL = "__OPENCLAW_FILE_BASE64_END__";
const PATH_EXISTS_SENTINEL = "__OPENCLAW_PATH_EXISTS__";
const PATH_MISSING_SENTINEL = "__OPENCLAW_PATH_MISSING__";
const MAX_COPY_TARGET_ATTEMPTS = 100;

export class BrowserPodFileCommandRunner {
  private readonly commandRunner = new CustomTerminalCommandRunner();

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
    if (output.includes(PATH_EXISTS_SENTINEL)) return true;
    if (output.includes(PATH_MISSING_SENTINEL)) return false;
    throw new FileContractError({
      code: "path-invalid",
      message: `Failed to check path ${normalizedPath}.`,
      recoverable: true,
      cause: result,
    });
  }

  async readFileBase64(pod: BrowserPodLike, path: string, maxBytes: number): Promise<string> {
    const normalizedPath = BrowserPodFilePath.normalize(path);
    const shellPath = BrowserPodFilePath.shellQuote(normalizedPath);
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
      throw new FileContractError({
        code: "file-read-failed",
        message: `BrowserPod returned invalid base64 data for ${normalizedPath}.`,
        recoverable: true,
        cause: result,
      });
    }

    return output
      .slice(start + FILE_BASE64_START_SENTINEL.length, end)
      .replace(/\s+/g, "");
  }

  async writeFileBase64(
    pod: BrowserPodLike,
    targetPath: string,
    tempBase64Path: string,
    options: { readonly overwrite?: boolean } = {},
  ): Promise<void> {
    const normalizedTargetPath = BrowserPodFilePath.normalize(targetPath);
    const normalizedTempPath = BrowserPodFilePath.normalize(tempBase64Path);
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
    if (kind === "directory" && normalizedTo.startsWith(`${normalizedFrom}/`)) {
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
      throw new FileContractError({
        code: result.code === 2 ? "path-not-found" : "copy-failed",
        message: `Failed to copy ${normalizedFrom} to ${targetPath}.`,
        recoverable: true,
        cause: result,
      });
    }

    return { targetPath };
  }

  private async resolveCopyTarget(
    pod: BrowserPodLike,
    normalizedTo: string,
    options: { readonly overwrite?: boolean },
  ): Promise<string> {
    if (options.overwrite) return normalizedTo;
    if (!(await this.pathExists(pod, normalizedTo))) return normalizedTo;

    for (let index = 1; index <= MAX_COPY_TARGET_ATTEMPTS; index += 1) {
      const candidate = BrowserPodFilePath.copyName(normalizedTo, index);
      if (!(await this.pathExists(pod, candidate))) {
        return candidate;
      }
    }

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
    console.debug("[BrowserPodFileCommandRunner]", "isTextFile:result", {
      path: normalizedPath,
      ok: result.ok,
      code: result.code,
      output: stripAnsi(result.output).slice(0, 500),
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
    if (output.includes(TEXT_FILE_SENTINEL)) return true;
    if (output.includes(BINARY_FILE_SENTINEL)) return false;
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
