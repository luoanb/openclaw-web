import {
  RuntimeContractError,
  RuntimeSessionState,
  RuntimeStateMachine,
  type RuntimeActionResult,
  type RuntimeBootOptions,
  type RuntimeCapabilities,
  type RuntimeCheckIssue,
  type RuntimeCheckOptions,
  type RuntimeCheckResult,
  type RuntimeEventListener,
  type RuntimeManager,
  type RuntimeSession,
  type RuntimeSnapshot,
  type RuntimeStatus,
  type RuntimeStopOptions,
  type Unsubscribe,
} from "os-core";
import { BrowserPodErrorMapper } from "../errors/browserpodErrorMapper.impl";
import { BrowserPodInjectionService } from "../injection/browserpodInjection.impl";
import { DefaultBrowserPodBooter } from "./browserpodBooter.impl";
import type {
  BrowserPodBooter,
  BrowserPodEnvironment,
  BrowserPodLike,
  BrowserPodRuntimeConfig,
  BrowserPodRuntimeRequest,
} from "./browserpodRuntime.interfaces";

export const BROWSERPOD_RUNTIME_CAPABILITIES: RuntimeCapabilities = {
  multipleTerminals: true,
  commandRun: true,
  processStdin: "partial",
  abortProcess: false,
  shutdown: "unknown",
  filePersistence: true,
  servicePreview: true,
};

export class BrowserPodRuntimeManager implements RuntimeManager {
  private readonly config: BrowserPodRuntimeConfig;
  private readonly booter: BrowserPodBooter;
  private readonly environment: BrowserPodEnvironment;
  private readonly injectionService: BrowserPodInjectionService | null;
  private readonly injectionRequired: boolean;
  private readonly state = new RuntimeStateMachine({
    capabilities: BROWSERPOD_RUNTIME_CAPABILITIES,
  });
  private readonly podByToken = new WeakMap<object, BrowserPodLike>();
  private bootContextKey: string | null = null;

  constructor(config: BrowserPodRuntimeConfig) {
    this.config = config;
    this.booter = config.booter ?? new DefaultBrowserPodBooter();
    this.environment = config.environment ?? defaultBrowserPodEnvironment;
    this.injectionService = config.injection === false ? null : new BrowserPodInjectionService(this, config.injection);
    this.injectionRequired = config.injection !== false && config.injection?.required === true;
  }

  get status(): RuntimeStatus {
    return this.state.status;
  }

  get capabilities(): RuntimeCapabilities {
    return this.state.capabilities;
  }

  get currentSession(): RuntimeSession | null {
    return this.state.currentSession;
  }

  async check(options?: RuntimeCheckOptions): Promise<RuntimeCheckResult> {
    this.state.setStatus("checking");
    const issues: RuntimeCheckIssue[] = [];

    if (!this.environment.isCrossOriginIsolated()) {
      issues.push({
        code: "isolation-unavailable",
        message: "BrowserPod requires cross-origin isolation.",
        recoverable: false,
      });
    }

    const request = { checkOptions: options };
    const apiKey = await this.resolveApiKey(issues);
    const storageKey = this.resolveStorageKey(request, issues);

    const result = createCheckResult(issues);
    this.state.setCheckResult(result);

    if (result.ok && apiKey && storageKey) {
      this.state.setCapabilities(BROWSERPOD_RUNTIME_CAPABILITIES);
    }

    return result;
  }

  async boot(options?: RuntimeBootOptions): Promise<RuntimeSession> {
    const request = { bootOptions: options };
    const storageKey = this.config.storageKeyResolver(request);
    const contextKey = `${storageKey}:${options?.sessionKey ?? ""}`;

    if (this.currentSession && this.status === "running" && this.bootContextKey === contextKey) {
      return this.currentSession;
    }

    const check = await this.check(options);
    if (!check.ok) {
      const firstIssue = check.issues[0];
      const status = check.status === "unsupported" ? "unsupported" : "failed";
      const error = {
        code: firstIssue?.code ?? "unknown",
        message: firstIssue?.message ?? "BrowserPod runtime check failed.",
        recoverable: firstIssue?.recoverable ?? true,
      };
      this.state.setError(error, status);
      throw new RuntimeContractError(error);
    }

    const apiKey = await this.config.apiKeyProvider();
    this.state.setStatus("booting");

    try {
      const pod = await this.booter.boot({ apiKey, storageKey });
      const session = new RuntimeSessionState({
        id: createRuntimeSessionId(),
        kind: "browserpod",
        sessionKey: options?.sessionKey,
        capabilities: BROWSERPOD_RUNTIME_CAPABILITIES,
      });
      this.podByToken.set(session.ref.token, pod);
      if (this.injectionService) {
        const injectionResult = await this.injectionService.inject(session, { reason: "boot", force: true });
        if (!injectionResult.ok && this.injectionRequired) {
          throw new RuntimeContractError({
            code: "boot-failed",
            message: injectionResult.error.message,
            recoverable: injectionResult.error.recoverable,
            cause: injectionResult.error.cause,
          });
        }
      }
      this.bootContextKey = contextKey;
      this.state.setSession(session);
      return session;
    } catch (error) {
      const runtimeError = BrowserPodErrorMapper.toRuntimeError(error, "boot-failed");
      this.state.setError(runtimeError, "failed");
      throw new RuntimeContractError(runtimeError);
    }
  }

  async stop(_options?: RuntimeStopOptions): Promise<RuntimeActionResult> {
    if (!this.currentSession) {
      return {
        ok: false,
        reason: "not-running",
        error: {
          code: "session-not-running",
          message: "BrowserPod runtime session is not running.",
          recoverable: true,
        },
      };
    }

    this.state.setStatus("stopping");
    const token = this.currentSession.ref.token;
    this.podByToken.delete(token);
    this.bootContextKey = null;
    this.state.clearSession("stopped");
    return { ok: true };
  }

  getSnapshot(): RuntimeSnapshot {
    return this.state.getSnapshot();
  }

  onEvent(listener: RuntimeEventListener): Unsubscribe {
    return this.state.onEvent(listener);
  }

  resolvePod(session: RuntimeSession): BrowserPodLike | null {
    return this.podByToken.get(session.ref.token) ?? null;
  }

  private async resolveApiKey(issues: RuntimeCheckIssue[]): Promise<string | null> {
    try {
      const apiKey = await this.config.apiKeyProvider();
      if (!apiKey) {
        issues.push({
          code: "auth-missing",
          message: "BrowserPod API key is missing.",
          recoverable: true,
        });
        return null;
      }
      return apiKey;
    } catch (error) {
      issues.push({
        code: "auth-missing",
        message: BrowserPodErrorMapper.toRuntimeError(error, "auth-missing").message,
        recoverable: true,
      });
      return null;
    }
  }

  private resolveStorageKey(request: BrowserPodRuntimeRequest, issues: RuntimeCheckIssue[]): string | null {
    try {
      const storageKey = this.config.storageKeyResolver(request);
      if (!storageKey) {
        issues.push({
          code: "storage-key-invalid",
          message: "BrowserPod storageKey is invalid.",
          recoverable: true,
        });
        return null;
      }
      return storageKey;
    } catch (error) {
      issues.push({
        code: "storage-key-invalid",
        message: BrowserPodErrorMapper.toRuntimeError(error, "storage-key-invalid").message,
        recoverable: true,
      });
      return null;
    }
  }
}

function createCheckResult(issues: readonly RuntimeCheckIssue[]): RuntimeCheckResult {
  if (issues.length === 0) {
    return { ok: true, status: "supported", issues: [] };
  }

  const hasUnsupportedIssue = issues.some((issue) =>
    issue.code === "isolation-unavailable" || issue.code === "browser-unsupported",
  );

  return {
    ok: false,
    status: hasUnsupportedIssue ? "unsupported" : "misconfigured",
    issues,
  };
}

function createRuntimeSessionId(): string {
  return `browserpod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultBrowserPodEnvironment: BrowserPodEnvironment = {
  isCrossOriginIsolated() {
    return globalThis.crossOriginIsolated === true;
  },
};
