# Micro Spec: quick-notes Markdown copy/export

## Goal

在 `apps/quick-notes` 的便签编辑器顶部，在现有「保存」旁新增：

- 「复制内容」：复制当前编辑器 Markdown 内容到系统剪贴板。
- 「导出」：将当前编辑器 Markdown 内容导出为 `.md` 文件，交互与现有「导出 JSON」保持一致（触发文件下载）。

## Context

- `NoteEditor.svelte` 使用 Milkdown/Crepe；`crepeEditor.getMarkdown()` 返回当前编辑器 Markdown。
- `QuickNote.content` 当前保存的就是 Markdown 字符串。
- 现有 `SettingsModal` 仅支持完整 store 的 JSON 导出/导入，不覆盖本需求。
- 2026-06-30 决策：导出 Markdown 不接入 Tauri dialog/fs，沿用现有 JSON 导出的浏览器下载方式。
- 2026-06-30 追加决策：由于 `<a download>` 无法获取最终绝对路径，导出成功提醒展示文件名，并提示查看系统下载目录。

## Boundary

- In:
  - 仅支持当前正在编辑/查看的单篇便签。
  - 空内容时禁用复制与导出。
  - 导出默认文件名基于便签标题或默认名称，并使用 `.md` 扩展名。
  - 复制/导出结果给出轻量成功/失败反馈；导出成功反馈需包含 `.md` 文件名。
  - 补齐中英文文案。
- Out:
  - 不改现有 JSON 导出/导入。
  - 不做全部便签批量 Markdown 导出。
  - 不改变便签存储结构。
  - 不引入任务数据导出为 Markdown。

## Minimal Plan

1. 在 `NoteEditor.svelte` 新增复制与导出按钮，复用 `getEditorContent()` 读取 Markdown。
2. 复制优先使用 `navigator.clipboard.writeText()`。
3. 导出使用 Blob + `<a download>`，沿用 JSON 导出交互。
4. 补齐 i18n 文案。
5. 运行 `pnpm --filter quick-notes check`；视情况运行 `pnpm --filter quick-notes build`。

## Done Contract

- 当前笔记有内容时，可一键复制 Markdown 文本。
- 当前笔记有内容时，点击「导出」会触发 `.md` 文件下载，并提示导出的文件名。
- 现有 JSON 导出/导入能力不受影响。
- `pnpm --filter quick-notes check` 通过；若无法运行完整构建，需要记录原因。

## Execution Checkpoint

- Files likely to change:
  - `apps/quick-notes/src/lib/features/notes/NoteEditor.svelte`
  - `apps/quick-notes/src/lib/core/i18n/zh.ts`
  - `apps/quick-notes/src/lib/core/i18n/en.ts`
- Files not expected to change:
  - `apps/quick-notes/package.json`
  - `apps/quick-notes/src-tauri/**`
- Non-goals: JSON 数据同步、批量导出、存储格式迁移。
- Approval: Approved by user ("和「导出 JSON」一样的交互")

## Change Log

- `NoteEditor.svelte`：在编辑器顶部新增「复制内容」「导出」按钮；复制当前 Markdown 到剪贴板；导出当前 Markdown 为 `.md` 下载文件。
- `zh.ts` / `en.ts`：补齐按钮与复制/导出成功失败提示文案。
- 未改动 JSON 导出/导入逻辑，未接入 Tauri dialog/fs。
- 2026-06-30 追加：导出成功提示改为包含导出的 `.md` 文件名，并提示查看系统下载目录。

## Validation

- `pnpm --filter quick-notes check`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`
- 2026-06-30 追加变更后重跑 `pnpm --filter quick-notes check`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`

## Resume / Handoff

- 当前核心目标已由静态检查覆盖；仍需人工在桌面应用中点选一条便签，验证剪贴板内容与下载 `.md` 文件名/内容符合预期。
