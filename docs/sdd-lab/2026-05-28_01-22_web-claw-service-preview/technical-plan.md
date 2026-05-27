# Technical Plan / 技术方案: Web Claw Service Preview

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/requirements.md`
- 需求确认状态：`Approved for technical planning`
- 本方案覆盖范围：
  - 容器内网络服务预览的统一契约。
  - BrowserPod Portal 事件到服务预览事件的 adapter 方案。
  - `apps/web-claw` Preview Tab 的状态、列表、iframe 预览、刷新、外部打开和手动 URL 兜底。
  - 与 runtime、terminal、app shell、Bits UI 设计约束的关系。
- 本方案不覆盖：
  - 文件内容预览。
  - 后端代理服务、生产域名、鉴权服务预览、公网分享权限管理。
  - 完整终端输出解析；第一阶段只把 BrowserPod Portal 作为自动发现主路径。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/requirements.md`
  - `docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/technical-plan.md`
  - `docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - `docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/technical-plan.md`
  - `docs/design/BitsUI.md`
  - `docs/design/Iconography.md`
  - `packages/os-core/src/runtime/runtime.interfaces.ts`
  - `packages/os-core/src/terminal/terminal.interfaces.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.impl.ts`
  - `packages/browserpod/src/terminal/browserpodTerminal.impl.ts`
  - `apps/web-claw/src/App.svelte`
  - `apps/web-claw/src/lib/core/runtime/runtimeManagerProvider.ts`
  - `apps/web-claw/src/lib/core/terminal/terminalServiceProvider.ts`
  - `apps/web-claw/src/lib/features/terminal/components/TerminalPanel.svelte`
  - `apps/web-claw/src/lib/components/icon/icons.ts`
  - `demos/browserpod-demo/src/main.js`
- 当前实现事实：
  - `RuntimeCapabilities` 已包含 `servicePreview: boolean`；BrowserPod adapter 当前将其声明为 `true`。
  - `RuntimeSession` 只暴露 runtime 状态、capabilities 和 opaque `ref`，不暴露 `createPreview()` 或 BrowserPod SDK 对象。
  - `BrowserPodRuntimeManager` 内部通过 `resolvePod(runtimeSession)` 把同一个 runtime session 解析回私有 `pod`，目前 terminal service 已按该模式接入。
  - `BrowserPodLike` 类型已保留 `onPortal?: unknown`，但没有稳定签名，也没有 preview adapter。
  - `demos/browserpod-demo/src/main.js` 已实证使用 `pod.onPortal(({ url, port }) => { iframe.src = url })` 完成服务预览。
  - `App.svelte` 已有 `Terminal` / `Files` / `Preview` Tabs；Preview 当前只是 placeholder。
  - `TerminalEvent` 包含 `terminal-output` 事件类型，但当前 BrowserPod terminal adapter 使用 SDK default terminal DOM 承载输出，没有把真实输出 chunk 写入 `terminal-output` 事件。
  - `apps/web-claw` 目前在 `App.svelte` 中直接持有部分 runtime 启动编排状态，后续预览接入应尽量收敛到 core/service + store，不继续扩大组件内编排。
  - 图标注册表已有 `browser`、`refresh`、`add`、`close`、`info`、`errorCircle` 等图标；`Iconography.md` 明确 Preview panel 的 refresh/open-external actions 尚待实现。
- BrowserPod 官方能力核对：
  - 官方 `onPortal` reference：`BrowserPod.onPortal(cb: ({ url: string, port: int }) => void): void`，当 Portal 被创建时调用 callback，callback 参数包含 public `url` 和内部 `port`。
  - 官方 Portals 文档：Pod 内进程监听端口时，BrowserPod 自动创建 public URL；多个端口可创建多个 Portal。
  - `onPortal` 不返回 unsubscribe；adapter 需要本地做去重和 stale session 防护。
- 设计事实：
  - `docs/design/BitsUI.md` 中与本方案相关的组件包括 Tabs、Button、Popover、Tooltip、Dialog/Drawer、Label、Progress、Link preview。
  - Figma MCP 核对 `Bits UI kit (Community)` 的 Tabs 节点可用；Preview UI 应沿用当前 app 的紧凑 Tabs chrome，不新增独立 Header。

## Proposed Solution / 拟定方案

- 方案摘要：
  - 在 `packages/os-core` 新增服务预览契约，定义 `ServicePreviewService`、`ServicePreviewEntry`、事件、状态、错误与 action result。
  - 在 `packages/browserpod` 新增 BrowserPod service preview adapter，主路径监听 `pod.onPortal(({ url, port }) => ...)`，将 Portal 转为统一预览事件。
  - 在 `apps/web-claw` 新增 preview core/state 和 `PreviewPanel.svelte`，由 Preview Tab 展示服务列表、iframe、刷新、外部打开、清除和手动 URL 添加。
  - 第一阶段自动发现来源只采用 BrowserPod Portal 事件；手动 URL 作为兜底；终端输出解析保留为后续扩展，不在本轮实现。
- 为什么选择该方案：
  - BrowserPod 官方 Portal 已经提供最终可访问 URL，不需要从终端输出猜测 localhost 地址或自行做端口映射。
  - `onPortal` 事件天然包含 `port`，能支持多个服务地址，并避免只保留最后一个地址。
  - `os-core` 先定义契约，保持 app 不直接认识 BrowserPod SDK，与 runtime、terminal、files 的分层一致。
  - iframe + 外部打开同时提供：iframe 保持工作台内预览，外部打开处理嵌入失败、跨源限制、调试和分享场景。
- 不采用的方案：
  - 不让 Preview Tab 直接调用 `runtimeManager.resolvePod()` 或直接 import BrowserPod SDK。
  - 不把 `onPortal` 方法放到 `RuntimeSession` 上；runtime session 仍只表达容器状态和 opaque ref。
  - 不在第一阶段解析 BrowserPod default terminal DOM 输出；该输出不属于稳定事件流，解析 DOM 容易脆弱。
  - 不把手动输入的 `localhost` / `127.0.0.1` / `0.0.0.0` 自动当成可访问地址；除非后续有明确 resolver，可先提示用户使用 Portal URL。
  - 不做跨会话持久历史；第一阶段以当前 runtime session 的内存状态为准。

## API Contract / API 契约

### 包边界

- `packages/os-core/src/preview/*`：
  - 定义预览能力的通用契约、事件、错误和状态工具。
  - 不引用 BrowserPod、DOM iframe 或 Svelte。
- `packages/browserpod/src/preview/*`：
  - 实现 `os-core` 的 preview service。
  - 封装 `pod.onPortal`、Portal URL 去重、session stale 防护和 BrowserPod 错误映射。
- `apps/web-claw/src/lib/core/preview/*`：
  - 创建 app 侧 preview state/service provider，连接 runtime session 与 preview service。
  - 可复用逻辑用 class 封装，组件只订阅状态和派发用户意图。
- `apps/web-claw/src/lib/features/preview/*`：
  - Svelte 展示组件：列表、输入、iframe、toolbar、状态块。
  - 不直接调用 BrowserPod SDK，不解析 runtime session ref。

### 核心类型

```typescript
export type ServicePreviewSource = "portal" | "manual" | "terminal-output";

export type ServicePreviewEntryStatus =
  | "discovered"
  | "selected"
  | "loading"
  | "ready"
  | "failed"
  | "cleared";

export type ServicePreviewEntry = {
  readonly id: string;
  readonly url: string;
  readonly port?: number;
  readonly label: string;
  readonly source: ServicePreviewSource;
  readonly status: ServicePreviewEntryStatus;
  readonly discoveredAt: number;
  readonly lastOpenedAt?: number;
  readonly lastError?: ServicePreviewError;
};
```

- `source: "portal"` 是第一阶段自动发现主路径。
- `source: "manual"` 表示用户在 Preview Tab 输入或粘贴。
- `source: "terminal-output"` 预留给后续终端输出解析；第一阶段不产出该来源。
- `label` 默认可由 port 或 host 推导，例如 `Port 5173`、`Manual URL`，用户自定义命名留后续增强。

### 服务契约

```typescript
export interface ServicePreviewService {
  attach(runtimeSession: RuntimeSession): Promise<ServicePreviewSession>;
}

export interface ServicePreviewSession {
  readonly runtimeSessionId: string;

  addManualUrl(url: string): ServicePreviewActionResult;
  select(entryId: string): ServicePreviewActionResult;
  markLoading(entryId: string): ServicePreviewActionResult;
  markReady(entryId: string): ServicePreviewActionResult;
  markFailed(entryId: string, error: ServicePreviewError): ServicePreviewActionResult;
  clear(entryId: string): ServicePreviewActionResult;
  clearAll(): ServicePreviewActionResult;
  getSnapshot(): ServicePreviewSnapshot;
  onEvent(listener: ServicePreviewEventListener): Unsubscribe;
  close(): ServicePreviewActionResult;
}
```

- `attach(runtimeSession)` 只绑定已运行的 runtime session；容器未运行时由 app 层展示阻塞态，不创建 preview session。
- `addManualUrl` 做 URL 格式校验和去重，不做网络探活。
- `select` 只更新预览状态；iframe 加载由 UI 层根据当前 entry URL 完成。
- `markLoading` / `markReady` / `markFailed` 由 UI iframe 事件驱动，避免 service 依赖 DOM。
- `close()` 清理本地 listener 与状态订阅；BrowserPod `onPortal` 无 unsubscribe 时，adapter 通过 closed flag 忽略后续 stale callback。

### Snapshot 与事件

```typescript
export type ServicePreviewSnapshot = {
  readonly runtimeSessionId: string;
  readonly entries: readonly ServicePreviewEntry[];
  readonly selectedEntryId: string | null;
  readonly updatedAt: number;
};

export type ServicePreviewEvent =
  | { readonly type: "service-preview-entry-discovered"; readonly entry: ServicePreviewEntry }
  | { readonly type: "service-preview-entry-updated"; readonly entry: ServicePreviewEntry }
  | { readonly type: "service-preview-entry-cleared"; readonly entryId: string }
  | { readonly type: "service-preview-selection"; readonly entryId: string | null }
  | { readonly type: "service-preview-error"; readonly error: ServicePreviewError };
```

- app store 以 snapshot 为首帧真相源，以 event 做增量更新。
- entries 排序第一阶段采用：
  - 当前选中项优先。
  - 其次按 `lastOpenedAt` 倒序。
  - 再按 `discoveredAt` 倒序。
- 同一个 `url` 或同一个 `port + url` 重复触发时更新已有 entry 的 `discoveredAt` / 状态，不新增重复项。

### 错误模型

```typescript
export type ServicePreviewErrorCode =
  | "runtime-not-running"
  | "capability-unsupported"
  | "invalid-url"
  | "localhost-url-unresolved"
  | "portal-api-unavailable"
  | "iframe-load-failed"
  | "iframe-blocked"
  | "unknown";
```

- `invalid-url`：用户输入不是合法 `http:` / `https:` URL。
- `localhost-url-unresolved`：用户手动输入 localhost / 127.0.0.1 / 0.0.0.0，但当前没有 resolver 可转换为 Portal URL。
- `portal-api-unavailable`：runtime capability 声明支持服务预览，但 BrowserPod pod 上没有可调用 `onPortal`。
- `iframe-load-failed`：iframe 触发 load error 或超时。
- `iframe-blocked`：页面无法被 iframe 嵌入，UI 提供外部打开。

## BrowserPod Adapter / BrowserPod 适配方案

### 类型收窄

- 将 `BrowserPodLike.onPortal?: unknown` 收窄为明确类型：

```typescript
export type BrowserPodPortalEvent = {
  readonly url: string;
  readonly port: number;
};

export type BrowserPodOnPortal = (cb: (event: BrowserPodPortalEvent) => void) => void;
```

- `BrowserPodServicePreviewService` 依赖 `BrowserPodRuntimeManager.resolvePod(runtimeSession)`，与 terminal service 当前模式一致。
- 若 `typeof pod.onPortal !== "function"`，返回结构化 `portal-api-unavailable`，并保持 Preview Tab 可手动输入 URL。

### Portal 事件处理

```text
BrowserPodServicePreviewService.attach(runtimeSession)
  -> resolvePod(runtimeSession)
  -> assert onPortal function
  -> create BrowserPodServicePreviewSession
  -> pod.onPortal(({ url, port }) => session.handlePortal(url, port))
```

- `handlePortal(url, port)`：
  - 校验 `url` 是合法 `http:` / `https:`。
  - 以 `url` 为主键去重；同一 URL 重复出现时更新已有 entry。
  - 生成 entry：`source: "portal"`、`label: Port ${port}`、`status: "discovered"`。
  - 若当前没有 selected entry，自动选中第一个 Portal；若已有选中项，不强行切换。
  - 发出 `service-preview-entry-discovered`；app 可显示轻量 toast 或 Tab badge。
- 因官方 `onPortal` 不返回 unsubscribe：
  - session 持有 `closed` flag。
  - callback 进入时先检查当前 session id 和 closed flag。
  - runtime stop 或 preview session close 后忽略旧 callback。

## App Integration / App 接入

### 状态组织

建议新增：

```text
apps/web-claw/src/lib/core/preview/
  previewServiceProvider.ts
  previewWorkspaceState.ts
  previewUrl.impl.ts

apps/web-claw/src/lib/features/preview/components/
  PreviewPanel.svelte
```

- `PreviewServiceProvider`：
  - 项目级单例，创建 BrowserPod preview service。
  - 只在 provider 内依赖 `BrowserPodRuntimeManager`；展示组件只依赖通用 preview service / app state。
- `PreviewWorkspaceState`：
  - class，持有 `ServicePreviewSnapshot`、selected entry、manual input 状态、iframe load 状态。
  - 订阅 runtime manager：runtime 从 `running` 变为非 running 时关闭 preview session 并展示阻塞态。
  - runtime 为 `running` 且有 currentSession 时 attach preview service。
- `PreviewUrl` / `PreviewUrlValidator`：
  - 校验手动 URL。
  - 对 URL 做日志脱敏：保留 origin/path，query/hash 默认不写入 debug 日志。
  - 识别 localhost 类 URL，第一阶段提示不可转换。

### UI 结构

Preview Tab 结构：

```text
PreviewPanel
  ├─ Toolbar
  │   ├─ service selector / list
  │   ├─ manual URL input
  │   ├─ Add / Refresh / Open external / Clear
  ├─ Status area
  │   ├─ runtime blocking state
  │   ├─ empty state
  │   ├─ loading state
  │   └─ error state
  └─ iframe viewport
```

- Toolbar：
  - 选择器展示多个服务地址，优先显示 label + port + hostname。
  - 手动 URL 输入支持粘贴 Portal URL。
  - `Refresh` 通过更新 iframe key 或重新设置 `src` 实现。
  - `Open external` 调用 `window.open(url, "_blank", "noopener,noreferrer")`。
  - `Clear` 清除当前 entry；`Clear all` 可放入更多菜单。
- iframe viewport：
  - 选中 entry 后设置 iframe `src`。
  - `onload` 后标记 ready。
  - load 超时或 error 时标记 failed；仍保留外部打开。
  - 加 `title`，例如 `Preview for Port 5173`。
- 空态：
  - 文案：“启动服务后，BrowserPod Portal 会出现在这里；也可以粘贴 Portal URL。”
  - 不显示空白 iframe。
- 阻塞态：
  - runtime 非 `running` 时展示容器状态说明和“打开容器面板”入口。
  - 不触发独立 boot。

### 用户提示

- 发现 Portal：
  - 若用户不在 Preview Tab，展示轻量 toast 或在 Preview Tab 上显示 indicator。
  - 不自动切换 Tab。
- 多地址：
  - 第一个 Portal 可自动选中。
  - 后续 Portal 只加入列表，不抢占当前 iframe。
- 手动 URL：
  - 成功添加后选中该 entry。
  - localhost URL 给出说明：“当前阶段无法把本地地址转换为 BrowserPod Portal URL，请使用 Portal URL。”

## Terminal Discovery Boundary / 终端发现边界

- 第一阶段不做终端输出解析，原因：
  - 当前 BrowserPod terminal adapter 使用 default terminal DOM，真实输出未进入 `TerminalEvent.terminal-output`。
  - 从 DOM 反向解析地址会把 SDK 渲染细节泄漏到 app，且难以测试。
  - BrowserPod Portal 事件已经是更可靠的服务发现信号。
- 后续若要扩展 `terminal-output` 来源，必须先：
  - 让 terminal adapter 稳定产出输出事件，或新增 command runner 输出订阅。
  - 在 `os-core` preview 中提供 `ServicePreviewUrlDetector`，只处理纯文本 chunk。
  - 将识别规则限制在常见 `http://localhost:<port>`、`http://127.0.0.1:<port>`、`http://0.0.0.0:<port>`、`http://[::1]:<port>` 和 BrowserPod Portal URL。
  - 对检测到的 localhost 地址只作为候选，不替代 Portal URL；最终可访问 URL仍以 Portal 或 resolver 为准。

## Page Design / 页面设计

- 设计定位：
  - Preview 是工作台内的“运行服务查看器”，不是浏览器替代品。
  - 信息优先级：当前可访问服务 > 加载状态 > 操作按钮 > 技术细节。
  - 视觉保持 `apps/web-claw` 现有 card / border / muted 风格。
- Bits UI 对照：
  - 顶层仍使用现有 Tabs。
  - 服务列表可用 Select 或 Popover；如果只有一个服务，显示 compact badge + URL。
  - 手动 URL 输入使用 Input + Button。
  - 刷新、外部打开、清除使用 small / ghost / outline button，并提供 `aria-label`。
  - 错误说明使用 inline Alert / panel，不优先弹 Dialog。
- 图标：
  - 复用 `browser` 表示 Preview。
  - 复用 `refresh` 表示刷新。
  - 需要新增 `externalLink` 或等价图标用于外部打开；若图标包无合适项，先在 icon registry 中注册明确命名，不在组件内直接 import Hugeicons。
- 可访问性：
  - iframe 必须有 title。
  - 加载中、失败、空态不能只靠颜色表达。
  - service selector、manual URL input、refresh、open external、clear 都必须键盘可达。
  - 外部打开的 icon-only 按钮必须有 `aria-label`。

## Impacted Areas / 影响范围

- 文档：
  - `docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/technical-plan.md`
  - `docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
- 包契约：
  - 新增 `packages/os-core/src/preview/preview.interfaces.ts`
  - 新增 `packages/os-core/src/preview/preview.errors.ts`
  - 新增 `packages/os-core/src/preview/index.ts`
  - 更新 `packages/os-core/src/index.ts`
- BrowserPod adapter：
  - 新增 `packages/browserpod/src/preview/browserpodServicePreview.impl.ts`
  - 新增 `packages/browserpod/src/preview/index.ts`
  - 更新 `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts` 的 `onPortal` 类型。
  - 更新 `packages/browserpod/src/index.ts`
- web-claw app：
  - 新增 `apps/web-claw/src/lib/core/preview/**`
  - 新增 `apps/web-claw/src/lib/features/preview/components/PreviewPanel.svelte`
  - 更新 `apps/web-claw/src/App.svelte` 的 Preview Tab placeholder。
  - 可能更新 `apps/web-claw/src/lib/components/icon/icons.ts` 与 `docs/design/Iconography.md`。
- 测试：
  - `os-core` preview 状态/事件单测。
  - `browserpod` preview adapter 单测。
  - `web-claw` Svelte check/build。
  - 浏览器手动验证 BrowserPod Portal happy path。

## Execution Steps / 执行步骤

1. 新增 `os-core` preview 契约：
   - 定义 `ServicePreviewService`、`ServicePreviewSession`、entry、snapshot、event、error、action result。
   - 用 class 封装 snapshot 状态管理，例如 `ServicePreviewState`.
   - 不引用 DOM、Svelte 或 BrowserPod。
2. 实现 BrowserPod preview adapter：
   - 收窄 `BrowserPodLike.onPortal` 类型。
   - `BrowserPodServicePreviewService.attach(runtimeSession)` 解析 pod 并注册 `onPortal`。
   - 去重 Portal URL，维护多个 entry。
   - 无 `onPortal` 时返回结构化错误，允许 app 使用手动 URL。
3. 接入 app preview core：
   - 新增 provider 创建 preview service。
   - 新增 `PreviewWorkspaceState` 订阅 runtime 状态，running 时 attach，非 running 时 close。
   - 状态来源为 preview session snapshot/event，不在 Svelte 组件中散落业务状态。
4. 实现 `PreviewPanel.svelte`：
   - 容器未运行：展示阻塞态和打开 runtime drawer 入口。
   - 无服务地址：展示空态和手动 URL 输入。
   - 有服务地址：展示列表、iframe、刷新、外部打开、清除。
   - iframe load/timeout/error 回写 preview state。
5. 接入 `App.svelte`：
   - 将 Preview placeholder 替换为 `PreviewPanel`.
   - 传入 `onOpenRuntime` 之类的展示意图回调。
   - 不把 BrowserPod adapter 逻辑写入 `App.svelte`。
6. 更新图标与设计记录：
   - 若新增外部打开图标，更新 icon registry。
   - 回写 `Iconography.md` 的 Preview panel checklist。
7. 验证与回写：
   - 跑类型检查、单测、Svelte check/build。
   - 用真实 BrowserPod runtime 启动一个简单 HTTP 服务，确认 Portal 自动出现在 Preview Tab。
   - 若发现 BrowserPod `onPortal` 行为与官方文档或 demo 不一致，先回写本方案再修代码。

## Risk And Mitigation / 风险与缓解

- 风险：`onPortal` 不返回 unsubscribe，runtime stop 后旧 callback 仍可能触发。
  - 缓解方式：preview session 使用 closed flag 和 runtimeSessionId 防护；旧 callback 只记录 debug，不更新 UI。
- 风险：iframe 无法嵌入 Portal 页面。
  - 缓解方式：保留外部打开；失败态说明可能是页面嵌入策略或跨源限制。
- 风险：多个服务地址频繁变化导致用户当前预览被抢占。
  - 缓解方式：只有第一个 Portal 自动选中；后续 Portal 只加入列表并提示，不强行切换。
- 风险：用户输入 localhost 地址后无法访问。
  - 缓解方式：第一阶段明确提示需要 Portal URL；不假装转换。
- 风险：服务地址可能包含 token。
  - 缓解方式：UI 可以显示用户需要打开的完整 URL；日志、测试快照和 debug payload 默认脱敏 query/hash。
- 风险：servicePreview capability 与实际 `onPortal` API 不一致。
  - 缓解方式：attach 时再次检查 `pod.onPortal`；失败时展示手动 URL 兜底并记录 adapter 错误。
- 风险：继续把 runtime 编排写进 `App.svelte`，使 preview 接入加重组件复杂度。
  - 缓解方式：本迭代 preview 状态必须进入 core/state class；后续可单独重构 runtime orchestrator，但不在本迭代扩大范围。

## Validation Plan / 验证计划

- 静态检查：
  - `pnpm --filter os-core check-types`
  - `pnpm --filter browserpod check-types`
  - `pnpm --filter web-claw check`
  - `pnpm --filter web-claw build`
- 单元测试：
  - `os-core` preview state：新增 entry、重复 URL 去重、选择、清除、失败状态。
  - URL validator：合法 Portal URL、非法 URL、localhost URL、query/hash 脱敏。
  - `browserpod` adapter：`onPortal` 注册、多个 portal、重复 portal、无 onPortal 降级、close 后忽略 stale callback。
- 手动验证：
  - 正常 boot BrowserPod。
  - 在 Terminal 中启动一个 HTTP 服务，例如简单 Node/Express/Vite 服务。
  - BrowserPod 创建 Portal 后，Preview Tab 出现地址列表。
  - 不在 Preview Tab 时有轻量提示，但不自动切换。
  - 切到 Preview 后 iframe 加载服务页面。
  - Refresh 重新加载 iframe。
  - Open external 新标签页打开 Portal URL。
  - 启动第二个端口服务后列表出现第二个地址，当前预览不被抢占。
  - 清除当前地址后 UI 更新。
  - 容器关机后 Preview 展示阻塞态，不自行 boot。
- 验收证据：
  - `os-core` 不引用 BrowserPod。
  - `apps/web-claw` Preview 组件不直接 import BrowserPod SDK。
  - BrowserPod Portal happy path 截图或日志。
  - 验证命令输出与 lifecycle 回写。

## Execute Checkpoint / 执行检查点

- 当前理解：
  - 服务预览指容器内网络服务被 BrowserPod Portal 暴露后的 URL 预览，不是文件预览。
- 核心目标：
  - 固化 preview 契约，接入 BrowserPod `onPortal`，让 Preview Tab 能展示、打开、刷新和管理多个服务 URL。
- 下一步动作：
  - 等用户 review 本技术方案，并明确是否批准进入代码执行阶段。
- 明确非目标：
  - 本方案阶段不写代码；执行阶段也不做终端输出解析、跨会话持久历史、服务鉴权或生产域名策略。
- 风险：
  - `onPortal` 无 unsubscribe、iframe 可能被目标页面阻止、localhost 手动地址不可转换。
- 验证方式：
  - 文档对齐、类型检查、单测、Svelte check/build、真实 BrowserPod Portal 手动验证。
- Execution Approval: `Pending`
