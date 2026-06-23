# Requirements / 需求文档: quick-notes deprecate tasks & data sync

## Restated Understanding / 需求复述

- 我理解当前需求是：对 `apps/quick-notes` 做功能增强与数据能力增强——**保留任务（Tasks）功能**，为任务数据层和 UI 新增 **`deprecated`（已废弃）状态**；**进行中（`active`）任务可转为 `done` 或 `deprecated`**，`done` / `deprecated` 均可恢复为 `active`；**不做加载时批量改写旧任务状态**；**release 构建隐藏顶栏开发者工具**；设置弹窗新增 **JSON 导出/导入**（覆盖/追加、冲突策略、覆盖二次确认）。
- 当前核心目标是：任务继续可用，并新增“已废弃”作为与“已完成”并列的任务归档状态；用户可完整备份/恢复任务与便签数据。
- 当前边界是：仅 `apps/quick-notes`。
- 暂不处理：云端同步、任务状态的批量迁移。

## Scope / 范围

- In:
  - `TaskStatus` 扩展为 `active` | `done` | `deprecated`（前后端一致）。
  - 任务状态机：
    - `active` → `done`（完成，既有语义）
    - `active` → `deprecated`（废弃该条任务，新增）
    - `done` → `active`（恢复为进行中，既有语义）
    - `deprecated` → `active`（恢复为进行中，新增）
    - **禁止**加载时把 `active`/`done` 批量改为 `deprecated`。
  - 保留任务 Tab 与现有任务 CRUD / 置顶 / 完成 / 恢复能力；新增任务废弃入口和已废弃任务展示区。
  - release 构建顶栏菜单不展示「开发者工具」；dev 模式保留。
  - 设置弹窗「数据」：导出完整 store 为 JSON 下载；导入本地 JSON（覆盖/追加、冲突策略、覆盖二次确认）。
  - 导入校验：合法 JSON、结构合法、`content` 非空；`tasks` 中 `status` 须为三种合法值之一。
  - 中英文 i18n。
- Out:
  - 加载时自动迁移任务状态。
  - 剪贴板同步、自动定时备份。

## User Interaction / 用户交互

### 1. 任务新增已废弃状态

- UI：保留任务 Tab；进行中任务可点击“废弃”进入 `deprecated`；已废弃任务在独立区块展示，并可恢复为进行中。
- 数据：本地 JSON 中 `tasks` 数组**原样读写**；`active`/`done`/`deprecated` 均保留，不因升级而被改写。

### 2. 开发者工具

- release：顶栏 `⋯` 菜单仅「设置」。
- dev：仍可见「开发者工具」且可用。

### 3. 导出

- 入口：设置 → 数据 → 导出。
- 内容：完整 `QuickNotesStore`（`notes` + `tasks`，各任务保持当前 `status`）。
- 操作：下载 JSON 到本地。

### 4. 导入

- 入口：设置 → 数据 → 导入。
- 模式：**覆盖**（二次确认）/ **追加**；追加时冲突策略：**保留当前** / **以导入为准**。
- 反馈：成功/失败提示；失败不破坏现有数据。

## Acceptance Criteria / 验收标准

- [ ] AC1：release 无「开发者工具」菜单项；dev 仍可用。
- [ ] AC2：任务 Tab 与原有任务能力保留；进行中任务可转为已废弃，已废弃任务可恢复为进行中。
- [ ] AC3：升级后加载旧 JSON，`active`/`done` 任务 **status 不变**；含 `deprecated` 的 JSON 可正常加载。
- [ ] AC4：类型与 Rust 校验接受 `active` | `done` | `deprecated` 三种 status。
- [ ] AC5：设置弹窗可导出 JSON，内容与当前 store 一致（含全部 tasks）。
- [ ] AC6：覆盖/追加导入及冲突策略符合需求；覆盖经二次确认。
- [ ] AC7：非法 JSON 或校验失败有明确错误，不静默丢数据。
- [ ] AC8：中英文文案完整。
- [ ] AC9：`pnpm --filter quick-notes check` 与 `build` 通过。

## Constraints / 约束

- 业务约束：任务功能保留；“已废弃”只是任务新增状态，不是删除任务功能。
- 技术约束：`deprecated` 为状态枚举扩展；`active` 可流转至 `done` 或 `deprecated`，`done` / `deprecated` 可恢复为 `active`。
- 兼容性：兼容既有 `quick-notes.json`（仅含 `active`/`done`）与本应用导出文件。

## Open Questions / 开放问题

- [x] **Q1** → 新增 `deprecated` 枚举；`active` 可转 `done` 或 `deprecated`；**不**做加载批量迁移。
- [x] **Q2** → 导出下载 JSON；导入上传 JSON。
- [x] **Q3** → 追加冲突：保留当前 / 以导入为准。
- [x] **Q4** → 导出含完整 tasks。
- [x] **Q5** → 覆盖需二次确认。

## Requirement Decisions / 需求决策

- 2026-06-23（Q1–Q5）：见 Open Questions。
- 2026-06-23（Q1 澄清）：
  - **纠正**：`deprecated` 是任务状态枚举之一，不是「功能废弃 = 全员改 deprecated」。
  - **状态机**：`active` → `done` | `deprecated`；`done` | `deprecated` → `active`（恢复进行中）；历史数据加载时保持原 status。
- 2026-06-23（实现偏差纠正）：
  - **纠正**：任务功能不能删除；必须保留任务 UI，并新增 `deprecated` 的展示与操作。
