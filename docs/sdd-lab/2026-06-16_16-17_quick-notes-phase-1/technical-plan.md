# Technical Plan / 技术方案: quick-notes phase 1

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-06-16_16-17_quick-notes-phase-1/requirements.md`
- 需求确认状态：用户已确认“先这样编写技术方案”，进入技术方案阶段。
- 本方案覆盖范围：`quick-notes` 第一阶段业务实现方案，覆盖 Header Tab、当前 Tab 搜索、任务进行中/已完成、速记 sidebar + content、本地 JSON 读写、轻量错误反馈。
- 本方案不覆盖：账号、云同步、富文本、复杂标签、高级筛选、跨 Tab 全局搜索、提醒通知、系统托盘、快捷键、导入导出、多窗口冲突处理。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `docs/sdd-lab/2026-06-16_16-17_quick-notes-phase-1/requirements.md`
  - `docs/specs/quick-notes-tauri-json.md`
  - `apps/quick-notes/package.json`
  - `apps/quick-notes/src/App.svelte`
  - `apps/quick-notes/src/app.css`
  - `apps/quick-notes/src-tauri/src/lib.rs`
  - `apps/quick-notes/src/lib/components/ui/collapsible/*`
  - `apps/quick-notes/src/lib/utils.ts`
- 当前实现事实：
  - `apps/quick-notes` 已完成 Tauri v2 + Svelte 5 + Vite + TypeScript + Tailwind CSS 4 框架初始化。
  - 当前 `App.svelte` 是脚手架验证页，采用居中卡片布局，尚未实现业务页面。
  - 当前前端已有 Collapsible UI 封装，可用于已完成任务折叠区。
  - 当前 Tauri 后端 `lib.rs` 只启动默认 Builder，尚未注册 `load_store` / `save_store` 命令。
  - 当前 `app.css` 已提供语义化 Tailwind token、Inter 字体、满窗体基础尺寸和 `overflow: hidden`。
- 相关接口/数据结构：
  - `TaskStatus = "active" | "done"`
  - `QuickTask = { id, content, status, createdAt, updatedAt, completedAt? }`
  - `QuickNote = { id, content, createdAt, updatedAt }`
  - `QuickNotesStore = { tasks, notes }`
  - Tauri 命令：`load_store(): QuickNotesStore`、`save_store(store): QuickNotesStore`
- 约束与风险：
  - 数据模型和写入策略以 `docs/specs/quick-notes-tauri-json.md` 为准。
  - 可复用逻辑应放入 `core` 并优先用类封装，避免视图组件直接拼业务更新逻辑。
  - 前端组件需保持视图与逻辑分离：组件接收数据和事件，业务更新集中在 store/service 层。
  - 首期本地 JSON 不做 schema migration 和多窗口冲突处理。

## Open Questions / 开放问题

- [x] Q1 是否需要新增依赖来管理状态或生成 ID？
  - 触发来源：方案拟定
  - 影响范围：前端 store、构建依赖
  - 候选处理：A. 使用 Svelte 5 `$state` + `crypto.randomUUID()`；B. 引入状态库或 ID 库。
  - 用户回答/确认：未单独询问；按最小依赖原则采用 A。
  - 状态：已关闭
- [x] Q2 当前 Tab 搜索是否写入本地持久化？
  - 触发来源：需求
  - 影响范围：前端状态、数据模型
  - 候选处理：A. 仅视图过滤，不保存；B. 保存每个 Tab 搜索词。
  - 用户回答/确认：需求要求“搜索针对当前 Tab，可以对内容进行模糊过滤”，未要求记忆搜索。
  - 状态：已关闭，采用 A。

## Solution Options / 方案候选

### Option A / 方案 A：单一业务服务 + 分域视图组件

- 推荐：否
- 方案摘要：以 `QuickNotesService` 作为前端核心业务服务，集中封装数据类型、默认值、排序、过滤、不可变更新、保存/读取适配；`features/tasks` 与 `features/notes` 只承载对应 Tab 的 UI 与事件转发；`App.svelte` 只负责应用壳、加载状态、Tab、搜索和组合。
- 涉及模块：`src/lib/core`、`src/lib/features/tasks`、`src/lib/features/notes`、`src/lib/components/ui`、`src/App.svelte`、`src-tauri/src/lib.rs`
- 优点：
  - 逻辑和视图边界清晰，组件不直接修改底层 store 结构。
  - 首期数据规模小，一个服务足够集中处理保存、排序、过滤与错误。
  - 后续若增加导入导出或 schema migration，可从 `core` 扩展。
- 缺点：
  - 单个 service 需要保持方法命名清晰，避免演变成过大的万能类。
  - 任务与速记已经在交互上独立管理，单一 service 会弱化领域边界。
- 风险：
  - 若 UI 组件直接绕过 service 修改数组，会破坏分层约束，需要在执行时严格按接口调用。

### Option B / 方案 B：任务服务与速记服务完全拆分

- 推荐：是
- 方案摘要：分别创建 `TaskService` 和 `NoteService`，各自封装排序、过滤、创建、编辑、删除与派生展示逻辑；`App.svelte` 或轻量协调层负责把任务和速记组合为 `QuickNotesStore` 后统一保存。
- 涉及模块：`src/lib/core/tasks`、`src/lib/core/notes`、`src/lib/core/quick-notes-repository.ts`、`src/lib/features/*`
- 优点：
  - 与需求中的“任务 / 速记两个 Tab 独立管理”一致，领域边界清晰。
  - 任务独有 `active/done/completedAt`，速记独有标题/摘要派生，拆分后更容易测试和维护。
  - 未来任务和速记分别扩展时，互相影响更小。
- 缺点：
  - 首期仍需整体保存 `QuickNotesStore`，拆分服务会增加同步和组合成本。
  - 需要明确由上层协调整体保存，避免两个服务分别持久化。
- 风险：
  - 保存时可能出现任务、速记分别更新但整体状态组装不一致。
  - 需要避免 `TaskService` 或 `NoteService` 直接调用 Tauri repository，否则会破坏统一保存边界。

## Decision / 方案决策

- Selected / 选定方案：Option B，任务服务与速记服务完全拆分。
- Why / 选择原因：用户明确选择方案 B；该方案与 Header Tab 独立管理的产品结构一致，能把任务状态流转和速记标题/摘要派生分别放入独立 core 服务，进一步保证逻辑与视图分离。
- Decision Owner / 决策人：user
- Decision Time / 决策时间：2026-06-16 16:51
- Open Questions 状态：全部关闭。

## Architecture / 技术分层

```text
apps/quick-notes/src/
  App.svelte                         # 应用壳：加载、Tab、搜索、布局组合
  lib/
    core/
      quick-notes-types.ts           # 纯类型：QuickTask、QuickNote、QuickNotesStore
      quick-notes-repository.ts      # Tauri invoke 适配：load/save
      quick-notes-store.ts           # 整体 store 组合、默认值、normalize
      tasks/
        task-service.ts              # 任务逻辑类：排序、过滤、增删改、完成/恢复
      notes/
        note-service.ts              # 速记逻辑类：排序、过滤、增删改、标题/摘要派生
    features/
      tasks/
        TasksTab.svelte              # 任务 Tab 容器视图
        TaskComposer.svelte          # 新增任务输入
        TaskList.svelte              # 进行中任务列表
        CompletedTasks.svelte        # 已完成折叠区
        TaskRow.svelte               # 单行任务视图
      notes/
        NotesTab.svelte              # 速记 Tab 容器视图
        NotesSidebar.svelte          # 左侧标题/摘要列表
        NoteEditor.svelte            # 右侧正文编辑区
    components/
      ui/
        collapsible/                 # 现有封装，复用
        tabs/                        # 如执行时需要，按 Bits UI / shadcn-svelte 风格补齐
```

分层规则：

- `core` 不引用 Svelte 组件，不操作 DOM，只处理数据、命令适配和业务不变量。
- `TaskService` 只处理 `tasks` 集合，不读取或修改 `notes`。
- `NoteService` 只处理 `notes` 集合，不读取或修改 `tasks`。
- `quick-notes-store.ts` 只负责 `QuickNotesStore` 默认值、normalize、组合保存前的整体结构整理，不承载任务/速记领域规则。
- `features/tasks` 和 `features/notes` 不直接调用 Tauri `invoke`，只通过上层传入的数据和事件工作。
- `App.svelte` 持有页面级运行状态：`activeTab`、`searchQuery`、`loadState`、`saveError`、当前 `QuickNotesStore`。
- 视图组件只做渲染、输入收集和事件派发，不直接实现排序、过滤、完成/恢复等业务规则。
- 保存采用“前端内存先更新，再调用 repository 保存；失败时保留内存状态并展示轻量错误”的乐观路径。

## Backend Design / Tauri 后端设计

- 在 `src-tauri/src/lib.rs` 中注册两个 command：
  - `load_store() -> Result<QuickNotesStore, String>`
  - `save_store(store: QuickNotesStore) -> Result<QuickNotesStore, String>`
- Rust 数据结构使用 `serde::{Serialize, Deserialize}`：
  - `QuickTask`
  - `QuickNote`
  - `QuickNotesStore`
- 数据路径：
  - 使用 Tauri `AppHandle` 获取应用数据目录。
  - 文件名固定为 `quick-notes.json`。
  - 文件不存在时返回 `{ tasks: [], notes: [] }`。
- 写入策略：
  - 确保应用数据目录存在。
  - 先写 `quick-notes.json.tmp`。
  - 再重命名为 `quick-notes.json`。
  - JSON 使用 pretty 格式。
- 校验策略：
  - `content` 不接受空字符串或纯空白。
  - `status` 仅允许 `active` / `done`。
  - `done` 任务允许有 `completedAt`；恢复后的 `active` 任务应无 `completedAt` 或为 `null`。
- 错误策略：
  - 读取失败或反序列化失败返回可读错误。
  - 写入失败返回可读错误，前端保留当前内存状态。

## Frontend Core Design / 前端核心逻辑设计

### `QuickNotesStoreService`

职责：

- `createEmptyStore()`：返回空数据。
- `normalizeStore(store)`：规范化后端返回数据，保证数组存在。
- `withTasks(store, tasks)`：返回替换任务集合后的 `QuickNotesStore`。
- `withNotes(store, notes)`：返回替换速记集合后的 `QuickNotesStore`。
- `prepareForSave(store)`：保存前整理整体结构，不改写领域规则。

边界：

- 不处理任务完成/恢复。
- 不处理速记标题/摘要。
- 不做搜索过滤。
- 不调用 Tauri repository。

### `TaskService`

职责：

- `createTask(tasks, content, now)`：trim 后新增 `active` 任务。
- `updateTaskContent(tasks, taskId, content, now)`：编辑任务内容，空内容不提交。
- `completeTask(tasks, taskId, now)`：设置 `status = "done"`、`completedAt = now`、`updatedAt = now`。
- `restoreTask(tasks, taskId, now)`：设置 `status = "active"`、清空 `completedAt`、更新 `updatedAt`。
- `deleteTask(tasks, taskId)`：删除任务。
- `getActiveTasks(tasks, query)`：按 `updatedAt` 倒序，按当前 query 模糊过滤。
- `getDoneTasks(tasks, query)`：按 `completedAt` 倒序，按当前 query 模糊过滤。

边界：

- 只接收和返回 `QuickTask[]`。
- 不读取或修改 `notes`。
- 不调用 Tauri repository。

### `NoteService`

职责：

- `createNote(notes, content, now)`：trim 后新增速记。
- `updateNoteContent(notes, noteId, content, now)`：编辑速记正文。
- `deleteNote(notes, noteId)`：删除速记。
- `getNotes(notes, query)`：按 `updatedAt` 倒序，按正文或摘要模糊过滤。
- `getNoteTitle(note)`：取正文第一行 trim 后作为标题。
- `getNoteSummary(note)`：取正文第一行或截断后的摘要。
- `pickNextNoteId(notes, deletedNoteId)`：删除当前速记后选择下一条可用速记。

边界：

- 只接收和返回 `QuickNote[]`。
- 不读取或修改 `tasks`。
- 不调用 Tauri repository。

实现约束：

- `QuickNotesStoreService` 返回新的 `QuickNotesStore`，不原地 mutate 输入对象。
- `TaskService` 和 `NoteService` 内部方法返回新的数组，不原地 mutate 输入数组。
- 时间由调用方传入 ISO 字符串，便于后续测试。
- ID 使用 `crypto.randomUUID()`；如运行环境不支持，执行时再补最小 fallback。
- 模糊过滤首期采用大小写不敏感的 `includes`，不引入第三方搜索库。

### `QuickNotesRepository`

职责：

- 封装 `@tauri-apps/api/core` 的 `invoke`。
- 暴露 `loadStore()` 和 `saveStore(store)`。
- 将底层错误转为前端可展示的 `Error`。

边界：

- repository 不处理排序、过滤、标题摘要和任务状态流转。
- 业务组件不直接调用 repository。

## Component Design / 组件设计

- 对应视觉设计文档：无，本迭代未提供 Figma 页面稿；实现时按 `docs/design/BitsUI.md` 和现有 Tailwind token 控制组件风格。
- 组件拆分：
  - `App.svelte`：满窗体应用壳，Header、Tabs、当前 Tab 搜索、加载/读取失败状态、保存错误提示。
  - `TasksTab.svelte`：接收任务列表、已完成列表、搜索结果和事件回调。
  - `TaskComposer.svelte`：任务新增输入，只派发新增事件。
  - `TaskList.svelte` / `TaskRow.svelte`：展示任务行和 inline action。
  - `CompletedTasks.svelte`：复用 Collapsible，默认折叠，不持久化展开状态。
  - `NotesTab.svelte`：组合左侧列表与右侧编辑区。
  - `NotesSidebar.svelte`：展示标题、摘要、更新时间、选中态和删除入口。
  - `NoteEditor.svelte`：编辑当前速记正文，不让用户单独输入标题。
- 复用现有组件：
  - `src/lib/components/ui/collapsible/*` 用于已完成区。
  - `src/lib/utils.ts` 中已有工具如 `cn()` 可继续复用。
- 新增 / 调整组件：
  - 如 `quick-notes` 缺 Tabs/Button/Textarea/Input/Checkbox 等基础组件，可从 `apps/web-claw/src/lib/components/ui` 复制对应组件到 `apps/quick-notes/src/lib/components/ui` 后再按本应用依赖和 import 路径做最小适配。
  - 复制组件时只引入本迭代实际需要的目录，避免一次性复制完整 UI 库造成无关代码膨胀。
- Props / Events / Slots：
  - 任务组件通过 `onCreateTask`、`onUpdateTask`、`onCompleteTask`、`onRestoreTask`、`onDeleteTask` 等回调向上派发。
  - 速记组件通过 `onCreateNote`、`onSelectNote`、`onUpdateNote`、`onDeleteNote` 向上派发。
  - 搜索 query 由 `App.svelte` 持有，传入当前 Tab 对应的过滤方法。
- 状态与交互：
  - 默认 activeTab 为 `tasks`。
  - 搜索只作用于当前 Tab；切换 Tab 后可清空 query，避免旧 query 影响另一个 Tab。
  - 速记删除当前项后，选择排序后的下一条；无可选项时显示空编辑态。
  - 正常保存静默；保存失败在主内容区域展示轻量错误与“重试保存”。
- 样式与 Token 实现：
  - 使用 `bg-background`、`text-foreground`、`text-muted-foreground`、`border-border`、`bg-card` 等语义 token。
  - 内容铺满 `h-dvh w-dvw`，Header 固定在顶部，主区域 `min-h-0 flex-1`。
  - 避免重阴影、玻璃、渐变文字和装饰性边条。
- Icon / SVG 组件使用：
  - 首期可使用文本 action；若添加图标，优先用现有依赖或内联简洁 SVG，保持 `currentColor`。
- 已知设计偏差：
  - 当前无 Figma 页面稿，最终视觉以技术方案和 `docs/design/BitsUI.md` 的控件风格为准。

## State And Data Flow / 状态与数据流

```text
Tauri JSON file
  -> load_store()
  -> QuickNotesRepository.loadStore()
  -> App.svelte page state
  -> TaskService / NoteService derives filtered/sorted views
  -> feature components render current tab
  -> user event
  -> TaskService or NoteService returns next tasks/notes array
  -> QuickNotesStoreService combines next QuickNotesStore
  -> App.svelte updates memory state
  -> QuickNotesRepository.saveStore(nextStore)
  -> success: keep quiet
  -> failure: keep memory state + show retry
```

保存失败重试：

- `App.svelte` 保存最近一次需要持久化的 `pendingStore`。
- 点击“重试保存”时再次调用 `saveStore(pendingStore)`。
- 如果用户在失败后继续操作，新的操作生成新的 `pendingStore`，后续保存以最新内存状态为准。

## Impacted Areas / 影响范围

- 文件/模块：
  - `apps/quick-notes/src/App.svelte`
  - `apps/quick-notes/src/lib/core/*`
  - `apps/quick-notes/src/lib/features/tasks/*`
  - `apps/quick-notes/src/lib/features/notes/*`
  - `apps/quick-notes/src/lib/components/ui/*`（按需）
  - `apps/quick-notes/src-tauri/src/lib.rs`
  - `apps/quick-notes/src-tauri/Cargo.toml`
- 接口/类型：
  - 前端和 Rust 后端需保持 `QuickTask` / `QuickNote` / `QuickNotesStore` 字段一致。
  - Tauri 命令名固定为 `load_store`、`save_store`。
- 数据/状态：
  - 本地数据文件 `quick-notes.json`。
  - 前端内存 store、activeTab、searchQuery、selectedNoteId、load error、save error。
- UI/交互：
  - 替换脚手架居中卡片为满窗体业务工作区。
  - Header Tabs、任务 Tab、速记 Tab、当前 Tab 搜索。
- 测试：
  - 核心 service 单元测试优先覆盖排序、过滤、状态流转、标题摘要。
  - Svelte/Vite 层至少跑 `check` 和 `build`。

## Execution Steps / 执行步骤

1. 新增前端核心类型、`QuickNotesStoreService`、`TaskService` 与 `NoteService`，覆盖默认值、整体组合、任务状态流转、任务/速记排序过滤、速记标题/摘要生成。
2. 新增 `QuickNotesRepository`，封装 Tauri `load_store` / `save_store` 调用和错误转换。
3. 实现 Tauri Rust 数据结构、应用数据目录 JSON 读写、临时文件写入和 command 注册。
4. 新增任务 Tab 组件：新增任务、进行中列表、inline 编辑/完成/删除、已完成折叠区、恢复。
5. 新增速记 Tab 组件：左侧标题摘要列表、右侧正文编辑区、新增/选择/编辑/删除。
6. 改造 `App.svelte` 为满窗体应用壳：加载、读取失败、Header Tabs、当前 Tab 搜索、保存失败重试和组件组合。
7. 按需求验收逐项自检，并运行最小验证命令。

## Risk And Mitigation / 风险与缓解

- 风险：前端和 Rust 数据结构字段不一致。
  - 缓解方式：以 `docs/specs/quick-notes-tauri-json.md` 为唯一数据契约；执行时同步检查 TS 类型和 Rust struct。
- 风险：组件里混入过多业务逻辑，破坏逻辑/视图分离。
  - 缓解方式：任务排序、过滤、状态流转放入 `TaskService`；速记排序、过滤、标题摘要生成放入 `NoteService`；组件只派发事件。
- 风险：任务服务与速记服务拆分后，上层组合保存时遗漏某一侧数据。
  - 缓解方式：通过 `QuickNotesStoreService.withTasks()` / `withNotes()` 统一生成下一版 `QuickNotesStore`，repository 只保存整体 store。
- 风险：保存失败后的内存状态和磁盘状态不一致。
  - 缓解方式：需求允许失败时保留内存状态；通过轻量错误和重试保存提示用户，正常路径以最新内存状态覆盖保存。
- 风险：当前 Tab 搜索和 Tab 切换状态混淆。
  - 缓解方式：`activeTab` 与 `searchQuery` 由 `App.svelte` 统一持有；切换 Tab 时清空 query 或按当前 Tab 重新解释 query，执行时推荐清空。
- 风险：速记标题由正文第一行生成，长文本展示拥挤。
  - 缓解方式：`NoteService.getNoteTitle()` 和 `getNoteSummary()` 统一截断策略；UI 只展示派生结果。
- 风险：Tauri 原生构建依赖在不同机器上不完整。
  - 缓解方式：优先运行 `pnpm --filter quick-notes check` 和 `pnpm --filter quick-notes build`；Tauri build 失败时记录系统依赖原因。

## Validation Plan / 验证计划

- 静态检查：
  - `pnpm --filter quick-notes check`
- 构建验证：
  - `pnpm --filter quick-notes build`
- Tauri 验证：
  - `pnpm --filter quick-notes tauri:build`
  - 若失败，记录是否为系统 Rust/MSVC/WebView/打包依赖问题。
- 单元/核心逻辑测试：
  - 若执行阶段补充测试能力，则优先覆盖 `TaskService`、`NoteService` 和 `QuickNotesStoreService`：
    - 新增任务/速记 trim 行为。
    - 完成/恢复任务的 `status` 与 `completedAt`。
    - 任务、已完成、速记排序。
    - 当前 Tab 搜索过滤。
    - 速记标题/摘要生成。
- 手动验证：
  - 打开应用默认进入任务 Tab。
  - 新增、编辑、完成、恢复、删除任务。
  - 已完成区默认折叠并展示数量。
  - 切换速记 Tab，新增、选择、编辑、删除速记。
  - 速记左侧标题和摘要自动来自正文第一行。
  - 搜索只过滤当前 Tab。
  - 读取失败和保存失败能看到轻量错误与重试入口。
  - 重启应用后读取已保存数据。
- 验收证据：
  - 命令输出摘要。
  - 手动验证清单。
  - 如 Tauri build 不通过，记录环境原因和已通过的 Svelte/Vite 验证。

## Execute Checkpoint / 执行检查点

- 当前理解：需求已进入技术方案阶段，当前方案选择 Header Tab 独立管理任务和速记，强调逻辑与视图分离。
- 核心目标：实现本地 JSON 持久化的轻量桌面速记工具，代码分层清楚，`TaskService` 管任务逻辑，`NoteService` 管速记逻辑，`features` 管视图交互，Tauri 后端管文件读写。
- 下一步动作：等待用户确认技术方案后，再进入代码执行。
- 风险：保存失败重试、速记标题派生、当前 Tab 搜索、TS/Rust 类型一致性需要执行时重点验证。
- 验证方式：`pnpm --filter quick-notes check`、`pnpm --filter quick-notes build`、按环境尝试 `pnpm --filter quick-notes tauri:build`。
- Execution Approval: `Pending`
