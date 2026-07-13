# Micro Spec: quick-notes mobile actions and drawers

## Goal

调整 `apps/quick-notes` 的移动端与操作入口体验：

1. 采纳大纲入口新位置：小屏使用图标按钮，不再放在顶部「复制 / 导出 / 保存」操作组内。
2. 将当前便签 Markdown 导出按钮作为主按钮，文案改为「导出文件」。
3. 设置里的数据导入导出语义改为「数据迁移」：
   - 「导出 JSON」改为「导出到本地」
   - 「导入 JSON」改为「从本地还原」
4. 左侧便签列表在小屏改为抽屉支持。

## Context

- 当前 `NoteEditor.svelte` 的大纲入口是文字按钮，放在顶部 action group 内，语义上混入了复制、导出、保存。
- 当前 `NoteEditor.svelte` 的 Markdown 导出按钮使用 `common.export` 文案「导出」，样式是 outline。
- 当前 `SettingsModal.svelte` 的数据区标题为 `settings.data`，按钮文案为 `settings.export` / `settings.import`，实际逻辑仍是完整 store 的 JSON 导出/导入。
- 当前 `NotesTab.svelte` 始终渲染左侧 `NotesSidebar`，在小屏会挤压右侧编辑区。
- 当前已有 `NoteOutlineDrawer.svelte` 使用 `bits-ui` Dialog primitive 实现右侧抽屉，可复用同类模式实现小屏便签列表抽屉。

## UX / Design Decisions

### 大纲入口

- 小屏入口从顶部 action group 移出，放到编辑器 body 的右上角。
- 使用图标按钮，不显示「大纲」文字。
- 建议图标：新增一个 list/outline 类 SVG 到 `Icons.svelte`，按钮 `aria-label` 使用 `notes.outline`。
- 大屏仍展示右侧大纲面板，因此该按钮只在小屏显示。
- 按钮应是轻量 outline/ghost 形态，不抢过「导出文件」主按钮。

### 当前便签导出

- `NoteEditor.svelte` 中当前 Markdown 导出按钮变为主按钮。
- 文案使用独立 key，例如 `notes.exportFile`：
  - zh: `导出文件`
  - en: `Export File`
- 复制与保存继续保持次级 outline 样式。
- 不改变导出的 `.md` 文件内容、文件名生成或下载方式。

### 设置数据迁移

- 设置里的完整 JSON 导入导出仅调整文案：
  - `settings.data`: `数据迁移` / `Data Migration`
  - `settings.export`: `导出到本地` / `Export to Local`
  - `settings.import`: `从本地还原` / `Restore from Local`
- 不改变 JSON 格式、导入模式、冲突处理、覆盖确认逻辑。

### 小屏便签列表抽屉

- 大屏：保留当前左侧 `NotesSidebar` 常驻。
- 小屏：隐藏常驻 `NotesSidebar`，在速记页顶部或编辑区顶部提供一个图标按钮打开便签列表抽屉。
- 抽屉内容复用 `NotesSidebar` 的列表、置顶、新增、选择、删除、置顶/取消置顶能力。
- 从抽屉选择便签或新增便签后关闭抽屉，让用户回到编辑器。
- 抽屉从左侧打开，宽度建议 `min(85vw, 20rem)`。
- 抽屉使用 `bits-ui` Dialog primitive，保持 Esc 关闭、遮罩关闭和焦点可访问。

## Boundary

- In:
  - 移动端大纲图标入口位置调整。
  - 当前便签导出按钮主按钮样式与文案调整。
  - 设置数据迁移相关文案调整。
  - 小屏便签列表抽屉。
  - 中英文 i18n 补齐。
- Out:
  - 不改 `QuickNote` / `QuickNotesStore` 数据结构。
  - 不改 Markdown 导出内容或 JSON 导入导出格式。
  - 不做拖拽、排序、批量选择或全局搜索重构。
  - 不引入新依赖。
  - 不重构设置弹窗为 Bits UI Dialog，本轮只改文案。

## Minimal Technical Plan

1. `Icons.svelte` 新增 outline/list 图标，用于大纲入口和便签列表入口。
2. `NoteEditor.svelte`：
   - 移除顶部 action group 内的大纲文字按钮。
   - 在编辑器 body 内部右上角添加小屏大纲图标按钮。
   - 将 Markdown 导出按钮改为主按钮，并使用 `notes.exportFile` 文案。
3. `NotesSidebar.svelte`：
   - 支持可选 `class` 与可选 close slot/按钮或通过外层控制样式，便于复用到常驻侧栏和抽屉。
   - 保持列表本身逻辑不变。
4. 新增 `NotesSidebarDrawer.svelte`：
   - 使用 `bits-ui` Dialog primitive 从左侧打开。
   - 复用 `NotesSidebar`。
   - 选择便签或新增便签后关闭抽屉。
5. `NotesTab.svelte`：
   - 大屏渲染常驻 `NotesSidebar`。
   - 小屏渲染便签列表图标按钮和 `NotesSidebarDrawer`。
   - 保持搜索空状态逻辑不变。
6. `zh.ts` / `en.ts` 更新文案。
7. 运行 `pnpm --filter quick-notes check`；通过后运行 `pnpm --filter quick-notes build`。

## Done Contract

- 小屏大纲入口是图标按钮，位于编辑器 body 右上角，不再混在复制/导出/保存操作组中。
- 当前便签 Markdown 导出按钮为主按钮，文案为「导出文件」。
- 设置里的数据区显示为「数据迁移」，完整数据导出/导入按钮显示为「导出到本地」「从本地还原」。
- 小屏下左侧便签列表可通过抽屉打开，并可选择、新增、删除、置顶/取消置顶。
- 大屏下现有左侧便签列表仍常驻。
- `pnpm --filter quick-notes check` 通过。
- `pnpm --filter quick-notes build` 通过，或记录非代码原因与剩余风险。

## Execution Checkpoint

- Files likely to change:
  - `apps/quick-notes/src/lib/features/common/Icons.svelte`
  - `apps/quick-notes/src/lib/features/notes/NoteEditor.svelte`
  - `apps/quick-notes/src/lib/features/notes/NotesSidebar.svelte`
  - `apps/quick-notes/src/lib/features/notes/NotesTab.svelte`
  - `apps/quick-notes/src/lib/features/notes/NotesSidebarDrawer.svelte`
  - `apps/quick-notes/src/lib/core/i18n/zh.ts`
  - `apps/quick-notes/src/lib/core/i18n/en.ts`
  - This micro spec, for validation notes
- Files not expected to change:
  - `apps/quick-notes/src-tauri/**`
  - `apps/quick-notes/src/lib/core/quick-notes-types.ts`
  - `apps/quick-notes/src/lib/core/data-sync/**`
- Key risks:
  - 小屏同时存在便签列表抽屉和大纲抽屉，需要避免按钮语义混淆。
  - 复用 `NotesSidebar` 到抽屉时，选择/新增后应关闭抽屉，但大屏行为不能受影响。
  - 图标按钮必须有 `aria-label`，保持键盘可访问。
- Approval: Approved by user ("开始执行").

## Validation

- `pnpm --filter quick-notes check`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`
- `pnpm --filter quick-notes build`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`; Vite production build completed.
  - Notes: Build output still reports the existing large chunk warning. It also reports the existing Svelte warning in `src/lib/core/i18n/store.svelte.js` about `locale` initial value capture; this file was not part of the current change.
- 2026-07-13 outline button visibility fix:
  - Issue: When the right outline panel was hidden by breakpoint, the outline icon button was still not visible.
  - Fix: Moved the outline icon button out of the Crepe editor wrapper and positioned it from the editor body container, above the editor layer.
  - Validation: `pnpm --filter quick-notes check` passed with `svelte-check found 0 errors and 0 warnings`.

## Resume / Handoff

- 当前核心目标已完成：
  - 小屏大纲入口已改为编辑器 body 右上角图标按钮。
  - 当前便签 Markdown 导出按钮已改为主按钮，文案为「导出文件」。
  - 设置数据区文案已改为「数据迁移」「导出到本地」「从本地还原」。
  - 小屏便签列表已支持左侧抽屉，大屏仍保留常驻侧栏。
- 剩余建议：在桌面应用中人工 smoke test 小屏宽度下的便签列表抽屉、大纲抽屉、导出文件主按钮和设置数据迁移文案。
