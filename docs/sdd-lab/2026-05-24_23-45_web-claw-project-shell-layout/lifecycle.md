# Lifecycle / 生命周期: Web Claw Project Shell And Layout

```yaml
status: executing
result: pending
created_at: 2026-05-24 23:45
updated_at: 2026-05-25 01:36
owner: user
```

## Current Summary / 当前摘要

- 当前状态：`executing`，用户已批准并执行技术方案步骤 1-2；步骤 3 及后续暂不处理。
- 当前核心目标：为 web-claw 补齐项目搭建与系统级页面布局需求，作为后续 runtime、终端、文件、预览等能力接入的应用壳层基础。
- 当前下一步：等待用户确认是否继续执行步骤 3（建立 app shell），或先 review 当前步骤 1-2 的骨架和官方组件接入结果。
- 当前卡点：`packages/os-core` 与 `packages/browserpod` 尚未落地；后续从步骤 3 起仍需保证 app 不绕过契约直接依赖 BrowserPod，容器编排必须保持纯 TS 单例 + store + 展示组件三层架构。
- 下一步唯一动作：等待用户确认是否继续执行步骤 3；在确认前不处理后续步骤。
- 下一轮核心目标：若批准继续执行，建立 `App.svelte -> WebClawFrame` 的应用壳层组合，但仍不得在组件中直接编排容器生命周期。

## Approval / 批准状态

- Requirements confirmed: `Approved`
- Technical plan confirmed: `Approved for steps 1-2`
- Execution approval: `Approved for steps 1-2 only`
- Approved by: user
- Approved at: 2026-05-25 01:14

## Execution Log / 执行记录

- 2026-05-24 23:45:
  - 动作：新建 web-claw 项目搭建与系统页面布局需求迭代。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`
  - 状态变化：无，初始状态为 `draft`（原因：用户指出现有需求遗漏 web-claw 项目搭建和整个系统页面布局，并确认新开合并迭代；依据：本轮用户选择；下一步：等待用户确认需求边界）
  - 偏差：无。
- 2026-05-25 00:46:
  - 动作：根据用户对开放问题 Q2-Q6 的答复更新需求文档，并补充 Q1 的问题解释。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：无，仍为 `draft`（原因：需求仍有 Q1 范围问题未确认；依据：用户确认首屏终端、容器自动启动、Tab 占位、抽屉详情、正式 app、旧 specs 禁用参考；下一步：等待用户确认 Q1 与需求是否可进入技术方案）
  - 偏差：原需求文档未明确首屏终端优先、容器自动启动、Tab 占位、抽屉详情、正式 app，以及旧 specs 禁用参考口径。
- 2026-05-25 00:49:
  - 动作：根据用户对 Q1 的补充答复，确认第一阶段只允许一个当前容器，并补充 Tab 右侧更多菜单入口。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：无，仍为 `draft`（原因：需求问题已收敛，但尚未由用户明确批准进入技术方案；依据：用户说明目前仅允许一个容器，进入页面即启动，并在 Tab 右侧添加更多菜单；下一步：等待用户确认需求文档是否进入技术方案阶段）
  - 偏差：原需求文档将 Q1 表达为 workspace 列表/切换问题，未明确第一阶段单容器和 Tab 右侧系统操作入口。
- 2026-05-25 00:52:
  - 动作：移除第一阶段 workspace 产品上下文口径，改为“容器是一台计算机”的需求表述。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：无，仍为 `draft`（原因：需求语义纠偏，不进入技术方案；依据：用户明确当前没有 workspace 概念，未来如有工作区也在容器内部；下一步：等待用户确认需求文档是否进入技术方案阶段）
  - 偏差：原需求文档仍保留 workspace 作为产品上下文的表达，容易误导后续技术方案。
- 2026-05-25 00:54:
  - 动作：生成 web-claw 项目搭建与系统页面布局技术方案。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/technical-plan.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：`draft -> planned`（原因：用户明确要求“开始落地技术方案”；依据：本轮用户指令；下一步：等待用户确认技术方案和执行批准）
  - 偏差：无。
- 2026-05-25 00:59:
  - 动作：按用户 review 移除单独 Header 设计，改为 Tabs 顶部区域承载状态入口和更多菜单。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/technical-plan.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：用户明确“不需要header”；下一步：等待用户继续 review 或确认技术方案和执行批准）
  - 偏差：原技术方案将 Header 作为独立页面区域，超出第一阶段布局需求。
- 2026-05-25 01:01:
  - 动作：将应用框架关键组件从 `Shell*` 命名调整为更通用的 `Frame` / `Workbench` 命名。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/technical-plan.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：用户指出全都命名 Shell 意义不清；下一步：等待用户继续 review 或确认技术方案和执行批准）
  - 偏差：原技术方案使用 `WebClawShell`、`ShellTabs`、`ShellMoreMenu`，容易与终端 shell 概念混淆。
- 2026-05-25 01:09:
  - 动作：补充三层架构约束，明确容器逻辑编排采用纯 TS 单例、状态更新由 store 持有、组件尽量只做展示。
  - 涉及文件：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/technical-plan.md`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：用户明确希望容器逻辑编排采用纯 TS、单例注入、store 持有状态、页面组件尽可能仅展示；下一步：等待用户继续 review 或确认技术方案和执行批准）
  - 偏差：原技术方案仍允许 `WebClawFrame` / runtime feature 组件承担较多 runtime provider/controller 职责，未明确禁止 Svelte `$state` 成为容器核心状态真相源。
- 2026-05-25 01:36:
  - 动作：按用户批准开始执行技术方案前两步骤，创建正式 `apps/web-claw` 项目骨架，并使用官方 `shadcn-svelte` / Bits UI 流程接入全量公共 UI 组件。
  - 涉及文件：`apps/web-claw/**`、`pnpm-lock.yaml`、`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/lifecycle.md`
  - 状态变化：`planned -> executing`（原因：用户明确要求“开始执行前两步骤（后续步骤暂不处理）”；依据：本轮用户指令；下一步：等待用户确认是否继续执行步骤 3）
  - 偏差：技术方案步骤 2 原计划迁移最小公共 UI 基础；执行中根据用户补充要求改为查询官方接入流程并使用 `shadcn-svelte add --all` 接入全量组件。该偏差只影响公共 UI 组件范围，未进入 app shell、runtime、终端、文件或预览实现。

## Validation / 验证

- Self-check: 已按技术方案阶段创建 `technical-plan.md`，并将状态更新为 `planned`；未进入代码执行。
- Static checks: 已检查技术方案覆盖需求基线、项目事实、项目搭建、runtime 接入、页面设计、影响范围、执行步骤、风险和验证计划；已记录 Q1-Q6 结论，去除第一阶段 workspace 产品上下文口径，移除单独 Header 设计，将应用框架组件改为通用命名，并补充纯 TS 单例编排 + store + 展示组件三层架构。
- Runtime / Test:
  - `pnpm --filter web-claw check`：通过，`svelte-check found 0 errors and 0 warnings`。
  - `pnpm --filter web-claw build`：通过，Vite build 成功。
  - 静态搜索 `@leaningtech/browserpod|web-os|@webcontainer/api|BrowserPod`：`apps/web-claw` 无匹配。
  - IDE lints：`apps/web-claw` 无 linter errors。
- Human confirmation: 用户已批准步骤 1-2 执行；步骤 3 及后续仍待用户确认。
- 结果汇总：正式 `apps/web-claw` 骨架已创建，官方 shadcn-svelte / Bits UI 公共组件已接入，构建产物已清理并由 `.gitignore` 排除。
- 剩余风险：`packages/os-core` 与 `packages/browserpod` 尚未落地；后续步骤 3 起仍需防止 app 直接依赖 BrowserPod 或废案 `web-os`。本轮未做 COOP/COEP header 的浏览器手动验证。

## Review / 复盘

- Requirements fidelity: 待用户 review。
- Technical-plan fidelity: 待用户确认。
- Quality: 待 review。
- Risk: 待 review。
- 结论：待 review。
