# Technical Plan / 技术方案: quick-notes pin and delete actions

## Context / 上下文

- 目标应用：`apps/quick-notes`
- 需求文档：`docs/sdd-lab/2026-06-17_20-43_quick-notes-pin-and-delete-actions/requirements.md`
- 当前架构：
  - `App.svelte` 持有 `QuickNotesStore`、当前 Tab、搜索词、`selectedNoteId` 和保存流程。
  - `TaskService` / `NoteService` 负责领域数据创建、更新、删除、过滤和排序。
  - `TasksTab` / `NotesTab` 负责视图拼装。
  - 本地 JSON 由 Tauri `save_store(store)` 持久化。

## Data Model / 数据模型

- 在 `QuickTask`、`QuickNote` 上新增：

```ts
pinnedAt?: string | null;
```

- `QuickNotesStoreService.normalizeStore()` 负责兼容旧数据：
  - 缺失 `pinnedAt` 时归一为 `null`。
  - 保留原有字段与数组顺序。
- `prepareForSave()` 保存归一后的 `tasks` / `notes`，确保本地 JSON 字段稳定。
- Tauri 后端 `src-tauri/src/lib.rs` 中的 `QuickTask` / `QuickNote` 也必须同步增加 `pinned_at: Option<String>`；否则 `save_store(store: QuickNotesStore)` 会在 Rust 反序列化时丢弃前端传入的 `pinnedAt`，并用丢字段后的返回值覆盖前端 store。

## Service Changes / 服务层变更

### TaskService

- `createTask()` 创建任务时写入 `pinnedAt: null`。
- 新增 `pinTask(tasks, taskId, now)`：仅对 `status === "active"` 的任务写入 `pinnedAt = now`，不更新 `updatedAt`，避免主列表排序变化。
- 新增 `unpinTask(tasks, taskId)`：清除 `pinnedAt`，不更新 `updatedAt`，避免主列表排序变化。
- `completeTask()` 将任务转为已完成时同步清除 `pinnedAt`，因为首期已完成任务不支持置顶。
- 新增 `getPinnedActiveTasks(tasks, query)`：基于同一过滤逻辑，仅返回 `status === "active"` 且有 `pinnedAt` 的任务，按 `pinnedAt` 倒序。
- 保持 `getActiveTasks()` 排序不变，置顶不影响主列表。

### NoteService

- `createNote()` 创建便签时写入 `pinnedAt: null`。
- 新增 `pinNote(notes, noteId, now)`：写入 `pinnedAt = now`，不更新 `updatedAt`，避免主列表排序变化。
- 新增 `unpinNote(notes, noteId)`：清除 `pinnedAt`，不更新 `updatedAt`，避免主列表排序变化。
- 新增 `getPinnedNotes(notes, query)`：基于同一搜索逻辑返回有 `pinnedAt` 的便签，按 `pinnedAt` 倒序。
- 保持 `getNotes()` 排序不变，置顶不影响主列表。

## App Coordination / 应用协调

- `App.svelte` 新增派生列表：
  - `pinnedActiveTasks`
  - `pinnedNotes`
- 新增事件：
  - `pinTask` / `unpinTask`
  - `pinNote` / `unpinNote`
- 修改 `deleteNote(noteId)`：
  - 删除 note。
  - 若 `selectedNoteId === noteId`，设置 `selectedNoteId = null`。
  - 若删除非当前 note，不改变 `selectedNoteId`。
  - 不再自动调用 `pickNextNoteId()`。

## UI Changes / UI 变更

### Tasks

- 新增 `PinnedTasks.svelte`，复用 `Collapsible`，默认 `open = false`。
- `TasksTab.svelte` 在进行中任务标题/列表之前展示 `PinnedTasks`。
- `TaskList.svelte`、`TaskRow.svelte` 增加 `onPinTask` / `onUnpinTask`。
- `TaskRow.svelte`：
  - 仅 `done === false` 时展示置顶/取消置顶 icon。
  - 已完成任务不展示置顶入口。
  - 保留完成、编辑、删除等既有操作。

### Notes

- 新增 `PinnedNotes.svelte`，复用 `Collapsible`，默认 `open = false`。
- `NotesSidebar.svelte`：
  - Header 下、主列表上方展示 `PinnedNotes`。
  - 每条便签行改为容器 + 主选择按钮 + 右侧 action buttons。
  - 右侧 action 默认透明，hover/focus 时显示。
  - 增加置顶/取消置顶 icon 和删除 icon。
  - 删除/置顶按钮点击时 `stopPropagation()`，不触发选择。
- `NotesTab.svelte` 传入 `pinnedNotes`、`onPinNote`、`onUnpinNote`、`onDeleteNote` 给 sidebar。
- `NoteEditor.svelte` 删除顶部删除按钮和 `onDeleteNote` prop，便签删除统一从列表行发起。

## Icons and I18n / 图标与文案

- `Icons.svelte` 增加 `pin` 和 `pin-off`。
- 中英文 i18n 增加：
  - `common.pin`
  - `common.unpin`
  - `common.pinned`
  - `tasks.empty.pinned`
  - `notes.empty.pinned`

## Validation / 验证

- `pnpm --filter quick-notes check`
- `pnpm --filter quick-notes build`
- Rust/Tauri 结构变更后运行 `pnpm --filter quick-notes tauri:build` 或等价 Tauri 构建验证。
- 手动回归：
  - 删除当前选中便签后右侧进入空状态。
  - 删除非当前选中便签不影响右侧编辑器。
  - 进行中任务置顶/取消置顶。
  - 已完成任务不展示置顶入口。
  - 便签置顶/取消置顶。
  - 置顶区默认折叠，展开后按置顶时间倒序展示。
  - 主列表排序不因置顶改变。
