import type { BrowserPodLike } from "../runtime";

export type BrowserPodCommandRunOptions = {
  readonly cwd?: string;
  readonly timeoutMs?: number;
};

export type BrowserPodCommandRunResult = {
  readonly ok: boolean;
  readonly code?: number | string;
  readonly output: string;
};

export interface BrowserPodCommandRunner {
  run(
    pod: BrowserPodLike,
    command: string,
    args: readonly string[],
    options?: BrowserPodCommandRunOptions,
  ): Promise<BrowserPodCommandRunResult>;
}
