# web-claw os-core 契约 — 已废弃

| 属性 | 内容 |
|------|------|
| 状态 | Deprecated |
| 废弃时间 | 2026-05-25 |
| 替代真相源 | [`docs/sdd-lab/2026-05-24_21-16_container-runtime-management`](../sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md) |

## 废弃说明

本文是早期 `os-core` 运行与终端 MVP 草案，已被容器 runtime 管理 SDD 迭代取代，不再维护。

后续实现不得以本文的旧 `IRuntime`、`RuntimeBootOptions.storageKey/env`、`RuntimeSession.createTerminal/run/abort` 等草案为准。执行阶段以当前 SDD 迭代的 `requirements.md`、`technical-plan.md` 与 `references/exec-scheme-bridge.md` 为真相源。
# web-claw os-core 契约 — 容器 Runtime 管理

| 属性 | 内容 |
|------|------|
| 状态 | 已按容器管理迭代修订 |
| 产品来源 | [`docs/prd/prd-web-claw-light.md`](../prd/prd-web-claw-light.md) |
| SDD 来源 | [`docs/sdd-lab/2026-05-24_21-16_container-runtime-management`](../sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md) |
| 包边界 | `packages/os-core` |
| 实现方 | `packages/browserpod` |

## 1. 目标

定义 `packages/os-core` 在第一阶段暴露的稳定 runtime 管理契约，供 `apps/web-claw` 与 `packages/browserpod` 共同依赖。第一阶段先覆盖容器/runtime manager、session、capabilities、errors、events 与 snapshot；终端、文件和预览作为上层能力依赖已启动的 `RuntimeSession`，不由 runtime session 反向提供。

## 2. 边界

**包含**：

- Runtime 生命周期：未启动、检查中、启动中、运行中、停止中、已停止、失败、不支持。
- Runtime session：当前容器会话摘要、opaque ref 与能力声明。
- 检查结果：浏览器能力、跨源隔离、认证配置与 adapter 专属启动上下文。
- 事件：runtime 状态变化、检查结果、session 创建/停止、能力变化、错误。
- 错误分类：环境、认证、storage、启动、停止、session、能力不支持。

**不包含**：

- BrowserPod SDK 具体类型。
- 终端 prompt、输出、stdin、命令历史等交互细节。
- 文件树、服务预览、workspace 快照 schema 与具体 adapter。
- UI 组件、样式、布局。

## 3. 包职责

| 包 | 职责 |
|----|------|
| `packages/os-core` | 定义接口、类型、状态、错误、事件；可提供不依赖 BrowserPod 的轻量状态机或工具类。 |
| `packages/browserpod` | 实现 `os-core` 契约；封装 BrowserPod SDK；不得要求 app 直接 import BrowserPod。 |
| `apps/web-claw` | 只消费 `os-core` 契约和注入后的 runtime manager；不直接依赖 BrowserPod SDK。 |

## 4. 模块划分

建议 `packages/os-core` 内按以下域组织：

```text
src/
  runtime/
    runtime.interfaces.ts
    runtime.events.ts
    runtime.errors.ts
    runtimeState.impl.ts
  index.ts
```

命名遵循包规则：契约优先放在 `*.interfaces.ts`、`*.events.ts`、`*.errors.ts`，实现或状态机放在 `*.impl.ts`。

## 5. Runtime 契约

### 5.1 Runtime 状态

| 状态 | 用户含义 |
|------|----------|
| `idle` | 尚未启动，可启动。 |
| `checking` | 正在检查浏览器、隔离环境、认证配置等前置条件。 |
| `booting` | 正在初始化 BrowserPod 或等价 runtime。 |
| `running` | runtime session 可用，上层功能可依赖该 session。 |
| `stopping` | 正在执行容器关机。 |
| `stopped` | 已停止，可重新启动。 |
| `failed` | 启动或运行阶段失败，可展示错误并重试。 |
| `unsupported` | 当前浏览器或部署环境不支持启动。 |

### 5.2 Runtime Manager

```typescript
export type RuntimeStatus =
  | "idle"
  | "checking"
  | "booting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | "unsupported";

export type RuntimeBootOptions = {
  reason?: "app-open" | "manual" | "retry";
  sessionKey?: string;
};

export interface RuntimeManager {
  readonly status: RuntimeStatus;
  readonly capabilities: RuntimeCapabilities;
  readonly currentSession: RuntimeSession | null;

  check?(options?: RuntimeCheckOptions): Promise<RuntimeCheckResult>;
  boot(options?: RuntimeBootOptions): Promise<RuntimeSession>;
  stop(options?: RuntimeStopOptions): Promise<RuntimeActionResult>;
  getSnapshot(): RuntimeSnapshot;
  onEvent(listener: RuntimeEventListener): Unsubscribe;
}
```

`RuntimeBootOptions` 只能放通用启动意图；`apiKey`、`storageKey`、`env` 等 adapter 专属配置不得进入 `os-core` 通用契约。

### 5.3 Runtime Session

`RuntimeSession` 表示已启动 runtime 的稳定访问面。app 不应从中拿到底层 BrowserPod 实例；终端、文件、预览等上层能力接收该 session 后由各自 adapter 实现。

```typescript
export interface RuntimeSession {
  readonly id: string;
  readonly kind: RuntimeKind;
  readonly status: "running";
  readonly sessionKey?: string;
  readonly capabilities: RuntimeCapabilities;
  readonly ref: RuntimeSessionRef;

  onEvent(listener: RuntimeSessionEventListener): Unsubscribe;
}
```

`RuntimeSession` 不定义 `createTerminal()`、`run()`、`abort()` 或 `createPreview()`，避免容器层反向拥有上层能力。

### 5.4 Runtime Snapshot

```typescript
export type RuntimeSnapshot = {
  status: RuntimeStatus;
  capabilities: RuntimeCapabilities;
  session: RuntimeSessionSummary | null;
  lastCheck?: RuntimeCheckResult;
  lastError?: RuntimeError;
  updatedAt: number;
};
```

snapshot 用于 UI 初次渲染或恢复订阅前读取当前状态，不包含 BrowserPod、pod、terminal、process 等 SDK 对象。

## 6. 检查与结果

```typescript
export type RuntimeCheckResult = {
  ok: boolean;
  status: "supported" | "unsupported" | "misconfigured";
  issues: RuntimeCheckIssue[];
};

export type RuntimeActionResult =
  | { ok: true }
  | { ok: false; reason: RuntimeActionFailureReason; error?: RuntimeError };
```

`RuntimeManager.check()` 是可选方法。adapter 未实现时，通用语义是无需显式检查且检查通过；BrowserPod adapter 应实现该方法，因为它存在跨源隔离与认证配置前置条件。

## 7. 能力声明

```typescript
export type RuntimeCapabilities = {
  multipleTerminals: boolean;
  commandRun: boolean;
  processStdin: "supported" | "partial" | "unsupported" | "unknown";
  abortProcess: boolean;
  shutdown: "supported" | "unsupported" | "unknown";
  filePersistence: boolean;
  servicePreview: boolean;
};
```

capabilities 是能力摘要，不是运行状态。`RuntimeManager.capabilities` 可表达 adapter 静态能力或最近一次检查后的预估能力；`RuntimeSession.capabilities` 表达已启动 session 的实际能力，上层执行具体能力时以后者为准。

## 8. 事件契约

```typescript
export type RuntimeEvent =
  | { type: "runtime-status"; status: RuntimeStatus }
  | { type: "runtime-check"; result: RuntimeCheckResult }
  | { type: "runtime-session-created"; session: RuntimeSessionSummary }
  | { type: "runtime-session-stopped"; sessionId: string }
  | { type: "runtime-capabilities"; capabilities: RuntimeCapabilities }
  | { type: "runtime-error"; error: RuntimeError };

export type RuntimeEventListener = (event: RuntimeEvent) => void;

export type RuntimeSessionEvent =
  | { type: "runtime-session-status"; sessionId: string; status: "running" | "stopped" | "failed" }
  | { type: "runtime-session-capabilities"; sessionId: string; capabilities: RuntimeCapabilities }
  | { type: "runtime-session-error"; sessionId: string; error: RuntimeError };

export type RuntimeSessionEventListener = (event: RuntimeSessionEvent) => void;

export type Unsubscribe = () => void;
```

事件只暴露稳定摘要，不暴露 SDK 对象。`Unsubscribe` 必须幂等，调用后不应继续收到后续事件。

## 9. 错误分类

```typescript
export type RuntimeErrorCode =
  | "isolation-unavailable"
  | "browser-unsupported"
  | "auth-missing"
  | "auth-invalid"
  | "storage-key-invalid"
  | "boot-failed"
  | "stop-unsupported"
  | "stop-failed"
  | "session-not-running"
  | "capability-unsupported"
  | "unknown";

export type RuntimeError = {
  code: RuntimeErrorCode;
  message: string;
  recoverable: boolean;
  cause?: unknown;
};
```

错误文案可由 app 决定，但 `code` 必须稳定，便于 UI 做禁用态、重试入口和差异化提示。

## 10. 上层能力关系

终端、文件、预览等能力不得各自 boot runtime。它们应接收 `RuntimeSession` 作为前置依赖，例如：

```typescript
terminalService.createTerminal(runtimeSession, options);
```

`packages/os-core` 不定义 BrowserPod SDK 解析能力。BrowserPod adapter 内部可以解析 `RuntimeSessionRef` 取得私有 pod，但该能力不能进入 app 或通用契约。

## 11. Done Contract

- `packages/os-core` 可以在不引用 BrowserPod SDK 的前提下定义 runtime 管理契约。
- `packages/browserpod` 可以基于本文实现 BrowserPod runtime adapter，并把 `apiKey`、`storageKey` 等配置留在 adapter 层。
- `apps/web-claw` 可以只依赖 `packages/os-core` 的类型和注入后的 runtime manager 渲染容器状态。
- 第一阶段 runtime session 不包含终端、文件、预览的上层方法。

## 12. 待定

| 项 | 说明 |
|----|------|
| BrowserPod stop/dispose | 官方 reference 当前未列出 stop/dispose；adapter 仍需提供统一“容器关机”语义，但不承诺底层一定 dispose。 |
| 进程中止 API | 需核对 SDK 是否提供 kill/signal/handle；未确认前 `abortProcess` 保守声明。 |
| `pod.run` 返回值 | 需确认是否可稳定取得 exit code；不影响 runtime 管理契约。 |
| session ref 解析 | 仅 BrowserPod adapter 私有实现可解析，不进入 `os-core` 或 app。 |

## 13. 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-05-24 | 初稿；定义 `os-core` 第一阶段运行、进程、终端、事件与错误契约。 |
| 2026-05-25 | 按容器 runtime 管理迭代修订：`IRuntime` 升级为 `RuntimeManager`，移除通用 boot options 中的 BrowserPod 参数，移除 `RuntimeSession` 对终端/进程的反向调用，补充 check、snapshot、capabilities、errors 与 session event 契约。 |
# web-claw os-core 契约 — 运行与终端 MVP

| 属性 | 内容 |
|------|------|
| 状态 | 草稿 |
| 产品来源 | [`docs/prd/prd-web-claw-light.md`](../prd/prd-web-claw-light.md) |
| 包边界 | `packages/os-core` |
| 实现方 | `packages/browserpod` |

## 1. 目标

定义 `packages/os-core` 在第一阶段暴露的稳定契约，供 `apps/web-claw` 与 `packages/browserpod` 共同依赖。第一阶段只覆盖运行、进程、终端、错误和事件；文件管理、服务预览、workspace 快照仅保留未来扩展空间，不在本文定义。

## 2. 边界

**包含**：

- Runtime 生命周期：未启动、启动中、运行中、停止中、已停止、失败。
- 终端生命周期：创建、运行、聚焦、关闭、退出、异常。
- 进程/命令：启动命令、前台任务状态、中止当前任务。
- 事件：状态变化、终端输出、终端退出、错误。
- 错误分类：环境、认证、启动、终端、进程、中止、不支持能力。

**不包含**：

- BrowserPod SDK 具体类型。
- WebContainer / `web-os` 兼容层。
- 文件树、服务预览、workspace 快照 schema。
- UI 组件、样式、布局。

## 3. 包职责

| 包 | 职责 |
|----|------|
| `packages/os-core` | 定义接口、类型、状态、错误、事件；可提供不依赖 BrowserPod 的轻量状态机或工具类。 |
| `packages/browserpod` | 实现 `os-core` 契约；封装 BrowserPod SDK；不得要求 app 直接 import BrowserPod。 |
| `apps/web-claw` | 只消费 `os-core` 契约和注入后的 runtime 实例；不直接依赖 BrowserPod SDK。 |

## 4. 模块划分

建议 `packages/os-core` 内按以下域组织：

```text
src/
  runtime/
    runtime.interfaces.ts
    runtime.events.ts
    runtime.errors.ts
  terminal/
    terminal.interfaces.ts
    terminal.events.ts
  process/
    process.interfaces.ts
  index.ts
```

命名遵循包规则：契约优先放在 `*.interfaces.ts`，实现或状态机再放 `*.impl.ts`。

## 5. 运行契约

### 5.1 Runtime 状态

| 状态 | 用户含义 |
|------|----------|
| `idle` | 尚未启动，可启动。 |
| `booting` | 正在初始化 BrowserPod 或等价 runtime。 |
| `running` | runtime 可用，可创建/使用终端。 |
| `stopping` | 正在停止或释放 runtime。 |
| `stopped` | 已停止，可重新启动。 |
| `failed` | 启动或运行阶段失败，可展示错误并重试。 |

### 5.2 Runtime 接口草案

本文只固化语义，不要求立即逐字实现。

```typescript
export type RuntimeStatus =
  | "idle"
  | "booting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed";

export type RuntimeBootOptions = {
  storageKey?: string;
  env?: Record<string, string | undefined>;
};

export interface IRuntime {
  readonly status: RuntimeStatus;
  readonly capabilities: RuntimeCapabilities;

  boot(options?: RuntimeBootOptions): Promise<RuntimeSession>;
  stop(): Promise<void>;
  onEvent(listener: RuntimeEventListener): Unsubscribe;
}
```

### 5.3 RuntimeSession

`RuntimeSession` 表示已启动的运行时会话。app 不应从中拿到底层 BrowserPod 实例。

```typescript
export interface RuntimeSession {
  readonly id: string;
  readonly status: "running";

  createTerminal(options?: CreateTerminalOptions): Promise<TerminalSession>;
  run(request: ProcessRequest): Promise<ProcessResult>;
  abort(target: AbortTarget): Promise<AbortResult>;
}
```

## 6. 终端契约

### 6.1 终端状态

| 状态 | 用户含义 |
|------|----------|
| `creating` | 正在创建终端。 |
| `ready` | 可输入或可运行命令。 |
| `busy` | 当前终端存在前台任务。 |
| `exited` | 会话退出，不再接收输入。 |
| `closing` | 正在关闭。 |
| `closed` | 已关闭。 |
| `failed` | 终端创建或运行异常。 |

### 6.2 终端接口草案

```typescript
export type TerminalStatus =
  | "creating"
  | "ready"
  | "busy"
  | "exited"
  | "closing"
  | "closed"
  | "failed";

export type CreateTerminalOptions = {
  name?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
};

export interface TerminalSession {
  readonly id: string;
  readonly name: string;
  readonly status: TerminalStatus;

  write(input: string): Promise<void>;
  resize(cols: number, rows: number): void;
  close(): Promise<void>;
  onEvent(listener: TerminalEventListener): Unsubscribe;
}
```

### 6.3 多终端约束

- `os-core` 允许多个 `TerminalSession` 同时存在。
- 当前终端由 app 管理，`os-core` 不直接绑定 UI tab。
- 关闭终端只影响目标 `TerminalSession`。
- 若适配器不支持真正的长驻交互 shell，必须通过 `capabilities` 声明降级，并在 `TerminalEvent` 中暴露限制。

## 7. 进程契约

### 7.1 ProcessRequest

```typescript
export type ProcessRequest = {
  terminalId?: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  mode?: "foreground" | "background";
  echo?: boolean;
};
```

### 7.2 ProcessResult

```typescript
export type ProcessResult = {
  id: string;
  exitCode: number | null;
  aborted: boolean;
  startedAt: number;
  endedAt?: number;
};
```

### 7.3 中止

```typescript
export type AbortTarget =
  | { type: "terminal"; terminalId: string }
  | { type: "process"; processId: string };

export type AbortResult = {
  ok: boolean;
  reason?: string;
};
```

产品语义：中止默认作用于当前终端或当前进程；app 必须向用户展示作用范围。

## 8. 事件契约

```typescript
export type RuntimeEvent =
  | { type: "runtime-status"; status: RuntimeStatus }
  | { type: "runtime-error"; error: RuntimeError }
  | { type: "terminal-created"; terminal: TerminalSummary }
  | { type: "terminal-closed"; terminalId: string };

export type TerminalEvent =
  | { type: "terminal-status"; terminalId: string; status: TerminalStatus }
  | { type: "terminal-output"; terminalId: string; chunk: string }
  | { type: "terminal-exit"; terminalId: string; exitCode: number | null }
  | { type: "terminal-error"; terminalId: string; error: RuntimeError };

export type RuntimeEventListener = (event: RuntimeEvent) => void;
export type TerminalEventListener = (event: TerminalEvent) => void;
export type Unsubscribe = () => void;
```

## 9. 能力声明

```typescript
export type RuntimeCapabilities = {
  interactiveTerminal: boolean;
  multipleTerminals: boolean;
  abortProcess: boolean;
  stopRuntime: boolean;
};
```

第一阶段 app 必须根据 `capabilities` 做降级展示。例如 `interactiveTerminal: false` 时，不展示“可持续输入”的承诺。

## 10. 错误分类

```typescript
export type RuntimeErrorCode =
  | "isolation-unavailable"
  | "auth-missing"
  | "auth-invalid"
  | "boot-failed"
  | "stop-unsupported"
  | "terminal-create-failed"
  | "terminal-write-failed"
  | "process-run-failed"
  | "process-abort-failed"
  | "capability-unsupported"
  | "unknown";

export type RuntimeError = {
  code: RuntimeErrorCode;
  message: string;
  cause?: unknown;
  recoverable: boolean;
};
```

错误文案可由 app 决定，但 `code` 必须稳定，便于 UI 做禁用态、重试和提示。

## 11. Done Contract

- `apps/web-claw` 可以只依赖 `packages/os-core` 的类型完成运行/终端 UI 设计。
- `packages/browserpod` 可以基于本文逐项实现适配，不向 app 泄漏 BrowserPod SDK 类型。
- 第一阶段契约不包含文件管理、服务预览与 workspace 快照，避免提前固化未确认产品行为。

## 12. 待定

| 项 | 说明 |
|----|------|
| `stop()` 真实语义 | BrowserPod 是否有可用 dispose/stop；如无，是否仅做产品态停止。 |
| 交互终端能力 | BrowserPod SDK 默认终端是否满足 `write`/`resize`/`close` 契约。 |
| 多终端并发 | 是否允许多个终端同时运行前台任务。 |
| 事件粒度 | 输出事件是否需要区分 stdout/stderr。 |

## 13. 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-05-24 | 初稿；定义 `os-core` 第一阶段运行、进程、终端、事件与错误契约。 |
