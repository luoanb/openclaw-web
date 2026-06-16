# Editor Lifecycle & Display Fixes / 编辑器生命周期与显示修复

## Context / 背景

- 目标应用：`apps/quick-notes`
- 触发时间：2026-06-16 20:40~21:04
- 触发问题：
  - 新建速记后，自动保存触发瞬间编辑器刷新，光标丢失，打断输入体验。
  - 时间显示为原始 ISO 字符串（如 `2026-06-16T12:34:56.789Z`），可读性差。
  - 侧栏每条笔记同时显示 title（第一行）和 summary（第一行截断），内容重复。

## Diagnosis / 诊断

### 光标丢失

- `NoteEditor.svelte` 使用 `{#key editorKey}` 控制编辑器容器生命周期，`editorKey = $derived(creating ? "new" : note?.id)`。
- 新建笔记流程：用户点击"新增"→`editorKey="new"`→Milkdown 编辑器创建→自动保存触发→`onCreateNote`→`creating=false`，`note` 被赋值→`editorKey` 从 `"new"` 变为 `note.id`→`{#key}` 销毁旧 div、创建新 div→Milkdown 编辑器重建→ProseMirror 内部状态丢失→光标丢失。
- 深层次原因：Svelte 5 的 `$effect` 会自动跟踪函数体内所有响应式读取（包括 `note`、`creating`、`editorKey`），无法通过添加额外依赖来切分生命周期。编辑器创建和业务数据更新在同一个响应式作用域中耦合。

### 时间格式

- `updatedAt` / `createdAt` 存储为 ISO 8601 字符串（如 `2026-06-16T12:34:56.789Z`），直接渲染到 UI，用户不可读。

### 侧栏冗余信息

- `NotesSidebar` 同时显示 `getNoteTitle`（正文第一行）和 `getNoteSummary`（正文第一行取前 72 字符），短文本时完全重复。

## Fix Plan / 修复方案

### 1. 编辑器生命周期解耦（光标丢失修复）

**思路**：将"编辑器应何时销毁重建"和"业务数据变化"的响应式追踪分离。

**实现**：

- `NotesTab.svelte` 新增 `editorViewKey` state，仅用户主动操作时递增：
  - `startCreating()`（点"新增"）→ `editorViewKey++`
  - `selectNote()`（点侧栏笔记）→ `editorViewKey++`
  - `createNote()`（自动保存回调）→ 不递增
- `NoteEditor.svelte`：
  - 接收 `viewKey` prop，`{#key viewKey}` 控制编辑器容器 DOM 生命周期
  - `$effect` 仅追踪 `viewKey` + `editorRoot`
  - 所有 `note` / `creating` / `editorKey` 读取包在 `svelte/untrack()` 中，不触发 Svelte 5 自动追踪
  - 第二个 `$effect` 追踪 `creating` / `note` 变化，仅更新 `autoSaver.markCommitted()`，不重建编辑器

**关键文件：**

- `src/lib/features/notes/NotesTab.svelte`
- `src/lib/features/notes/NoteEditor.svelte`

### 2. 时间格式化工具

- `src/lib/utils.ts` 新增 `formatDateTime(iso: string): string`
- 格式：`YYYY-MM-DD HH:mm`（中划线日期 + 冒号时间）
- 处理 ISO 字符串解析、时区转换、异常回退
- 替换 `NotesSidebar`、`TaskRow`、`NoteEditor` 中所有原始 ISO 时间显示

**使用位置：**

| 文件 | 修改 |
|---|---|
| `src/lib/features/notes/NotesSidebar.svelte` | `note.updatedAt` → `formatDateTime(note.updatedAt)` |
| `src/lib/features/tasks/TaskRow.svelte` | 完成/更新时间 → `formatDateTime(...)` |
| `src/lib/features/notes/NoteEditor.svelte` | 编辑器更新时间 → `formatDateTime(note.updatedAt)` |

### 3. 侧栏冗余信息移除

- `NotesSidebar.svelte`：移除 `getNoteSummary` 摘要行（与 title 重复）
- 清理 `NotesTab.svelte`、`App.svelte` 中 `getNoteSummary` 的 prop 传递

## Validation / 验证

- [x] 新建笔记，输入内容，等待 3 秒自动保存→光标保持在输入位置，不跳转
- [x] 点击侧栏不同笔记→编辑器内容切换到对应笔记
- [x] 点击"新增"→编辑器清空为空白状态
- [x] 时间显示格式为 `2026-06-16 12:34` 而非原始 ISO 字符串
- [x] 侧栏每条笔记只显示 title 行，不再有 summary 重复

## Result / 结果

- **光标丢失修复**：编辑器实例在 auto-save 创建→保存转换中保持存活，ProseMirror 内部状态和光标位置不丢失。
- **时间格式化**：所有用户可见时间位置统一使用 `formatDateTime`，中划线日期 + 冒号时间格式。
- **侧栏简洁化**：每条笔记仅显示标题行 + 时间戳，去除冗余摘要。

### 涉及的提交文件

```
M  src/lib/utils.ts                          # +formatDateTime
M  src/lib/features/notes/NoteEditor.svelte   # +viewKey / untrack / formatDateTime
M  src/lib/features/notes/NotesSidebar.svelte # -summary / +formatDateTime
M  src/lib/features/notes/NotesTab.svelte     # +editorViewKey / -getNoteSummary
M  src/lib/features/tasks/TaskRow.svelte      # +formatDateTime
M  src/App.svelte                             # -getNoteSummary prop
```

### 剩余注意

- 侧栏笔记渲染仍会在 auto-save 更新 store 时重新排序（按 `updatedAt` 降序），导致笔记列表轻微跳动。如后续需要优化，可考虑：
  - 使用动画过渡（`flip`）平滑列表位置变化
  - 在 auto-save 后延迟侧栏排序更新
