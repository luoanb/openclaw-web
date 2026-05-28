import type { RuntimeSession } from "../runtime";

export type InjectionReason = "boot" | "manual" | "repair";

export type InjectionStatus = "created" | "unchanged" | "updated" | "repaired" | "failed";

/**
 * Platform-neutral reference to a script asset managed outside the container.
 */
export type InjectionScriptAsset = {
  readonly sourcePath: string;
  readonly filename: string;
  readonly checksum?: string;
};

/**
 * Public description of a command script that a runtime implementation can inject.
 */
export type InjectionScript = {
  readonly id: string;
  readonly command: string;
  readonly runner: string;
  readonly version: string;
  readonly asset: InjectionScriptAsset;
  readonly description?: string;
};

export type InjectionOptions = {
  readonly force?: boolean;
  readonly reason?: InjectionReason;
  readonly scripts?: readonly InjectionScript[];
};

export type InjectionCommandSummary = {
  readonly command: string;
  readonly runner: string;
};

export type InjectionError = {
  readonly code: "unsupported" | "write-failed" | "invalid-state" | "unknown";
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
};

export type InjectionResult =
  | {
      readonly ok: true;
      readonly status: Exclude<InjectionStatus, "failed">;
      readonly commands: readonly InjectionCommandSummary[];
      readonly warnings?: readonly string[];
    }
  | {
      readonly ok: false;
      readonly status: "failed";
      readonly commands: readonly InjectionCommandSummary[];
      readonly warnings?: readonly string[];
      readonly error: InjectionError;
    };

export interface InjectionService {
  inject(runtimeSession: RuntimeSession, options?: InjectionOptions): Promise<InjectionResult>;
  getSnapshot?(runtimeSession: RuntimeSession): Promise<InjectionResult>;
}
