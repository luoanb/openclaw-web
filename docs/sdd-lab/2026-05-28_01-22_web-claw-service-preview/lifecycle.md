# Lifecycle / 生命周期: Web Claw Service Preview

```yaml
status: executing
result: pending
created_at: 2026-05-28 01:22
updated_at: 2026-05-28 21:03
owner: user
```

## Current Summary / 当前摘要

- 当前状态：`executing`，三层方案重构代码实现与自动验证已完成，等待真实 BrowserPod Portal 手动验证。
- 当前核心目标：将 `os-core` preview 收窄为第一层 Discovery / target registry；Selection 与 Render 放在 `apps/web-claw` 应用内。
- 当前下一步：在真实 BrowserPod runtime 中启动 HTTP 服务，确认 Portal target 自动进入 Preview Tab 并可 iframe / 外部打开。
- 当前卡点：自动验证已通过；真实 Portal happy path、iframe 嵌入行为和多 Portal 场景仍需手动验证。
- 下一步唯一动作：用户或 agent 在 dev 页面启动服务并验证 Preview Tab。
- 下一轮核心目标：根据真实 Portal 验证结果进入 review；若发现 BrowserPod `onPortal` 或 iframe 行为偏差，先回写技术方案再修代码。

## Approval / 批准状态

- Requirements confirmed: `Approved for technical planning`
- Technical plan confirmed: `Approved after architecture revision`
- Execution approval: `Approved for refactor`
- Approved by: user
- Approved at: 2026-05-28 01:35

## Execution Log / 执行记录

- 2026-05-28 01:22:
  - 动作：根据用户确认新建独立迭代 `web-claw-service-preview`，并写入需求阶段文档。
  - 涉及文件：`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/requirements.md`、`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
  - 状态变化：无，初始状态为 `draft`（原因：需求边界尚未由用户确认；依据：用户纠正“预览”指容器启动服务抛出的网络服务地址，并要求继续；下一步：等待用户 review 需求文档）
  - 偏差：最初曾误判为文件预览；本次已在需求文档中纠正为服务预览，并显式排除文件预览语义。
- 2026-05-28 01:28:
  - 动作：按用户“开始落地 技术方案”指令，读取需求文档、相关 SDD 技术方案、当前 runtime / terminal / web-claw app 代码、BrowserPod demo、BrowserPod 官方 Portal 文档和 Bits UI 设计约束，并生成服务预览技术方案。
  - 涉及文件：`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/technical-plan.md`、`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
  - 状态变化：`draft -> planned`（原因：用户要求开始落地技术方案，视为需求边界足以进入技术方案阶段；依据：本轮用户指令；下一步：等待用户 review 技术方案并决定是否批准执行）
  - 偏差：无新增偏差；技术方案确认第一阶段不做终端输出解析，改以 BrowserPod 官方 `onPortal` 作为自动发现主路径。
- 2026-05-28 01:35:
  - 动作：按用户“开始执行”指令进入服务预览代码执行阶段。
  - 涉及文件：`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
  - 状态变化：`planned -> executing`（原因：用户明确批准执行；依据：本轮用户指令；下一步：新增 `os-core` preview 契约）
  - 偏差：无。
- 2026-05-28 01:41:
  - 动作：完成服务预览首轮代码实现：新增 `os-core` preview 契约与状态类；新增 BrowserPod `onPortal` preview adapter；接入 web-claw Preview Tab，支持 Portal 列表、手动 URL、iframe、刷新、外部打开、清除和容器阻塞态。
  - 涉及文件：`packages/os-core/src/preview/**`、`packages/os-core/src/index.ts`、`packages/browserpod/src/preview/**`、`packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`、`packages/browserpod/src/index.ts`、`apps/web-claw/src/lib/core/preview/**`、`apps/web-claw/src/lib/features/preview/components/PreviewPanel.svelte`、`apps/web-claw/src/App.svelte`、`docs/design/Iconography.md`、`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：自动验证通过但真实 BrowserPod Portal happy path 尚未手动验证；依据：本轮测试、类型检查、Svelte check 与 build 结果；下一步：真实页面验证 Portal 预览）
  - 偏差：技术方案提到可能新增 `externalLink` 图标；实现阶段复用现有 `browser` 图标承载外部打开动作，未新增图标依赖。
- 2026-05-28 20:53:
  - 动作：根据用户对分层架构的确认，回写服务预览技术方案：`os-core` 只保留 Discovery / target registry；Selection 与 Render 状态放在 `apps/web-claw` 应用内。
  - 涉及文件：`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/technical-plan.md`、`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/requirements.md`、`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
  - 状态变化：`executing -> planned`（原因：执行后 review 发现公共契约分层偏粗，新的技术方案会改变已实现代码结构；依据：用户确认“第一层放置在 core，二三层放置在应用内”；下一步：等待用户批准按新方案重构执行）
  - 偏差：首轮实现把 selection 与 iframe render status 放进了 `os-core` 的 `ServicePreviewEntry` / session 契约；新方案要求这些状态下沉到应用内。
- 2026-05-28 20:56:
  - 动作：按用户“开始执行”指令进入三层方案重构执行阶段。
  - 涉及文件：`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
  - 状态变化：`planned -> executing`（原因：用户明确批准按新方案重构；依据：本轮用户指令；下一步：重构 `os-core` preview 契约）
  - 偏差：无。
- 2026-05-28 21:03:
  - 动作：完成三层方案重构：`os-core` preview 改为 `PreviewTargetRegistry` / Discovery 契约；BrowserPod adapter 改为 `BrowserPodPreviewDiscoveryService`；web-claw 应用内维护 selection 与 render state。
  - 涉及文件：`packages/os-core/src/preview/**`、`packages/browserpod/src/preview/**`、`apps/web-claw/src/lib/core/preview/**`、`apps/web-claw/src/lib/features/preview/components/PreviewPanel.svelte`、`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/technical-plan.md`、`docs/sdd-lab/2026-05-28_01-22_web-claw-service-preview/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：自动验证通过但真实 BrowserPod Portal happy path 尚未手动验证；依据：本轮类型检查、单测、Svelte check 和 build 结果；下一步：真实页面验证 Portal 预览）
  - 偏差：无新增偏差；本轮修正了 20:53 记录的公共契约分层偏差。

## Validation / 验证

- Self-check: 已按 `requirements.md` 与 `technical-plan.md` 完成首轮实现；服务预览没有自行 boot runtime，app 组件没有直接 import BrowserPod SDK。
- Docs / Planning: 已创建独立 SDD Lab 迭代目录，补齐 `technical-plan.md`，并回写 `requirements.md`、`lifecycle.md` 与 `docs/design/Iconography.md`。
- External docs: 已核对 BrowserPod 官方 `onPortal` reference 与 Portals 文档，确认 Portal 自动创建、`onPortal` callback 包含 `url` 与 `port`。
- Design / MCP: 已读取 `docs/design/BitsUI.md` 与 `Iconography.md`，并通过 Figma MCP 核对 Bits UI Tabs 节点可访问。
- Static checks:
  - `pnpm --filter os-core check-types`：通过。
  - `pnpm --filter browserpod check-types`：初次失败后修复测试类型收窄与 preview session 构造；复跑通过。
  - `pnpm --filter web-claw check`：通过，`svelte-check found 0 errors and 0 warnings`。
  - IDE lints：相关路径无 linter errors。
  - `pnpm --filter os-core check-types`：2026-05-28 21:02 三层重构后复跑通过。
  - `pnpm --filter browserpod check-types`：2026-05-28 21:00 三层重构后复跑通过。
  - `pnpm --filter web-claw check`：2026-05-28 21:00 三层重构后复跑通过，`svelte-check found 0 errors and 0 warnings`。
  - IDE lints：2026-05-28 21:03 三层重构相关路径无 linter errors。
- Runtime / Test:
  - `pnpm --filter os-core test`：初次失败后修复 selected entry 排序；复跑通过，4 files / 21 tests。
  - `pnpm --filter browserpod test`：通过，7 files / 49 tests。
  - `pnpm --filter web-claw build`：通过，Svelte check 与 Vite build 成功。
  - `pnpm --filter os-core test`：2026-05-28 21:02 三层重构后初次失败，修复重复 target 默认 label 更新与测试计数后复跑通过，4 files / 20 tests。
  - `pnpm --filter browserpod test`：2026-05-28 21:02 三层重构后通过，7 files / 49 tests。
  - `pnpm --filter web-claw build`：2026-05-28 21:02 三层重构后通过，Svelte check 与 Vite build 成功。
- Human confirmation: 用户已批准执行。
- 结果汇总：服务预览三层方案重构已完成；Preview Tab 仍支持 Portal target 列表、手动 URL、iframe、刷新、外部打开、清除和容器阻塞态。
- 剩余风险：真实 BrowserPod Portal happy path 尚未手动验证；iframe 可能被目标页面策略阻止；`onPortal` 无 unsubscribe，当前通过 discovery attachment close flag 忽略 stale callback。

## Review / 复盘

- Requirements fidelity: 技术方案已覆盖服务预览语义、Portal 自动发现、手动 URL 兜底、多地址列表、刷新、外部打开、清除、容器阻塞态和失败反馈。
- Technical-plan fidelity: 三层方案已落地到当前实现，待真实 BrowserPod Portal 验证后复核。
- Quality: 待 review。
- Risk: 待 review。
- 结论：待 review。
