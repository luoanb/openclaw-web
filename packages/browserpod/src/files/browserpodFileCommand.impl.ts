import { FileContractError, type DirectorySnapshot, type FileEntry } from "os-core";
import type { BrowserPodLike } from "../runtime";
import { CustomTerminalCommandRunner } from "../command";
import { BrowserPodFilePath } from "./browserpodFilePath.impl";

const TEXT_FILE_SENTINEL = "__OPENCLAW_TEXT_FILE__";
const BINARY_FILE_SENTINEL = "__OPENCLAW_BINARY_FILE__";

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
