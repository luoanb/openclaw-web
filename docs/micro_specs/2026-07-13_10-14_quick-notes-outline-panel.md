# Micro Spec: quick-notes note outline panel

## Goal

为 `apps/quick-notes` 的速记编辑器设计并实现一个大纲展示面板，用于展示当前速记正文中的标题层级，帮助用户在长 Markdown 速记中快速浏览和跳转。

## Context

- 当前速记页由 `NotesTab.svelte` 组织：左侧 `NotesSidebar`，右侧 `NoteEditor`。
- 当前 `NoteEditor.svelte` 内部结构是：顶部标题/action bar、可选反馈条、编辑器 body。
- 当前 `NoteEditor.svelte` 已接入 Milkdown Crepe，`draft` 由 `markdownUpdated` 事件实时同步，`getEditorContent()` 可读取当前 Markdown。
- Crepe / Milkdown 没有直接提供可见的大纲面板；Milkdown 工具层有 outline 能力，但当前 quick-notes 尚未暴露 editor ctx 到 Svelte UI。
- 产品 register 是 workbench/product：界面应保持克制、密集、可检查；大纲是辅助导航，不应抢占正文编辑注意力。
- 设计约束来自 `DESIGN.md` 与 `docs/design/BitsUI.md`：使用语义 token、正文小字号、Bits UI 风格控件；小屏抽屉优先复用 Dialog/overlay 语义，而不是自造不可访问浮层。

## UX / Layout Design

### 大屏：编辑 body 右侧分屏

- 放置位置：在 `NoteEditor` 的编辑 body 内部右侧，而不是 `NotesTab` 根级右侧。
- 结构：`editor body = editor area + outline aside`。
- 建议断点：`xl` 及以上显示右侧分屏，避免在已有左侧速记列表的情况下过早挤压编辑器。
- 面板宽度：约 `14rem` 到 `16rem`，固定宽度，编辑器区域 `min-w-0 flex-1`。
- 视觉：右侧面板使用 `border-l` 或独立 `rounded-lg border bg-card`，保持轻量；不使用重阴影、渐变、装饰色条。
- 字体：标题项使用正文小字号，默认 `text-xs/relaxed`；元信息和空状态用 `text-muted-foreground`。
- 信息结构：
  - 面板头：`大纲`，右侧可显示标题数量。
  - 内容：按 H1-H6 展示缩进层级。
  - 空状态：`暂无标题` / `使用 #、## 添加标题后会显示在这里`。

### 小屏：右侧抽屉

- 小于大屏断点时隐藏常驻分屏，改为在编辑器顶部 action 区提供 `大纲` 按钮。
- 点击后从右侧打开抽屉，抽屉展示同一份 outline 内容。
- 抽屉宽度：移动端 `min(85vw, 20rem)`；高度占满可视高度。
- 抽屉应支持：
  - Esc 关闭。
  - 点击遮罩关闭。
  - 选择某个标题后关闭抽屉并滚动到目标标题。
  - 焦点可见，键盘可操作。
- 实现优先级：
  - 若 `apps/quick-notes` 后续已有 Dialog/Sheet UI wrapper，复用 wrapper。
  - 若没有，使用 `bits-ui` Dialog primitive 在局部实现抽屉语义，样式使用现有 token。

## Data / Behavior

- 大纲数据来源：第一版优先从 `draft` Markdown 中提取 ATX 标题（`#` 到 `######`）。
- 数据结构建议：
  - `id: string`
  - `text: string`
  - `level: 1 | 2 | 3 | 4 | 5 | 6`
  - `index: number`
- 标题文本处理：
  - 去除开头 `#` 与首尾空白。
  - 去除尾部闭合 `#`。
  - 空标题不展示。
- 更新时机：
  - `draft` 变化时同步派生 outline。
  - 切换速记或进入新增态时随 `draft` 清空或重建。
- 点击跳转：
  - 第一版按 outline 顺序匹配 `.quick-note-crepe-editor .ProseMirror h1,h2,h3,h4,h5,h6`。
  - 找到对应 DOM 后调用 `scrollIntoView({ block: "start" })`。
  - 不把 heading id 写入 Markdown 内容，避免污染用户正文。

## Boundary

- In:
  - 当前速记的标题大纲展示。
  - 大屏右侧分屏。
  - 小屏右侧抽屉。
  - 点击大纲项滚动到对应标题。
  - 空状态、键盘可访问和焦点可见。
- Out:
  - 不改 `QuickNote` 数据结构。
  - 不把自动生成的 heading id 写回 Markdown。
  - 不做跨速记全局大纲。
  - 不做拖拽重排标题。
  - 不做当前滚动位置高亮（可作为后续增强）。
  - 不新增 Markdown 解析依赖，除非实现阶段发现 ATX 提取不足以满足 Crepe 输出。

## Minimal Technical Plan

1. 新增纯 TS outline 提取逻辑，建议放在 `apps/quick-notes/src/lib/core/notes/`，用类封装以符合仓库 `core` 编码偏好。
2. 新增 `NoteOutlinePanel.svelte`，负责渲染面板头、空状态、标题层级列表和点击事件。
3. 必要时新增 `NoteOutlineDrawer.svelte`，使用 Bits UI Dialog primitive 或项目已有 Dialog wrapper 承载小屏抽屉。
4. 修改 `NoteEditor.svelte`：
   - 从 `draft` 派生 outline items。
   - 在大屏编辑 body 右侧渲染 `NoteOutlinePanel`。
   - 在小屏 action bar 增加 `大纲` 按钮并控制抽屉开关。
   - 实现按 heading 序号滚动。
5. 补齐中文/英文 i18n 文案。
6. 运行 `pnpm --filter quick-notes check`；通过后运行 `pnpm --filter quick-notes build`。

## Done Contract

- 大屏下，速记编辑 body 右侧可见当前文档标题大纲。
- 小屏下，用户可通过 `大纲` 按钮打开右侧抽屉查看同一份大纲。
- 大纲项使用正文小字号，层级通过缩进和 muted 文本表达，不使用装饰性色条。
- 当前文档无标题时展示轻量空状态。
- 点击大纲项可滚动到对应标题，不修改 Markdown 内容。
- `pnpm --filter quick-notes check` 通过。
- `pnpm --filter quick-notes build` 通过，或记录非代码原因与剩余风险。

## Execution Checkpoint

- Files likely to change:
  - `apps/quick-notes/src/lib/features/notes/NoteEditor.svelte`
  - `apps/quick-notes/src/lib/features/notes/NoteOutlinePanel.svelte`
  - `apps/quick-notes/src/lib/features/notes/NoteOutlineDrawer.svelte`（如需要）
  - `apps/quick-notes/src/lib/core/notes/note-outline-service.ts`
  - `apps/quick-notes/src/lib/core/i18n/zh.ts`
  - `apps/quick-notes/src/lib/core/i18n/en.ts`
  - This micro spec, for completion notes after validation
- Files not expected to change:
  - `apps/quick-notes/src-tauri/**`
  - `apps/quick-notes/src/lib/core/quick-notes-types.ts`
  - `docs/specs/quick-notes-tauri-json.md`
- Key risk:
  - 右侧分屏会减少编辑器宽度，需要在常见桌面宽度下手动验证。
  - Crepe 内部 heading DOM 顺序若与 Markdown 提取顺序不一致，点击跳转可能偏移。
  - 小屏抽屉若直接用 Dialog primitive，需要确保焦点管理和关闭行为完整。
- Approval: Approved by user ("开始执行").

## Validation

- `pnpm --filter quick-notes check`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`
- `pnpm --filter quick-notes build`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`; Vite production build completed.
  - Notes: Build output still reports the existing large chunk warning. It also reports the existing Svelte warning in `src/lib/core/i18n/store.svelte.js` about `locale` initial value capture; this file was not part of the outline change.
- 2026-07-13 drawer layout fix:
  - Issue: In drawer mode, the outline item count overlapped with the absolute close button.
  - Fix: Added an explicit `headerInsetEnd` option to `NoteOutlinePanel` and enabled it only from `NoteOutlineDrawer`.
  - Validation: `pnpm --filter quick-notes check` passed with `svelte-check found 0 errors and 0 warnings`.
- 2026-07-13 heading scroll offset fix:
  - Issue: Clicking an outline item scrolled the target heading under the Crepe top bar.
  - Fix: Added `scroll-margin-top: 56px` to editor heading styles (`h1` through `h6`) so native `scrollIntoView()` lands below the toolbar.
  - Validation: `pnpm --filter quick-notes check` passed with `svelte-check found 0 errors and 0 warnings`.

## Resume / Handoff

- 当前核心目标已完成：速记编辑器新增大纲面板，大屏在编辑 body 右侧分屏展示，小屏通过 `大纲` 按钮打开右侧抽屉。
- 大纲数据由 `NoteOutlineService` 从当前 Markdown `draft` 中提取 H1-H6，不修改用户正文。
- 点击大纲项会按标题顺序滚动到 Crepe 编辑器内对应 heading；滚动行为尊重 `prefers-reduced-motion`。
- 抽屉形态下，大纲头部右侧已为关闭按钮预留空间，避免数量文本与关闭按钮重叠。
- 标题样式已设置滚动偏移，避免大纲跳转后标题被 Crepe 顶部工具栏遮挡。
- 剩余建议：在桌面应用中人工 smoke test 不同窗口宽度下的大纲显示、抽屉关闭、标题跳转和长标题截断。
