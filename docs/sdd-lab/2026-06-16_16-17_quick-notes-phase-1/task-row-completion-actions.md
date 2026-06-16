# SDD Light Increment / 任务行完成交互增强

## Restated Understanding / 需求复述

- 当前核心目标：增强任务 Tab 中进行中任务的可操作性，让用户既可以点击左侧勾选框完成任务，也可以点击任务行右侧的“完成”按钮完成任务。
- 进行中任务列表需要按当前展示顺序显示序号，帮助用户快速定位任务。
- 本轮只调整任务行展示与事件入口，不改变 `QuickTask` 数据结构、任务排序规则、本地 JSON 保存策略或已完成区行为。

## Scope / 范围

- In:
  - 进行中任务行展示序号。
  - 进行中任务行右侧新增“完成”按钮。
  - “完成”按钮复用现有 `onCompleteTask(task.id)` 链路，与左侧 checkbox 勾选效果一致。
- Out:
  - 已完成任务不展示序号。
  - 已完成任务不新增“完成”按钮。
  - 不新增任务状态、不改变 `TaskService.completeTask()`、不改 Tauri 后端。

## Done Contract / 完成契约

- 用户在进行中任务列表中能看到从 1 开始的序号，序号跟随当前排序/搜索结果展示。
- 用户点击进行中任务右侧“完成”按钮后，任务进入已完成区，效果与点击左侧 checkbox 一致。
- 已完成任务仍只提供恢复、编辑、删除能力，不显示进行中序号和“完成”按钮。
- `pnpm --filter quick-notes check` 通过；若运行构建，则记录 `pnpm --filter quick-notes build` 结果。

## Implementation Plan / 实施方案

1. `TaskList.svelte` 在 `{#each}` 中读取 index，并向 `TaskRow` 传入 `index + 1`。
2. `TaskRow.svelte` 新增可选 `position` prop；仅在 `done === false` 且存在序号时展示序号。
3. `TaskRow.svelte` 右侧 action 区在进行中状态显示“完成”按钮，点击调用 `onCompleteTask(task.id)`。
4. 保持 checkbox 原有 `onchange` 逻辑不变，避免引入第二套完成状态流转。

## Validation / 验证记录

- 2026-06-16 17:31:
  - 代码变更：`TaskList.svelte` 按当前展示顺序向 `TaskRow.svelte` 传入 `position={index + 1}`；`TaskRow.svelte` 仅在进行中任务展示序号，并在右侧 action 区新增“完成”按钮。
  - 行为结果：“完成”按钮调用既有 `onCompleteTask(task.id)`，与左侧 checkbox 勾选走同一条完成链路；已完成行不显示序号，也不显示“完成”按钮。
  - 静态检查：`pnpm --filter quick-notes check` 通过，`svelte-check` 0 errors / 0 warnings。
  - 构建验证：`pnpm --filter quick-notes build` 通过；仍存在既有 Crepe chunk size warning。
  - 剩余风险：尚未在 Tauri 桌面窗口中做人工点击验证。
