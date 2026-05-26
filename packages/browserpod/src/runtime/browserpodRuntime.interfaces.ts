import type { RuntimeBootOptions, RuntimeCheckOptions, RuntimeStopOptions } from "os-core";

export type BrowserPodRuntimeRequest = {
  readonly bootOptions?: RuntimeBootOptions;
  readonly checkOptions?: RuntimeCheckOptions;
  readonly stopOptions?: RuntimeStopOptions;
};

export type BrowserPodBootOptions = {
  readonly apiKey: string;
  readonly storageKey: string;
};

export type BrowserPodLike = {
  readonly run?: BrowserPodRun;
  readonly onPortal?: unknown;
  readonly createDirectory?: BrowserPodCreateDirectory;
  readonly createFile?: BrowserPodCreateFile;
  readonly openFile?: BrowserPodOpenFile;
  readonly createDefaultTerminal?: BrowserPodCreateDefaultTerminal;
  readonly createCustomTerminal?: BrowserPodCreateCustomTerminal;
};

export type BrowserPodRunOptions = {
  readonly echo?: boolean;
  readonly terminal: BrowserPodTerminalLike;
  readonly cwd?: string;
};

export type BrowserPodRun = (
  command: string,
  args: string[],
  options: BrowserPodRunOptions,
) => unknown;

export type BrowserPodCreateDefaultTerminal = (element: HTMLElement) => BrowserPodTerminalLike | Promise<BrowserPodTerminalLike>;

export type BrowserPodCreateCustomTerminal = (options: {
  readonly cols?: number;
  readonly rows?: number;
  readonly onOutput: (buffer: ArrayBuffer | Uint8Array, vt?: unknown) => void;
}) => Promise<BrowserPodTerminalLike>;

export type BrowserPodCreateDirectory = (path: string, options?: { readonly recursive?: boolean }) => Promise<void>;

export type BrowserPodCreateFile = (path: string, mode: string) => Promise<BrowserPodFileLike>;

export type BrowserPodOpenFile = (path: string, mode: string) => Promise<BrowserPodFileLike>;

export type BrowserPodFileLike = {
  readonly write?: (data: string | ArrayBuffer) => Promise<number>;
  readonly read?: (length: number) => Promise<string | ArrayBuffer>;
  readonly getSize?: () => Promise<number>;
  readonly close?: () => Promise<void>;
};

/**
 * Terminal handle from createDefaultTerminal / createCustomTerminal.
 * SDK @2.8.0 index.d.ts declares empty `Terminal`; `write` is runtime-only on the instance.
 * Probe: demos/browserpod-demo custom-terminal → terminal.write (not pod, not Process).
 * Capability: custom terminal — onOutput yes; programmatic write does not feed pod.run stdin.
 * See docs/sdd-lab/.../references/browserpod-sdk-runtime.types.md
 */
export type BrowserPodTerminalLike = {
  readonly write?: (input: string) => void | Promise<void>;
  readonly resize?: (cols: number, rows: number) => unknown;
  readonly close?: () => unknown;
  readonly writeInput?: (input: string) => void | Promise<void>;
  readonly writeStdin?: (input: string) => void | Promise<void>;
  readonly input?: BrowserPodTerminalStreamLike;
  readonly stdin?: BrowserPodTerminalStreamLike;
};

export type BrowserPodTerminalStreamLike = {
  readonly write?: (input: string) => void | Promise<void>;
  readonly getWriter?: () => {
    write(chunk: string | Uint8Array): Promise<void>;
    releaseLock?(): Promise<void>;
  };
};

/** pod.run sync return; npm `Process` is empty — probe: cosProcess (main.js). */
export type BrowserPodRunReturnLike = {
  readonly cosProcess?: Promise<unknown>;
};

export interface BrowserPodBooter {
  boot(options: BrowserPodBootOptions): Promise<BrowserPodLike>;
}

export interface BrowserPodEnvironment {
  isCrossOriginIsolated(): boolean;
}

export type BrowserPodRuntimeConfig = {
  readonly apiKeyProvider: () => string | Promise<string>;
  readonly storageKeyResolver: (request: BrowserPodRuntimeRequest) => string;
  readonly booter?: BrowserPodBooter;
  readonly environment?: BrowserPodEnvironment;
};
