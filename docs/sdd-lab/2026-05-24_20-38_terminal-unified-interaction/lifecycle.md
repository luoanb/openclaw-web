# Lifecycle / 生命周期: Terminal Unified Interaction

```yaml
status: reviewing
result: pending
created_at: 2026-05-24 20:38
updated_at: 2026-05-25 02:05
owner: user
```

## Current Summary / 当前摘要

- 当前状态：`reviewing`，统一终端契约、BrowserPod terminal adapter 与 web-claw 最小终端面板已完成首轮实现和自动验证。
- 当前核心目标：以统一 `TerminalSession` 契约收敛终端交互；本期优先 BrowserPod adapter，WebContainer 仅作为参考基线。
- 当前下一步：由用户 review 首轮实现，并在具备有效 `VITE_BP_APIKEY` 与跨源隔离环境时做 BrowserPod happy path 手动验证。
- 当前卡点：真实 BrowserPod happy path 仍依赖有效 `VITE_BP_APIKEY` 与跨源隔离环境；运行中 stdin 能力保持保守声明。
- 下一步唯一动作：review 当前实现；若通过，再用真实 BrowserPod session 验证命令运行、`cd`、`clear` 与输出体感。
- 下一轮核心目标：补齐 BrowserPod happy path 手动证据，并决定是否扩展多终端 UI。

## Approval / 批准状态

- Requirements confirmed: `Approved`
- Technical plan confirmed: `Approved`
- Execution approval: `Approved`
- Approved by: user
- Approved at: 2026-05-25 01:58

## Execution Log / 执行记录

- 2026-05-24 20:38:
  - 动作：创建 sdd-lab 需求迭代，整理终端统一交互的需求阶段文档。
  - 涉及文件：`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/lifecycle.md`、`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/requirements.md`
  - 状态变化：无，初始状态为 `draft`（原因：需求尚未由用户确认；依据：用户要求按 sdd-lab 规范重新梳理终端文档；下一步：等待用户确认需求边界）
  - 偏差：无。
- 2026-05-24 20:58:
  - 动作：在 `demos/browserpod-demo` 新增 `interactive-terminal` case，并通过浏览器实测 BrowserPod stdin、`sh`/`bash`、`createCustomTerminal` 边界。
  - 涉及文件：`demos/browserpod-demo/src/cases/interactiveTerminal.case.js`、`demos/browserpod-demo/src/caseRegistry.js`、本迭代文档。
  - 状态变化：无，仍为 `draft`（原因：技术方案尚未生成；依据：本轮只验证能力并反写需求事实；下一步：确认需求边界后进入技术方案）。
  - 偏差：`createCustomTerminal` 的 `write` 暴露存在，但 guarded write 未能作为 stdin 喂给运行中 `read`，因此只确认输出接管，不确认完整 I/O 接管。
- 2026-05-24 20:59:
  - 动作：根据用户反馈修正需求口径，并生成统一终端交互技术方案。
  - 涉及文件：`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/requirements.md`、`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/technical-plan.md`、`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/lifecycle.md`
  - 状态变化：`draft -> planned`（原因：需求边界已按用户反馈修正，可进入技术方案确认；依据：用户明确要求继续生成技术方案；下一步：等待用户确认技术方案和执行批准）
  - 偏差：需求文档原先把 `ready/running/blocked/unsupported/failed` 写得偏用户可见标签，并把 `interactive-shell` / `command-runner` 放在用户交互层；本次已反写为状态机语义和 adapter 内部策略。
- 2026-05-24 21:16:
  - 动作：根据 review 反馈细化页面设计、收窄 WebContainer 范围，并补充容器管理前置依赖。
  - 涉及文件：`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/requirements.md`、`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/technical-plan.md`、`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/lifecycle.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案继续修订中；依据：用户提出方案 review 反馈；下一步：确认是否新开容器管理前置需求）
  - 偏差：原页面设计过粗；原方案把 WebContainer adapter 纳入执行步骤；原方案未显式处理容器启动管理前置依赖。
- 2026-05-24 21:16:
  - 动作：按用户选择创建 `container-runtime-management` 前置需求迭代。
  - 涉及文件：`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/lifecycle.md`、`docs/sdd-lab/2026-05-24_21-16_container-runtime-management/requirements.md`
  - 状态变化：无，仍为 `planned`（原因：当前迭代等待前置需求确认；依据：用户选择新开容器管理 SDD 需求迭代；下一步：确认容器管理需求边界）
  - 偏差：无。
- 2026-05-25 01:58:
  - 动作：用户要求从终端统一交互技术方案开始执行；反写当前实现事实与执行批准状态。
  - 涉及文件：`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/technical-plan.md`、`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/lifecycle.md`
  - 状态变化：`planned -> executing`（原因：用户明确指令“开始执行”；依据：本轮用户指令；下一步：实现 `os-core` 终端契约）
  - 偏差：技术方案原计划更新旧 specs，但旧 specs 已在容器管理迭代中按用户指令标记 Deprecated；本轮改为以当前 SDD 文档与已落地 runtime 契约为真相源。
- 2026-05-25 02:05:
  - 动作：落地统一终端首轮实现，包含 `os-core` 终端契约与状态机、BrowserPod terminal adapter、web-claw 终端面板接入。
  - 涉及文件：`packages/os-core/src/terminal/**`、`packages/browserpod/src/terminal/**`、`packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`、`apps/web-claw/src/lib/core/terminal/**`、`apps/web-claw/src/lib/features/terminal/components/TerminalPanel.svelte`、`apps/web-claw/src/App.svelte`
  - 状态变化：`executing -> reviewing`（原因：实现与最小验证完成；依据：类型检查、单测、Svelte check、浏览器冒烟结果；下一步：用户 review 与真实 BrowserPod 手动验证）
  - 偏差：BrowserPod 默认 terminal 输出仍由 SDK 挂载 DOM 承载；统一事件层本轮覆盖状态、notice、clear、process start/end，尚未获得稳定输出流事件。

## Validation / 验证

- Self-check: 已按 sdd-lab 技术方案阶段补齐并修订 `technical-plan.md`，将页面设计、WebContainer 范围和容器前置依赖反写到需求与方案。
- Static checks: 已检查技术方案覆盖需求基线、项目事实、拟定方案、容器前置依赖、页面设计、影响范围、执行步骤、风险和验证计划。
- Runtime / Test: `pnpm --filter os-core test` 通过 7 个测试；`pnpm --filter browserpod test` 通过 9 个测试。
- Type / Static checks: `pnpm --filter os-core check-types`、`pnpm --filter browserpod check-types`、`pnpm --filter web-claw check` 均通过。
- Browser smoke: 已打开 `http://localhost:5174/`；Terminal 面板渲染成功，容器未运行时 prompt 禁用，缺少 API Key 时 Runtime 面板展示 `BrowserPod API key is missing.`。
- Demo runtime: `demos/browserpod-demo` 新增 `interactive-terminal` case 后在 Chromium 中实测；默认 terminal 支持运行中 stdin；`sh -i` 有交互证据；`bash -i` 未保持长驻；custom terminal `onOutput` 可用但 stdin guarded write 超时。
- Human confirmation: 待用户 review 当前实现。
- 结果汇总：统一终端首轮实现已完成，状态进入 `reviewing`；WebContainer 仍仅作为参考。
- 剩余风险：真实 BrowserPod happy path 尚未用有效 API Key 验证；BrowserPod 默认 terminal 输出仍依赖 SDK DOM；多终端 UI、稳定运行中 stdin、进程中止和完整输出事件仍需后续迭代。

## Review / 复盘

- Requirements fidelity: 待 review。
- Technical-plan fidelity: 待用户确认。
- Quality: 待 review。
- Risk: 待 review。
- 结论：待 review。
