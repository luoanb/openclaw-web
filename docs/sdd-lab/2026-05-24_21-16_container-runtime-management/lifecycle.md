# Lifecycle / 生命周期: Container Runtime Management

```yaml
status: reviewing
result: pending
created_at: 2026-05-24 21:16
updated_at: 2026-05-25 01:56
owner: user
```

## Current Summary / 当前摘要

- 当前状态：`reviewing`，容器 runtime 管理首轮实现已完成并通过最小验证。
- 当前核心目标：已在 `os-core` 固化 runtime manager/session/capability/error/event 契约，并由 BrowserPod adapter 提供 check/boot/stop/snapshot/event 实现。
- 当前下一步：由用户 review 实现；若通过，可进入后续终端能力接入。
- 当前卡点：真实 BrowserPod boot 仍依赖有效 `VITE_BP_APIKEY` 与浏览器跨源隔离环境；stop/dispose 底层官方能力仍按未知处理。
- 下一步唯一动作：review 当前实现与页面状态面板。
- 下一轮核心目标：让终端 adapter 接收 `RuntimeSession`，不再自行 boot BrowserPod。

## Approval / 批准状态

- Requirements confirmed: `Approved`
- Technical plan confirmed: `Approved`
- Execution approval: `Approved`
- Approved by: user
- Approved at: 2026-05-25 01:44

## Execution Log / 执行记录

- 2026-05-24 21:16:
  - 动作：创建容器 runtime 管理前置需求迭代。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/lifecycle.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`
  - 状态变化：无，初始状态为 `draft`（原因：需求尚未由用户确认；依据：终端统一交互方案发现容器启动/管理是前置依赖；下一步：等待用户确认需求边界）
  - 偏差：无。
- 2026-05-24 21:33:
  - 动作：生成容器 runtime 管理技术方案，明确先约定 `os-core` API，再由 BrowserPod adapter 实现。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/lifecycle.md`
  - 状态变化：`draft -> planned`（原因：用户确认“应该约定好容器管理相关 API，再由适配器实现”，并要求开始落地技术方案；依据：本轮用户指令；下一步：等待用户确认技术方案和执行批准）
  - 偏差：无。
- 2026-05-24 21:36:
  - 动作：补充 runtime 状态模型的来源与必要性说明。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案解释补充；依据：用户询问状态来源与必要性；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案只列出状态枚举，未说明状态来源和为什么需要这些状态。
- 2026-05-24 21:51:
  - 动作：修正容器管理契约边界，移除通用 boot options 中的 BrowserPod/产品层参数，并移除 `RuntimeSession` 对上层能力的反向调用。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：用户指出通用契约不应要求所有 adapter 具备 BrowserPod 参数，容器不应反向调用上层内容；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案把 `apiKey`、`storageKey`、`env`、`workspaceId` 放入通用 `RuntimeBootOptions`，且在 `RuntimeSession` 上暴露 `createTerminal()`、`run()`、`abort()`，造成 adapter 泄漏和依赖方向错误。
- 2026-05-24 22:01:
  - 动作：补充 `RuntimeSnapshot` 类型定义和用途说明。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案解释补充；依据：用户询问 `RuntimeSnapshot` 是什么；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案引用了 `RuntimeSnapshot`，但未定义其结构和边界。
- 2026-05-24 22:07:
  - 动作：将 `RuntimeManager.check()` 调整为可选方法，并约定未实现时默认检查通过。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：用户指出 check 应为可选且无 check 时默认通过；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案把 `check()` 写成所有 adapter 必须实现的方法，过度约束了通用 runtime 契约。
- 2026-05-24 22:07:
  - 动作：补充 `Unsubscribe` 类型定义和订阅清理语义。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案解释补充；依据：用户询问 `Unsubscribe` 是什么；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案引用了 `Unsubscribe`，但未定义其形态与幂等清理约束。
- 2026-05-24 22:31:
  - 动作：补充 `RuntimeEventListener`、`RuntimeSessionEvent` 与 `RuntimeSessionEventListener` 类型定义和边界。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案解释补充；依据：用户询问 `RuntimeSessionEventListener` 是什么；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案引用了 `RuntimeSessionEventListener`，但未定义 listener 签名和 session 事件边界。
- 2026-05-24 23:25:
  - 动作：根据用户对开放问题 Q1-Q7 的答复更新需求与技术方案，并核对 BrowserPod 官方文档。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：用户逐条回答开放问题并要求核对官方文档；下一步：等待用户继续 review 或确认方案）
  - 偏差：原文未说明 BrowserPod 官方 reference 未提供 stop/dispose，且部分“重试”表述容易被误解为 runtime 自动策略。
- 2026-05-24 23:28:
  - 动作：补充 runtime capabilities 与 runtime status 的边界，明确 adapter 静态能力与 session 实际能力。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案解释补充；依据：用户询问 capabilities 是否是运行状态或由适配器实现决定；下一步：等待用户继续 review 或确认方案）
  - 偏差：原文只说 capabilities 是能力摘要，但未明确它不是运行状态，也未区分静态能力和 session 实际能力。
- 2026-05-24 23:32:
  - 动作：补充容器管理页面设计，明确面向用户的功能与状态面板结构。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案补充；依据：用户询问容器管理页面设计及面向用户应提供哪些功能；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案只说明 app 接入与依赖状态，缺少完整容器状态面板、用户操作和页面结构。
- 2026-05-24 23:39:
  - 动作：统一停止语义为“容器关机”，移除“真实停止/产品态停止”的用户可见区分。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：用户明确停止就是容器关机且只有一个概念；下一步：等待用户继续 review 或确认方案）
  - 偏差：原技术方案将停止文案拆成真实停止和产品态停止，暴露了不应面向用户的底层实现差异。
- 2026-05-25 00:54:
  - 动作：按 web-claw 项目壳层需求反写容器管理文档，移除第一阶段外层 workspace 口径。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/lifecycle.md`
  - 状态变化：无，仍为 `planned`（原因：需求语义纠偏；依据：用户明确当前没有 workspace 概念，容器可理解为一台计算机；下一步：等待用户继续 review 或确认方案）
  - 偏差：原文把容器启动与 storageKey 绑定到 workspace 口径，容易误导第一阶段实现。
- 2026-05-25 01:44:
  - 动作：用户要求从 `technical-plan.md` 开始执行；回写执行批准状态，并准备执行桥接记录。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/lifecycle.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/references/exec-scheme-bridge.md`
  - 状态变化：`planned -> executing`（原因：用户明确指令“开始执行”；依据：本轮用户指令；下一步：先更新旧 specs，再进入代码实现）
  - 偏差：无。
- 2026-05-25 01:48:
  - 动作：按用户指令将旧 specs 标记为废弃，不再维护旧方案内容。
  - 涉及文件：`docs/specs/2026-05-24_18-00_web-claw-core-contract.md`、`docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：执行策略调整；依据：用户明确“旧方案标记为废弃，不管”；下一步：落地 `packages/os-core` runtime 契约）
  - 偏差：原执行步骤计划维护旧 specs；现改为 deprecated 索引，当前 SDD 文档继续作为真相源。
- 2026-05-25 01:56:
  - 动作：落地 `packages/os-core` runtime 契约、BrowserPod runtime adapter、web-claw runtime 状态面板与最小验证。
  - 涉及文件：`packages/os-core/**`、`packages/browserpod/**`、`apps/web-claw/src/lib/core/runtime/**`、`apps/web-claw/src/lib/features/runtime/components/RuntimeStatusPanel.svelte`、`apps/web-claw/src/App.svelte`、`apps/web-claw/package.json`、`pnpm-lock.yaml`
  - 状态变化：`executing -> reviewing`（原因：实现与验证完成；依据：typecheck、单测、Svelte check 与浏览器冒烟结果；下一步：用户 review）
  - 偏差：旧 specs 不再维护为新版方案，仅保留 deprecated 索引；这是按用户最新指令执行。

## Validation / 验证

- Self-check: 已按用户指令废弃旧 specs，并以当前 SDD 文档与执行桥接为真相源。
- Static checks: `pnpm --filter os-core check-types`、`pnpm --filter browserpod check-types`、`pnpm --filter web-claw check` 均通过。
- Runtime / Test: `pnpm --filter os-core test` 通过 4 个测试；`pnpm --filter browserpod test` 通过 5 个测试。
- Browser smoke: 已打开 `http://localhost:5174/`，Runtime 面板渲染正常；缺少 `VITE_BP_APIKEY` 时页面展示 `BrowserPod API key is missing.`。
- Human confirmation: 待用户 review 当前实现。
- 结果汇总：容器 runtime 管理首轮实现已完成，状态进入 `reviewing`。
- 剩余风险：尚未用真实 API Key 完成 BrowserPod happy path boot；终端 adapter 尚未接入 `RuntimeSession`；BrowserPod stop/dispose 官方能力仍未知。

## Review / 复盘

- Requirements fidelity: 待 review。
- Technical-plan fidelity: 待用户确认。
- Quality: 待 review。
- Risk: 待 review。
- 结论：待 review。
