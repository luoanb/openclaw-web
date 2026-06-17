# Note Autosave Create/Update Fix / 速记自动保存新增修改判定修复

## Context / 背景

- 目标应用：`apps/quick-notes`
- 触发时间：2026-06-17 10:38
- 用户反馈：同一个速记内容保存时，偶发被反复新增。
- 影响范围：速记 Tab 的新增态、自动保存、手动保存、创建成功后的后续编辑。

## Diagnosis / 诊断

- 当前保存分流不按内容去重，而按编辑器提交时的 `creating` 与 `note.id` 判断：
  - `creating === true` → 调用 `onCreateNote(content)`。
  - `creating === false && note.id` → 调用 `onUpdateNote(note.id, content)`。
- 新建速记时，`NoteEditor.svelte` 创建 `DiffAutoSaver`，其 `submitSnapshot` 闭包捕获初始化时的 `isCreating = true` 和 `activeNoteId = null`。
- 为修复此前“创建成功后编辑器重建导致光标丢失”的问题，`NotesTab.svelte` 在 `createNote()` 后刻意不递增 `editorViewKey`，因此编辑器实例和 `DiffAutoSaver` 会跨越 `creating -> saved` 转换继续存活。
- 结果是：UI 状态已从新增态转为已有笔记，但自动保存闭包仍可能使用旧的新增态判断，后续保存继续调用 `onCreateNote()`，造成同一内容重复新增。

## Desired Behavior / 期望行为

- 第一次保存新增速记时，允许走 `onCreateNote(content)` 并生成新 `note.id`。
- 创建成功后，当前编辑器实例必须知道“当前草稿已经绑定到新 noteId”。
- 后续自动保存或手动保存同一编辑器内容时，应调用 `onUpdateNote(noteId, content)`，不得重复调用 `onCreateNote()`。
- 修复不能重新引入创建成功后编辑器重建、光标丢失的问题。

## Fix Plan / 修复方案

1. 在 `NoteEditor.svelte` 内维护编辑器实例级别的保存目标状态，例如 `saveTarget = { mode: "create" } | { mode: "update"; noteId: string }`。
2. 初始化编辑器时，根据当时的 `creating` 与 `note?.id` 设置 `saveTarget`。
3. `submitSnapshot` 与手动保存不再使用初始化闭包捕获的 `isCreating` / `activeNoteId`，而是读取当前 `saveTarget`。
4. 当 `creating` 变为 `false` 且 `note?.id` 存在时，在已有的 `creating -> saved` 监听中：
   - 调用 `autoSaver.markCommitted(note.content ?? "")`。
   - 将 `saveTarget` 更新为 `{ mode: "update", noteId: note.id }`。
5. 保持 `viewKey` 只由用户显式“新增/选择笔记”驱动，不因自动保存创建成功而重建编辑器。

## Done Contract / 完成契约

- 新建速记输入内容后，首次自动保存只新增一条笔记。
- 在不切换编辑器、不点击新建的情况下继续编辑，后续自动保存更新同一条笔记。
- 点击手动“保存”也遵守同一规则：已创建成功后更新当前 noteId，不重复新增。
- `pnpm --filter quick-notes check` 通过。
- 若时间允许，补跑 `pnpm --filter quick-notes build`；若构建仍只有既有 Crepe chunk size warning，则记录为非阻塞风险。

## Non-goals / 非目标

- 不引入按内容去重；相同内容的不同速记仍允许存在。
- 不改变 `QuickNote` 数据结构。
- 不改变 Tauri `load_store` / `save_store` 后端命令。
- 不改变本地 JSON 文件路径或保存策略。

## Result / 结果

- 已在 `apps/quick-notes/src/lib/features/notes/NoteEditor.svelte` 中引入编辑器实例级 `saveTarget`。
- `DiffAutoSaver.submitSnapshot` 与手动“保存”不再使用初始化闭包捕获的 `creating` / `note.id`，而是读取当前 `saveTarget`。
- 当 `creating -> saved` 且当前 `note.id` 可用时，`saveTarget` 会切换为 `update(note.id)`，并同步更新 `autoSaver` 的 committed snapshot。
- 保持 `viewKey` 策略不变，自动保存创建成功后不重建编辑器，避免光标丢失回归。

## Validation / 验证

- `pnpm --filter quick-notes check` 通过：0 errors / 1 warning。
- `pnpm --filter quick-notes build` 通过：0 errors / 既有 warnings。
- 非阻塞 warning：
  - `SettingsModal.svelte` 仍有既有 `a11y_label_has_associated_control` warning。
  - `store.svelte.js` 仍有既有 `state_referenced_locally` warning。
  - Vite 仍有既有 Crepe 相关 chunk size warning。
