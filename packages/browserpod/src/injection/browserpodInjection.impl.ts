import type {
  InjectionCommandSummary,
  InjectionOptions,
  InjectionResult,
  InjectionScript,
  InjectionService,
  InjectionStatus,
  RuntimeSession,
} from "os-core";
import type { BrowserPodFileLike, BrowserPodLike } from "../runtime/browserpodRuntime.interfaces";
import { BrowserPodScriptRegistry } from "./browserpodScriptRegistry.impl";
import type { BrowserPodInjectionConfig, BrowserPodInjectionScript } from "./browserpodInjection.interfaces";

const DEFAULT_BASE_PATH = "/home/user/.container-tools";
const TEXT_MODE = "utf-8";
const SHELL_BLOCK_START = "# >>> container-tools managed block >>>";
const SHELL_BLOCK_END = "# <<< container-tools managed block <<<";

type BrowserPodResolver = {
  resolvePod(runtimeSession: RuntimeSession): BrowserPodLike | null;
};

type ManifestScript = {
  readonly id: string;
  readonly command: string;
  readonly version: string;
  readonly checksum: string;
};

type InjectionManifest = {
  readonly version: 1;
  readonly updatedAt: string;
  readonly scripts: readonly ManifestScript[];
};

type WriteOutcome = "created" | "updated" | "repaired" | "unchanged" | "skipped";

type InjectionContext = {
  readonly manifest: InjectionManifest | null;
};

type ScriptInstallResult = {
  readonly manifestScript: ManifestScript;
  readonly outcomes: readonly WriteOutcome[];
};

export class BrowserPodInjectionService implements InjectionService {
  private readonly basePath: string;
  private readonly scripts: readonly BrowserPodInjectionScript[];

  constructor(
    private readonly runtimeManager: BrowserPodResolver,
    config: BrowserPodInjectionConfig = {},
  ) {
    this.basePath = trimTrailingSlash(config.basePath ?? DEFAULT_BASE_PATH);
    this.scripts = config.scripts ?? BrowserPodScriptRegistry.getDefaultScripts();
  }

  async inject(runtimeSession: RuntimeSession, options: InjectionOptions = {}): Promise<InjectionResult> {
    const pod = this.runtimeManager.resolvePod(runtimeSession);
    const scripts = this.resolveScripts(options.scripts);
    const commands = scripts.map((script) => ({ command: script.command, runner: script.runner }));
    const warnings: string[] = [];

    if (!pod) {
      return fail("invalid-state", "BrowserPod runtime session is not available.", commands);
    }
    if (!pod.createDirectory || (!pod.createFile && !pod.openFile)) {
      return fail("unsupported", "BrowserPod file APIs are unavailable for script injection.", commands);
    }

    try {
      const force = Boolean(options.force);
      const context = await this.prepareInjectionContext(pod);
      const installedScripts = await this.installScripts(pod, scripts, context, force, warnings);
      const manifestScripts = installedScripts.map((result) => result.manifestScript);
      const outcomes = installedScripts.flatMap((result) => result.outcomes);

      outcomes.push(...await this.installShellActivation(pod, scripts, force, warnings));
      outcomes.push(await this.writeManifestFile(pod, context.manifest, manifestScripts));

      return {
        ok: true,
        status: summarizeStatus(outcomes),
        commands,
        warnings: warnings.length ? warnings : undefined,
      };
    } catch (cause) {
      return fail("write-failed", "Failed to inject BrowserPod container scripts.", commands, cause, warnings);
    }
  }

  async getSnapshot(runtimeSession: RuntimeSession): Promise<InjectionResult> {
    const pod = this.runtimeManager.resolvePod(runtimeSession);
    const commands = this.scripts.map((script) => ({ command: script.command, runner: script.runner }));
    if (!pod) {
      return fail("invalid-state", "BrowserPod runtime session is not available.", commands);
    }
    const manifest = await this.readManifest(pod);
    return {
      ok: true,
      status: manifest ? "unchanged" : "created",
      commands,
    };
  }

  private resolveScripts(scripts?: readonly InjectionScript[]): readonly BrowserPodInjectionScript[] {
    if (!scripts) return this.scripts;
    return scripts.map((script) => {
      if (isBrowserPodInjectionScript(script)) return script;
      throw new Error(`BrowserPod injection script is missing an asset loader: ${script.id}`);
    });
  }

  private async createManagedDirectories(pod: BrowserPodLike): Promise<void> {
    await pod.createDirectory?.(this.basePath, { recursive: true });
    await pod.createDirectory?.(this.scriptsPath(), { recursive: true });
    await pod.createDirectory?.(this.metaPath(), { recursive: true });
    await pod.createDirectory?.(this.shellPath(), { recursive: true });
  }

  private async prepareInjectionContext(pod: BrowserPodLike): Promise<InjectionContext> {
    await this.createManagedDirectories(pod);
    const manifest = await this.readManifest(pod);
    return { manifest };
  }

  private async installScripts(
    pod: BrowserPodLike,
    scripts: readonly BrowserPodInjectionScript[],
    context: InjectionContext,
    force: boolean,
    warnings: string[],
  ): Promise<readonly ScriptInstallResult[]> {
    const results: ScriptInstallResult[] = [];
    for (const script of scripts) {
      results.push(await this.installScript(pod, script, context, force, warnings));
    }
    return results;
  }

  private async installScript(
    pod: BrowserPodLike,
    script: BrowserPodInjectionScript,
    context: InjectionContext,
    force: boolean,
    warnings: string[],
  ): Promise<ScriptInstallResult> {
    const content = await script.load();
    const checksum = checksumText(content);
    const previous = context.manifest?.scripts.find((item) => item.id === script.id);
    const scriptPath = this.scriptPath(script);
    const outcomes: WriteOutcome[] = [];

    outcomes.push(await this.writeManagedFile(pod, scriptPath, content, previous?.checksum, checksum, force, warnings));

    return {
      manifestScript: {
        id: script.id,
        command: script.command,
        version: script.version,
        checksum,
      },
      outcomes,
    };
  }

  private async installShellActivation(
    pod: BrowserPodLike,
    scripts: readonly BrowserPodInjectionScript[],
    force: boolean,
    warnings: string[],
  ): Promise<readonly WriteOutcome[]> {
    return [
      await this.writeShellConfig(pod, scripts, force, warnings),
      await this.writeProfileSourceBlock(pod, "/home/user/.profile", force, warnings),
      await this.writeProfileSourceBlock(pod, "/home/user/.bashrc", force, warnings),
    ];
  }

  private async readManifest(pod: BrowserPodLike): Promise<InjectionManifest | null> {
    const content = await this.readTextFile(pod, this.manifestPath());
    if (!content) return null;
    try {
      return JSON.parse(content) as InjectionManifest;
    } catch {
      return null;
    }
  }

  private async writeManagedFile(
    pod: BrowserPodLike,
    path: string,
    content: string,
    previousChecksum: string | undefined,
    nextChecksum: string,
    force: boolean,
    warnings: string[],
  ): Promise<WriteOutcome> {
    const existing = await this.readTextFile(pod, path);
    if (existing === content) return "unchanged";
    if (existing !== null && previousChecksum && checksumText(existing) !== previousChecksum && !force) {
      warnings.push(`Skipped user-modified managed file: ${path}`);
      return "skipped";
    }
    if (existing !== null && !previousChecksum && !force) {
      warnings.push(`Skipped existing unmanaged file: ${path}`);
      return "skipped";
    }

    await this.writeTextFile(pod, path, content);
    return existing === null ? "created" : previousChecksum === nextChecksum ? "repaired" : "updated";
  }

  private async writeShellConfig(
    pod: BrowserPodLike,
    scripts: readonly BrowserPodInjectionScript[],
    force: boolean,
    warnings: string[],
  ): Promise<WriteOutcome> {
    const aliases = scripts.map((script) => `alias ${script.command}=${shellQuote(this.createAliasCommand(script))}`).join("\n");
    const content = [
      aliases,
      "",
    ].join("\n");
    return this.writeManagedFile(pod, this.shellConfigPath(), content, checksumText(content), checksumText(content), force, warnings);
  }

  private async writeManifestFile(
    pod: BrowserPodLike,
    previousManifest: InjectionManifest | null,
    scripts: readonly ManifestScript[],
  ): Promise<WriteOutcome> {
    const existing = await this.readTextFile(pod, this.manifestPath());
    const updatedAt = previousManifest && sameManifestScripts(previousManifest.scripts, scripts)
      ? previousManifest.updatedAt
      : new Date().toISOString();
    const content = JSON.stringify({
      version: 1,
      updatedAt,
      scripts,
    } satisfies InjectionManifest, null, 2);

    if (existing === content) return "unchanged";
    await this.writeTextFile(pod, this.manifestPath(), content);
    return existing === null ? "created" : "updated";
  }

  private async writeProfileSourceBlock(
    pod: BrowserPodLike,
    profilePath: string,
    force: boolean,
    warnings: string[],
  ): Promise<WriteOutcome> {
    const sourceLine = `[ -f ${shellQuote(this.shellConfigPath())} ] && . ${shellQuote(this.shellConfigPath())}`;
    const block = `${SHELL_BLOCK_START}\n${sourceLine}\n${SHELL_BLOCK_END}`;
    const existing = await this.readTextFile(pod, profilePath);
    if (!existing) {
      await this.writeTextFile(pod, profilePath, `${block}\n`);
      return "created";
    }

    const start = existing.indexOf(SHELL_BLOCK_START);
    const end = existing.indexOf(SHELL_BLOCK_END);
    if (start >= 0 && end > start) {
      const blockEnd = end + SHELL_BLOCK_END.length;
      const currentBlock = existing.slice(start, blockEnd);
      if (currentBlock === block) return "unchanged";
      if (!force) {
        warnings.push(`Skipped modified profile block: ${profilePath}`);
        return "skipped";
      }
      await this.writeTextFile(pod, profilePath, `${existing.slice(0, start)}${block}${existing.slice(blockEnd)}`);
      return "updated";
    }

    const separator = existing.endsWith("\n") ? "" : "\n";
    await this.writeTextFile(pod, profilePath, `${existing}${separator}${block}\n`);
    return "repaired";
  }

  private async readTextFile(pod: BrowserPodLike, path: string): Promise<string | null> {
    if (!pod.openFile) return null;
    try {
      const file = await pod.openFile(path, TEXT_MODE);
      try {
        const size = await readFileSize(file);
        if (!file.read) return "";
        const data = await file.read(size);
        return typeof data === "string" ? data : new TextDecoder().decode(data);
      } finally {
        await closeFile(file);
      }
    } catch {
      return null;
    }
  }

  private async writeTextFile(pod: BrowserPodLike, path: string, content: string): Promise<void> {
    const file = await this.openWritableFile(pod, path);
    if (!file?.write) {
      throw new Error(`BrowserPod writable file API is unavailable: ${path}`);
    }
    try {
      await file.write(content);
    } finally {
      await closeFile(file);
    }
    const written = await this.readTextFile(pod, path);
    if (written !== content) {
      throw new Error(`BrowserPod file write verification failed: ${path}`);
    }
  }

  private async openWritableFile(pod: BrowserPodLike, path: string): Promise<BrowserPodFileLike | undefined> {
    if (pod.createFile) {
      try {
        return await pod.createFile(path, TEXT_MODE);
      } catch {
        // Fall through to openFile for runtimes that cannot recreate existing files.
      }
    }
    if (pod.openFile) {
      try {
        return await pod.openFile(path, TEXT_MODE);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private createAliasCommand(script: BrowserPodInjectionScript): string {
    return `${script.runner} ${this.scriptPath(script)}`;
  }

  private scriptsPath(): string {
    return `${this.basePath}/scripts`;
  }

  private metaPath(): string {
    return `${this.basePath}/meta`;
  }

  private shellPath(): string {
    return `${this.basePath}/shell`;
  }

  private manifestPath(): string {
    return `${this.metaPath()}/manifest.json`;
  }

  private shellConfigPath(): string {
    return `${this.shellPath()}/container-tools.sh`;
  }

  private scriptPath(script: BrowserPodInjectionScript): string {
    return `${this.scriptsPath()}/${script.asset.filename}`;
  }

}

function isBrowserPodInjectionScript(script: InjectionScript): script is BrowserPodInjectionScript {
  return typeof (script as { readonly load?: unknown }).load === "function";
}

function summarizeStatus(outcomes: readonly WriteOutcome[]): Exclude<InjectionStatus, "failed"> {
  if (outcomes.includes("created")) return "created";
  if (outcomes.includes("updated")) return "updated";
  if (outcomes.includes("repaired")) return "repaired";
  return "unchanged";
}

function sameManifestScripts(left: readonly ManifestScript[], right: readonly ManifestScript[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return Boolean(other)
      && item.id === other.id
      && item.command === other.command
      && item.version === other.version
      && item.checksum === other.checksum;
  });
}

function fail(
  code: "unsupported" | "write-failed" | "invalid-state" | "unknown",
  message: string,
  commands: readonly InjectionCommandSummary[],
  cause?: unknown,
  warnings?: readonly string[],
): InjectionResult {
  return {
    ok: false,
    status: "failed",
    commands,
    warnings: warnings?.length ? warnings : undefined,
    error: {
      code,
      message,
      recoverable: true,
      cause,
    },
  };
}

async function readFileSize(file: BrowserPodFileLike): Promise<number> {
  if (!file.getSize) return 0;
  return file.getSize();
}

async function closeFile(file: BrowserPodFileLike): Promise<void> {
  try {
    await file.close?.();
  } catch {
    // BrowserPod file close is best-effort for adapter cleanup.
  }
}

function checksumText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
