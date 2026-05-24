# Technical Plan / 技术方案: Container Runtime Management

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`
- 需求确认状态：`Approved for technical planning`
- 本方案覆盖范围：
  - `os-core` 容器/runtime 管理契约。
  - BrowserPod adapter 对该契约的实现边界。
  - 容器状态、能力、错误、事件、session 与上层功能的关系。
  - 与终端统一交互方案的依赖关系。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `docs/specs/2026-05-24_18-00_web-claw-core-contract.md`
  - `docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md`
  - `docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/technical-plan.md`
  - `docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`
- 当前实现事实：
  - 当前仓库已有 `packages/web-os`，但尚未落地 `packages/os-core` 与 `packages/browserpod` 源码包。
  - 旧 specs 已有 `IRuntime` / `RuntimeSession` 草案，但状态、能力与错误粒度不足以承载容器管理前置依赖。
  - BrowserPod 官方 reference 记录 `BrowserPod.boot({ apiKey, nodeVersion?, storageKey? })`；`storageKey` 用于在同 origin 或多 tab 下分配独立磁盘。
  - BrowserPod 官方 BrowserPod 方法列表包含 `boot`、`run`、`onPortal`、`createDirectory`、`createFile`、`openFile`、`createDefaultTerminal`，未列出 stop/dispose。
  - BrowserPod demo 已验证固定 `storageKey`、多默认终端、运行命令与部分 stdin 能力。
- BrowserPod demo 的成功命令运行证据使用 `await pod.createDefaultTerminal(element)` 后的 terminal handle，再调用 `pod.run(command, args, { echo: true, terminal, cwd })`；web-claw terminal adapter 应沿用该调用形态，默认 cwd 使用已验证的 `/home/user`。
- 约束与风险：
  - app 和 UI 不应直接 import BrowserPod SDK 类型。
  - 终端、文件、预览等上层能力必须复用同一个 runtime session。
  - stop/dispose、进程中止、错误对象细节仍需实现前核对 SDK。
  - API Key 不应在 UI 明文展示，也不得提交 `.env`。

## Proposed Solution / 拟定方案

- 方案摘要：
  - 在 `packages/os-core` 先定义容器管理 API，作为终端、文件、预览等能力的上游契约。
  - `packages/browserpod` 只作为 adapter 实现该契约，封装 BrowserPod boot、环境检查、错误映射和 session 管理。
  - `apps/web-claw` 只消费 `os-core` 的 runtime manager / runtime session，不直接认识 BrowserPod。
  - 终端、文件、预览等上层能力接收 runtime session 作为前置依赖，再调用各自 adapter；容器层不反向调用这些上层能力。
- 为什么选择该方案：
  - 容器生命周期是共享基础设施，不应内聚在终端模块。
  - 契约先行可以让 BrowserPod、WebContainer 或其他 runtime 后续以 adapter 方式接入。
  - app 的错误展示和功能禁用可由稳定状态、capabilities 和事件驱动。
- 不采用的方案：
  - 不让每个 feature 自行 boot BrowserPod。
  - 不在终端 adapter 中读取 API Key 或处理 COOP/COEP。
  - 不把 BrowserPod SDK 实例透传给 app。
  - 不在 stop/dispose 未确认前承诺底层资源已经完全释放。
  - 不让容器层暴露 `createTerminal()`、`run()`、`createPreview()` 等上层能力方法。

## API Contract / API 契约

### 包边界

- `packages/os-core`：
  - 定义 runtime manager、runtime session、capabilities、errors、events、action result。
  - 可提供不依赖 BrowserPod 的状态机类或工具类。
- `packages/browserpod`：
  - 实现 `os-core` 的 runtime adapter。
  - 封装 BrowserPod SDK、API Key 读取、`storageKey` 映射、错误转换。
- `apps/web-claw`：
  - 注入或创建 runtime manager。
  - 根据 runtime 状态和事件渲染容器状态，不直接调用 BrowserPod SDK。

### 状态模型

状态不是 BrowserPod SDK 直接暴露的枚举，而是 `os-core` 为 app 和 adapter 之间约定的稳定生命周期抽象。来源分三层：

- 旧 `docs/specs/2026-05-24_18-00_web-claw-core-contract.md` 已有 `idle`、`booting`、`running`、`stopping`、`stopped`、`failed` 草案。
- 容器管理需求新增了启动前检查语义，因此需要 `checking`，用来区分“还没真正 boot，只是在检查浏览器、隔离环境、认证配置”。
- 启动前检查通过后需要一个可供业务层直接判断的稳定状态，因此需要 `supported`，表示“环境与配置已通过检查、尚未启动 runtime、允许用户启动容器”。
- 容器管理需求要求区分普通失败与环境不支持，因此需要 `unsupported`，避免把缺 COOP/COEP、浏览器不支持这类问题混成普通 `failed`。

这些状态服务于上层交互，而不是复刻底层 SDK。它们用于决定：是否显示启动入口、是否禁用终端输入、UI 是否提供手动重试入口、错误文案如何区分、多个功能是否能复用同一个 session。

```typescript
export type RuntimeStatus =
  | "idle"
  | "checking"
  | "supported"
  | "booting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | "unsupported";
```

- `idle`：尚未启动，可检查或启动。
- `checking`：正在做浏览器、隔离环境、认证配置等前置检查；这是瞬时态，检查完成后必须转入 `supported`、`failed` 或 `unsupported`，不得停留在 `checking`。
- `supported`：前置检查通过，runtime 尚未启动；UI 可展示启动入口，业务层无需再从 `lastCheck.status` 推断可启动性。
- `booting`：正在启动 BrowserPod 或等价 runtime。
- `running`：runtime session 可用。
- `stopping`：容器正在关机。
- `stopped`：容器已关机，可重新启动。
- `failed`：启动或运行失败，runtime 产出错误；UI 可展示错误并提供用户手动重试入口。
- `unsupported`：当前环境不支持启动，通常不能靠重试恢复。

### 启动选项

```typescript
export type RuntimeBootOptions = {
  reason?: "app-open" | "manual" | "retry";
  sessionKey?: string;
};
```

- 通用 boot options 只能放所有 runtime 都能理解的启动意图。
- `reason` 用于日志、事件和 UI 解释，不影响 adapter 专属配置。
- `sessionKey` 是可选的逻辑会话键，用于复用或区分容器会话；它不是 BrowserPod `storageKey` 的同义词。
- `apiKey`、`storageKey`、`env` 都不属于通用 `os-core` boot 契约：
  - `apiKey` 是 BrowserPod adapter 的认证配置。
  - `storageKey` 是 BrowserPod adapter 的持久化参数。
  - `env` 属于具体 runtime 或进程运行配置。

BrowserPod 这类 adapter 需要自己的配置契约，例如：

```typescript
export type BrowserPodRuntimeConfig = {
  apiKeyProvider: () => string | Promise<string>;
  storageKeyResolver: (request: BrowserPodRuntimeRequest) => string;
};
```

该配置由 `packages/browserpod` 或 app 装配层注入，不进入 `os-core` 的通用 `RuntimeBootOptions`。

### 能力声明

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

- runtime capabilities 是容器能力摘要，不是上层能力调用入口。
- runtime capabilities 不是运行状态。运行状态由 `RuntimeStatus` 表达，capabilities 表达“这个 runtime/session 能做什么，以及可靠程度如何”。
- capabilities 分两层：
  - adapter 静态能力：由适配器实现时决定，例如 BrowserPod adapter 天然知道自己是否计划支持 Portal、文件持久化、多终端等能力。
  - session 实际能力：在 `check()` / `boot()` 后根据浏览器环境、认证配置、SDK 返回结果、实测能力和当前 session 修正。
- `RuntimeManager.capabilities` 可以是 adapter 静态能力或最近一次检查后的预估能力。
- `RuntimeSession.capabilities` 是已启动 session 的实际能力；上层执行具体功能时应以后者为准。
- 它用于告诉终端、文件、预览等上层服务：当前 runtime 大致支持什么、哪些能力可靠、哪些能力未知或只部分可用。
- capabilities 可以在 boot 前给出静态/预估值，也可以在 boot 后由 session 给出实际值；上层能力执行时应以后者为准。
- capability 面向上层行为，不暴露 `interactive-shell` / `command-runner` 等 adapter 内部策略。
- `processStdin` 使用多值而不是 boolean，避免把 BrowserPod 的部分 stdin 证据误判为完整能力。
- `shutdown` 表示适配层是否能完成“容器关机”语义；底层是否有真实 dispose 不拆成用户可见概念。

### Runtime Manager

```typescript
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

- `check()` 是可选方法，只做前置条件检查，不启动 runtime。
- 若 adapter 未实现 `check()`，`RuntimeManager` 的通用语义是“无需显式检查，默认检查通过”。
- 默认通过结果应等价于 `{ ok: true, status: "supported", issues: [] }`，但不要求 adapter 为此实现空方法。
- `boot()` 是唯一启动入口；同一 manager 在 `running` 时应复用当前 session，不重复 boot。
- `stop()` 负责容器关机；底层没有官方 dispose 时，由 adapter 完成会话失效、引用清理和状态切换。
- `getSnapshot()` 给 UI 同步读取当前状态，避免只靠事件重建。
- `onEvent()` 返回 `Unsubscribe`，调用方在组件卸载或不再关心事件时必须调用它。

### 订阅清理

```typescript
export type Unsubscribe = () => void;
```

- `Unsubscribe` 是订阅清理函数，用于移除之前注册的 listener。
- 它必须是幂等的：重复调用不应抛错，也不应产生额外副作用。
- 它不返回 Promise；事件订阅清理应是同步的本地引用移除。
- 调用后，manager/session 不应再向该 listener 推送后续事件。
- 这类约定用于避免页面切换、组件卸载或 tab 关闭后仍然保留旧监听器。

### Runtime Snapshot

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

- `RuntimeSnapshot` 是 runtime manager 的只读状态快照，用于 UI 首次渲染或恢复订阅前的当前态。
- snapshot 不包含 BrowserPod、pod、terminal、process 等 SDK 对象。
- `session` 只放 `RuntimeSessionSummary`，用于展示当前会话 id、kind、sessionKey 和能力摘要；真正的 `RuntimeSession` 仍由 manager 持有并通过 `currentSession` 暴露。
- `lastCheck` 用于解释最近一次前置检查结果，例如缺 COOP/COEP 或 API Key；若 adapter 没有 `check()`，该字段可以为空或记录默认通过结果。
- `lastError` 用于恢复 UI 错误态，不替代 `runtime-error` 事件。

### Runtime Session

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

- session 代表已启动 runtime 的稳定访问面。
- session 只表达容器本身的状态、能力摘要和一个 opaque `ref`。
- `ref` 只用于把同一个容器会话传给上层 adapter，不允许 app 从中取得 BrowserPod SDK 对象。
- 终端、文件、预览能力应由各自服务接收 `RuntimeSession` 后调用自己的 adapter，例如 `terminalService.createTerminal(runtimeSession, options)`。
- 容器层不得反向调用终端、文件、预览等上层内容，也不得在 `RuntimeSession` 上定义 `createTerminal()`、`run()`、`createPreview()` 这类上层方法。
- BrowserPod adapter 内部可以把 `RuntimeSessionRef` 解析回私有 pod 引用，但该解析能力不能进入 `os-core` 或 app。

### 检查与结果

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

- `unsupported` 用于浏览器、隔离环境等用户刷新也无法立即恢复的问题。
- `misconfigured` 用于 API Key 缺失、部署 header 缺失等可配置问题。
- action result 不替代事件；事件用于驱动 UI，result 用于当前操作反馈。

### 错误模型

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
```

- `RuntimeError` 必须包含稳定 `code`、用户可读 `message`、`recoverable`、可选 `cause`。
- app 根据 `code` 做错误展示、禁用态和重试入口。
- adapter 保留原始 `cause`，但 UI 默认不展示原始对象。

### 事件模型

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
```

- 事件只暴露稳定摘要，不暴露 SDK 对象。
- 停止事件只表达容器已关机，不把底层 dispose 能力拆成用户可见事件字段。
- `RuntimeEventListener` 监听 manager 级事件，例如整体状态变化、检查结果、session 创建/停止。
- `RuntimeSessionEventListener` 监听单个 session 的容器级事件，例如 session 状态、capability 变化、session 错误。
- session 事件不承载终端输出、进程输出、文件变化或预览事件；这些属于对应上层能力的事件模型。
- listener 是同步回调；如调用方需要异步处理，应在回调内部自行调度，manager/session 不等待 listener 完成。

## BrowserPod Adapter / BrowserPod 适配方案

- 包结构建议：

```text
packages/browserpod/
  src/
    runtime/
      browserpodRuntime.impl.ts
      browserpodRuntime.interfaces.ts
      browserpodRuntimeState.impl.ts
    errors/
      browserpodErrorMapper.impl.ts
    index.ts
```

- `BrowserPodRuntimeManager` 实现 `RuntimeManager`。
- `check()`：
  - 检查 `globalThis.crossOriginIsolated`。
  - 通过环境变量注入 API Key，并由 BrowserPod adapter 检查 API Key 来源是否存在。
  - 通过 `BrowserPodRuntimeConfig.storageKeyResolver` 检查能否解析 BrowserPod boot 所需 `storageKey`。
  - 返回结构化 `RuntimeCheckResult`，不调用 `BrowserPod.boot()`。
- BrowserPod adapter 应实现 `check()`，因为它存在明确的隔离环境与认证配置前置条件。
- `boot(options)`：
  - 若当前已有 `running` session 且 adapter 解析出的 BrowserPod 启动上下文未变化，直接返回当前 session。
  - 若当前不是可启动状态，返回结构化失败或抛契约错误。
  - adapter 内部解析 `apiKey` 与 `storageKey`，再调用 `BrowserPod.boot({ apiKey, storageKey })`。
  - `storageKey` 与本次 boot 出来的 BrowserPod 容器一对一绑定；不同 `storageKey` 表示不同独立磁盘/容器上下文。
  - 成功后创建 `BrowserPodRuntimeSession`，保存 pod 私有引用。
  - 失败后进入 `failed`，通过 `RuntimeError` 映射错误；不能稳定细分时使用 `boot-failed`。
- `stop()`：
  - 面向用户只有一个语义：容器关机。
  - 若 SDK 提供明确 dispose/stop，则 adapter 调用底层 API 完成关机。
  - 官方 BrowserPod reference 当前未列出 stop/dispose；在无官方 API 时，adapter 仍需完成关机语义：旧 session 失效、运行中进程不可继续使用、清理本 adapter 引用、状态进入 `stopped`。
  - 存储应按 adapter 能力尽量持久化；不把底层资源释放细节暴露给用户。
- session：
  - `BrowserPodRuntimeSession` 内部持有 pod，但不暴露。
  - 终端、进程、预览等能力由对应 adapter 接收 `RuntimeSession` 后实现；runtime session 本身不定义这些上层方法。
  - 多个终端共享同一个 pod。

## App Integration / App 接入

- app 启动页面时：
  - 创建或取得一个 runtime manager。
  - 调用 `getSnapshot()` 渲染初始状态。
  - 订阅 `onEvent()` 更新 UI。
- 容器未就绪时：
  - 终端、文件、预览功能显示依赖状态。
  - 不允许功能模块自行 boot。
- 容器启动入口：
  - 由 app shell 或容器状态面板触发 `runtime.boot(options)`。
  - 终端区域可展示启动入口，但调用的仍是上层 runtime manager。
- 错误展示：
  - `isolation-unavailable`：说明需要 COOP/COEP 或跨源隔离。
  - `auth-missing`：说明 API Key 缺失。
  - `auth-invalid`：说明认证失败。
  - `boot-failed`：说明启动失败并提供重试。
  - `stop-unsupported`：说明当前适配器无法完成容器关机。
- 自动重试不属于 runtime manager 策略；启动失败只产出错误，是否展示重试按钮由 UI 决定。

## Page Design / 页面设计

- 设计定位：
  - 容器管理页面不是 SDK 控制台，而是 web-claw 基础设施状态面板。
  - 用户需要知道“现在能不能用终端/预览/文件能力，不能用时怎么恢复”，不需要理解 BrowserPod 内部对象。
  - 采用 product UI 的 restrained 风格：清晰状态、少量语义色、标准按钮/提示/进度组件。
- 页面入口：
  - app 顶部或 Tab 右侧更多菜单提供轻量 runtime 状态入口。
  - 终端、文件、预览等模块遇到容器未就绪时，内联提示可聚焦或跳转到该状态面板。
  - 首次进入页面时可在主区域展示容器启动空态。
- 信息结构：
  - 状态摘要区：显示 runtime 类型、当前状态、最近更新时间、当前 session 摘要。
  - 主操作区：根据状态展示“启动容器”“重试启动”“容器关机”“返回主区域”等操作。
  - 依赖检查区：展示跨源隔离、API Key、storageKey resolver 等检查结果。
  - 能力摘要区：展示终端、文件持久化、服务预览、运行中 stdin、停止能力等是否可用、部分可用或未知。
  - 错误详情区：失败时展示错误摘要、建议操作和可折叠技术详情。
- 状态到 UI 的映射：
  - `idle`：展示“启动容器”主按钮，并说明启动后终端、预览等能力可用。
  - `checking`：展示检查进度，列出正在检查的项目；不允许用户重复点击启动。
  - `booting`：展示启动进度和“正在准备浏览器内计算机”；依赖容器的模块保持禁用。
  - `running`：展示轻量成功态、session 摘要和能力摘要；主操作变为“容器关机”。
  - `failed`：展示错误摘要和修复建议；UI 可提供“重试启动”按钮。
  - `unsupported`：展示不可恢复原因和部署/浏览器修复建议；不展示无效重试按钮。
  - `stopping`：展示停止中状态，禁用启动和停止操作。
  - `stopped`：展示容器已关机说明，可提供重新启动入口。
- 用户可用功能：
  - 启动容器：调用 runtime manager 的 `boot()`。
  - 手动重试：从 `failed` 态重新触发启动；runtime manager 不自动重试。
  - 容器关机：调用 `stop()`，用户文案统一为“容器关机”。
  - 查看能力摘要：将 capabilities 转成用户可理解文案，例如“服务预览可用”“运行中输入部分支持”“支持容器关机”。
  - 查看会话摘要：显示 runtime kind、sessionKey、storageKey 对应关系的非敏感说明；不显示 API Key。
  - 查看错误详情：默认展示可读摘要，技术详情折叠，便于排查但不干扰普通用户。
- 组件与视觉约束：
  - 参考 `docs/design/BitsUI.md` 中 Button、Progress、Tooltip、Popover、Tabs/Toggle、Label 等组件语义。
  - 状态色仅用于成功、警告、错误、运行中和焦点，不用大面积装饰。
  - 错误和 unsupported 使用 inline panel，不优先使用 modal。
  - API Key 只显示“已配置/未配置”，不得显示明文或部分明文。
- 与上层能力的关系：
  - 终端、文件、预览模块只展示依赖状态，不各自实现完整容器管理 UI。
  - 所有“容器未就绪”提示都应指向同一个 runtime 状态入口。
  - 容器管理页面不提供终端命令输入、文件操作或预览控制，这些仍属于上层能力页面。

## Impacted Areas / 影响范围

- 文件/模块：
  - 新增或修订 `packages/os-core/src/runtime/*.interfaces.ts`。
  - 新增或修订 `packages/os-core/src/runtime/*.events.ts`。
  - 新增或修订 `packages/os-core/src/runtime/*.errors.ts`。
  - 新增 `packages/browserpod/src/runtime/*.impl.ts`。
  - 终端方案后续改为依赖 `RuntimeSession`。
- 接口/类型：
  - 旧 `IRuntime` 应升级为 `RuntimeManager` 或同等语义。
  - `RuntimeStatus` 增加 `checking`、`unsupported`。
  - `RuntimeCapabilities` 从粗粒度 boolean 调整为行为能力。
  - `RuntimeErrorCode` 增加更细的环境、认证、storage、stop、session 错误。
- 数据/状态：
  - runtime manager 持有当前 session。
  - BrowserPod adapter 内部将 session 与解析后的 BrowserPod 启动上下文绑定；`os-core` 只认识通用 `sessionKey`。
  - 多终端共享 session，不重复 boot。
- UI/交互：
  - app shell 需要有容器状态展示或状态入口。
  - 需要实现容器状态面板，覆盖启动、检查、运行、失败、不支持、停止中、已停止。
  - 终端区域只展示依赖状态，不拥有完整容器状态机。
- 测试：
  - `os-core` runtime 状态机单测。
  - BrowserPod adapter check/boot/failed/stop 分支测试。
  - 手动验证 COOP/COEP、缺 API Key、boot 成功、重复 boot 复用 session。

## Execution Steps / 执行步骤

1. 标记旧 specs 废弃：
   - `docs/specs/2026-05-24_18-00_web-claw-core-contract.md` 不再维护旧 `IRuntime` / 终端混合契约，只保留 deprecated 索引并指向本迭代。
   - `docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md` 不再维护旧 BrowserPod 运行与终端 MVP 映射，只保留 deprecated 索引并指向本迭代。
2. 设计 `packages/os-core` runtime 契约：
   - 先写 `runtime.interfaces.ts`、`runtime.events.ts`、`runtime.errors.ts`。
   - 只放类型、接口与必要的状态工具，不引用 BrowserPod。
3. 实现 `packages/browserpod` runtime adapter：
   - 实现 `BrowserPodRuntimeManager`。
   - 实现 check/boot/stop/getSnapshot/onEvent。
   - 内部持有 pod，外部只返回 `RuntimeSession`。
4. 接入终端方案：
   - 终端 adapter 接收 `RuntimeSession` 作为前置依赖，例如 `terminalService.createTerminal(runtimeSession, options)`。
   - 终端 UI 根据 runtime 状态决定是否允许创建终端和提交命令。
5. 补齐测试与 demo：
   - 单测覆盖状态流转、重复 boot、失败恢复、stop product-only。
   - BrowserPod demo 增加 runtime management case 或在现有 case runner 中显示 runtime 状态。

## Risk And Mitigation / 风险与缓解

- 风险：BrowserPod stop/dispose 能力不可用。
  - 缓解方式：adapter 实现统一的“容器关机”语义，清理本层引用并让旧 session 失效；UI 不暴露底层 dispose 差异。
- 风险：API Key 来源不清导致实现泄漏到 UI。
  - 缓解方式：BrowserPod adapter 从环境变量读取或注入 API Key；通用 `RuntimeBootOptions` 不包含 `apiKey`。
- 风险：`storageKey` 产品语义过早固定。
  - 缓解方式：`storageKey` 只存在于 BrowserPod adapter 配置与实现映射中，并与 boot 出来的容器一对一绑定；`os-core` 通用契约只保留可选 `sessionKey`。
- 风险：终端绕过 runtime manager。
  - 缓解方式：终端 adapter 依赖 `RuntimeSession`，代码实现时禁止终端 UI 直接 import BrowserPod。
- 风险：capability 粒度不足导致 UI 误承诺。
  - 缓解方式：使用多值能力声明，并让未验证能力保持 `unknown` 或 `unsupported`。
- 风险：BrowserPod `pod.run` 参数与 demo 证据偏离，导致基础命令执行失败。
  - 缓解方式：adapter 先 await `createDefaultTerminal`，再将 resolve 后的 terminal handle 传入 `pod.run("sh", ["-c", script], { echo: true, terminal, cwd })`；默认 cwd 为 `/home/user`，并用单测锁定该映射。

## Validation Plan / 验证计划

- 静态检查：
  - TypeScript 类型检查。
  - package lint 或 repo 现有 lint 命令。
- 单元/集成测试：
  - `idle -> checking -> supported`。
  - `supported -> checking -> supported -> booting -> running`。
  - `checking -> unsupported`。
  - `checking -> failed`。
  - `booting -> failed`。
  - `running -> stopping -> stopped`。
  - 重复 `boot()` 复用当前 session。
  - 缺 API Key、缺跨源隔离、storageKey resolver 无效。
- 手动验证：
  - 正常启动 BrowserPod。
  - 缺 API Key 显示可理解错误。
  - 缺 COOP/COEP 显示隔离环境错误。
  - 固定 `storageKey` 与 boot 容器一对一；不同 `storageKey` 对应独立磁盘/容器上下文。
  - 容器未就绪时终端不可提交命令。
- 验收证据：
  - 旧 specs 已标记 deprecated，并可追溯到本方案。
  - `os-core` 不引用 BrowserPod。
  - `apps/web-claw` 不直接 import BrowserPod SDK。
  - BrowserPod adapter 通过最小 check/boot/stop 验证。

## Execute Checkpoint / 执行检查点

- 当前理解：
  - 容器管理 API 必须先由 `os-core` 约定，再由 BrowserPod adapter 实现；终端只消费已启动 session。
- 核心目标：
  - 固化 runtime manager/session/capability/error/event 契约，作为终端统一交互的前置能力。
- 下一步动作：
  - 等用户确认本技术方案后，先更新旧 specs，再进入代码实现。
- 风险：
  - BrowserPod stop/dispose 与错误类型仍需实现阶段精确核对；不得过度承诺。
- 验证方式：
  - 文档对齐、类型检查、状态机单测、BrowserPod check/boot 手动验证。
- Execution Approval: `Approved`
