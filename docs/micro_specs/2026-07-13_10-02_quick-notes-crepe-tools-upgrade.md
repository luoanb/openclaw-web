# Micro Spec: quick-notes Crepe tools upgrade

## Goal

在 `apps/quick-notes` 的速记编辑器中升级 Milkdown Crepe 到当前最新版本，并显式开启用户指定的 Crepe 内置编辑工具：

- `TopBar` 顶部工具栏
- `Toolbar` 选区浮动工具栏
- `BlockEdit` 块操作 / 斜杠菜单
- `Table` 表格
- `Latex` 公式
- `CodeMirror` 代码块增强
- `LinkTooltip` 链接浮层
- `ListItem` 列表 / 任务列表

## Context

- 当前 `apps/quick-notes/package.json` 使用 `@milkdown/crepe: ^7.21.2`。
- 2026-07-13 查询 npm，`@milkdown/crepe` 最新版本为 `7.21.3`。
- 当前 `NoteEditor.svelte` 使用 `new Crepe({ root, defaultValue, features, featureConfigs })` 初始化编辑器。
- 当前代码已显式关闭 `Crepe.Feature.ImageBlock` 与 `Crepe.Feature.AI`。
- Crepe 默认大多内置功能已开启，但 `TopBar` 默认关闭；本次为了可维护性，将用户指定功能显式声明为开启。

## Boundary

- In:
  - 将 `@milkdown/crepe` 更新到 `7.21.3`。
  - 更新 lockfile 中对应依赖版本。
  - 在 `NoteEditor.svelte` 的 `features` 中显式开启用户指定的 Crepe 内置工具。
  - 保持 `QuickNote.content` 仍为 Markdown 字符串，不改变数据结构。
  - 保持现有自动保存、复制、导出、切换速记等数据流不变。
- Out:
  - 不启用 AI provider，不接入 API key 或后端 AI 服务。
  - 不启用图片上传、附件存储、云端资源代理或本地图片持久化。
  - 不引入 `svelte5-milkdown-editor` 等社区封装。
  - 不改 Tauri JSON 数据契约。
  - 不做自定义 Crepe 插件或自定义工具按钮。

## Minimal Plan

1. 用 pnpm 更新 `apps/quick-notes` 的 `@milkdown/crepe` 到 `7.21.3`，同步更新 lockfile。
2. 在 `NoteEditor.svelte` 中显式配置：
   - `TopBar: true`
   - `Toolbar: true`
   - `BlockEdit: true`
   - `Table: true`
   - `Latex: true`
   - `CodeMirror: true`
   - `LinkTooltip: true`
   - `ListItem: true`
3. 继续保留：
   - `ImageBlock: false`
   - `AI: false`
4. 若 `TopBar` 引入额外高度或滚动问题，只做 `NoteEditor.svelte` 作用域内的最小样式适配。
5. 运行 `pnpm --filter quick-notes check`；若通过，再运行 `pnpm --filter quick-notes build`。

## Done Contract

- `apps/quick-notes` 依赖声明与 lockfile 使用 `@milkdown/crepe@7.21.3`。
- 速记编辑器显式开启用户指定的 8 项 Crepe 内置工具。
- 图片块和 AI 仍保持关闭，符合本地 Markdown 与无 provider 的当前边界。
- `pnpm --filter quick-notes check` 通过。
- `pnpm --filter quick-notes build` 通过，或记录非代码原因与剩余风险。

## Execution Checkpoint

- Files likely to change:
  - `apps/quick-notes/package.json`
  - `pnpm-lock.yaml`
  - `apps/quick-notes/src/lib/features/notes/NoteEditor.svelte`
  - This micro spec, for completion notes after validation
- Files not expected to change:
  - `apps/quick-notes/src-tauri/**`
  - `apps/quick-notes/src/lib/core/quick-notes-types.ts`
  - `docs/specs/quick-notes-tauri-json.md`
- Key risk:
  - `TopBar` 可能改变编辑器可视高度或造成内部滚动区域拥挤，需要人工确认桌面端交互。
  - Crepe patch upgrade 可能带来默认 UI 细节变化，需要通过 check/build 与人工 smoke test 兜底。
- Approval: Approved by user ("执行吧").

## Validation

- `pnpm --filter quick-notes check`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`
- `pnpm --filter quick-notes build`
  - Result: passed
  - Evidence: `svelte-check found 0 errors and 0 warnings`; Vite production build completed.
  - Notes: Build output still reports the existing large chunk warning. It also reports a Svelte warning in `src/lib/core/i18n/store.svelte.js` about `locale` initial value capture; this file was not part of the current Crepe change.

## Resume / Handoff

- 当前核心目标已完成：`@milkdown/crepe` 已更新到 `^7.21.3`，用户指定的 8 项 Crepe 内置工具已在 `NoteEditor.svelte` 中显式开启。
- `ImageBlock` 与 `AI` 仍保持关闭，未引入图片持久化或 AI provider。
- 剩余建议：在桌面应用中人工 smoke test 速记编辑器，重点确认 `TopBar` 高度、块操作菜单、表格、公式与代码块编辑体验符合预期。
