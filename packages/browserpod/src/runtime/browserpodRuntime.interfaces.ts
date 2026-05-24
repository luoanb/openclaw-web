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
  readonly createDirectory?: unknown;
  readonly createFile?: unknown;
  readonly openFile?: unknown;
  readonly createDefaultTerminal?: BrowserPodCreateDefaultTerminal;
  readonly createCustomTerminal?: BrowserPodCreateCustomTerminal;
};

export type BrowserPodRunOptions = {
  readonly terminal: BrowserPodTerminalLike;
  readonly cwd?: string;
};

export type BrowserPodRun = (
  command: string,
  args: string[],
  options: BrowserPodRunOptions,
) => Promise<unknown>;

export type BrowserPodCreateDefaultTerminal = (element: HTMLElement) => BrowserPodTerminalLike;

export type BrowserPodCreateCustomTerminal = (options: {
  readonly cols?: number;
  readonly rows?: number;
  readonly onOutput: (buffer: ArrayBuffer | Uint8Array, vt?: unknown) => void;
}) => Promise<BrowserPodTerminalLike>;

export type BrowserPodTerminalLike = {
  readonly write?: (input: string) => unknown;
  readonly resize?: (cols: number, rows: number) => unknown;
  readonly close?: () => unknown;
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
