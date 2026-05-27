# Technical Plan / 技术方案: Web Claw File Management

## Restated Understanding / 方案复述

- 当前需求已进入技术方案阶段：为 `apps/web-claw` 的 Files Tab 落地第一阶段文件管理能力。
- 核心目标：在统一 `RuntimeSession` 之上提供 IDE 风格文件管理：左侧嵌套目录树 + 地址栏 + 缓存展开状态，右侧多 Tab 文本预览 / 编辑 + Tab 行右侧保存 icon。
- 关键约束：
  - 目录信息必须通过容器内命令读取真实结果。
  - 文件内容读写允许 `browserpod` adapter 使用 BrowserPod SDK API。
  - 不做后台实时监听；用户交互触发按需读取最新信息。
  - 不与终端 `cwd` 联动。
  - 第一阶段只支持文本文件，非文本文件展示不支持提示。
- 当前方案只设计实现路径，不进入代码执行；执行仍需用户批准。

## Project Context / 项目现状

- 已读取文件/模块：
  - `docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/requirements.md`
  - `packages/os-core/src/runtime/runtime.interfaces.ts`
  - `packages/os-core/src/terminal/terminal.interfaces.ts`
  - `packages/os-core/src/terminal/terminalState.impl.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.impl.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`
  - `packages/browserpod/src/terminal/browserpodTerminal.impl.ts`
  - `apps/web-claw/src/App.svelte`
  - `apps/web-claw/src/lib/core/terminal/terminalServiceProvider.ts`
  - `apps/web-claw/package.json`
  - `docs/design/BitsUI.md`
- 当前实现事实：
  - `App.svelte` 已有 `Terminal` / `Files` / `Preview` Tab，Files 仍是占位。
  - `RuntimeManager` 已统一 boot/check/stop，`RuntimeSession` 不暴露 BrowserPod SDK 实例。
  - `BrowserPodRuntimeManager` 通过 `resolvePod(runtimeSession)` 在 adapter 内部从 session token 取 Pod。
  - `BrowserPodLike` 已声明 `run`、`createDirectory`、`createFile`、`openFile` 等可选能力。
  - `BrowserPodTerminalService` 已验证可通过 `pod.run("sh", ["-c", command], { cwd, terminal })` 执行命令；默认 `cwd` 为 `/home/user`。
  - `custom-terminal` 探测已确认：`createCustomTerminal({ onOutput })` 可捕获绑定 `pod.run` 的 stdout/stderr，适合非交互式命令输出接管；程序化 stdin 不可用，不应作为交互终端替代。
  - `apps/web-claw` 已接入 Bits UI / shadcn-svelte 组件，包含 `context-menu`、`tabs`、`resizable`、`button`、`textarea` 等可用基础组件。
- 相关编辑器事实：
  - 第一阶段按用户决策试用 Textarea，不引入 CodeMirror / Monaco 等编辑器依赖。
  - 语法高亮、语言感知或展示层语法提醒作为后续增强项处理。
- 约束与风险：
  - BrowserPod SDK 类型未提供目录列表或 watch API。
  - BrowserPod SDK 文件打开 mode 需要实现阶段核对；若 SDK 读写行为不稳定，需在 adapter 内降级为命令读写或暂停回写方案。
  - 文件大小上限、破坏性操作确认策略、本地上传是否纳入第一阶段仍待用户最终确认；本方案给出保守默认值，执行前需批准。

## Proposed Solution / 拟定方案

- 方案摘要：
  - 在 `os-core` 新增 `files` 域契约，只定义跨 runtime 的文件服务接口、数据结构和错误类型。
  - 在 `browserpod` 新增 `BrowserPodFileService`，接收 `RuntimeSession`，通过 `BrowserPodRuntimeManager.resolvePod()` 解析 Pod。
  - 目录读取通过 BrowserPod 内部 shell run 能力执行 `ls` / `ls -l`，返回轻量 `ShellRunResult`；文件 adapter 使用 JS 解析 `output` 字符串。
  - 文本文件读写优先使用 BrowserPod SDK `openFile` / `createFile`；`createDirectory` / `createFile` 使用 SDK，rename/delete 使用 `mv` / `rm`。
  - 在 `apps/web-claw` 新增 `core/files` 与 `features/files`：前者封装文件服务 provider 与目录树缓存状态类，后者负责 Svelte 组件展示。
  - 文本编辑器第一阶段使用 Textarea；只做文本编辑、dirty 标记和保存，不做语法高亮、诊断、智能补全。
- 为什么选择该方案：
  - 契约先行，延续 runtime / terminal 的包边界。
  - 目录读取满足“命令驱动真实目录信息”的需求。
  - 文件内容读写使用 SDK 可减少 shell 转义和大文本传输复杂度。
  - shell run 只表达命令成败与输出，不把文件领域结构下沉到 command runner。
  - 前端目录树缓存属于 UI 工作台状态，不污染 `RuntimeSession` 或 BrowserPod adapter。
- 不采用的方案：
  - 不把 BrowserPod SDK 实例暴露给 app。
  - 不让 files 依赖 `os-core` 的 interactive terminal 契约；shell run 属于 BrowserPod adapter 内部基础设施，必要时后续再提升为独立 process/command 契约。
  - 不为文件管理引入 sentinel / JSON / TSV 包裹协议。
  - 不复用 `packages/web-os` FileManager 多盘 / IndexedDB 方案。
  - 不使用 Monaco 或 CodeMirror 作为第一阶段编辑器。
  - 不默认全盘扫描、后台 watch 或与终端 `cwd` 自动联动。

## Contract Design / 契约设计

### `packages/os-core/src/files`

新增文件：

- `file.interfaces.ts`
- `file.errors.ts`
- `index.ts`

建议导出类型：

- `FileEntryKind = "file" | "directory" | "unknown"`
- `FileEntry`
  - `name`
  - `path`
  - `kind`
  - `size?: number`
  - `mtimeMs?: number`
- `DirectorySnapshot`
  - `path`
  - `entries`
  - `readAt`
- `TextFileSnapshot`
  - `path`
  - `content`
  - `encoding: "utf-8"`
  - `readAt`
  - `size?: number`
- `FileWriteOptions`
  - `overwrite?: boolean`
- `FileDeleteOptions`
  - `recursive?: boolean`
- `FileActionResult`
  - `{ ok: true }`
  - `{ ok: false; reason; message; error? }`
- `FileService`
  - `getDefaultPath(runtimeSession: RuntimeSession): string`
  - `listDirectory(runtimeSession: RuntimeSession, path: string): Promise<DirectorySnapshot>`
  - `readTextFile(runtimeSession: RuntimeSession, path: string): Promise<TextFileSnapshot>`
  - `writeTextFile(runtimeSession: RuntimeSession, path: string, content: string, options?: FileWriteOptions): Promise<FileActionResult>`
  - `createFile(runtimeSession: RuntimeSession, path: string, content?: string): Promise<FileActionResult>`
  - `createDirectory(runtimeSession: RuntimeSession, path: string): Promise<FileActionResult>`
  - `rename(runtimeSession: RuntimeSession, fromPath: string, toPath: string): Promise<FileActionResult>`
  - `delete(runtimeSession: RuntimeSession, path: string, options?: FileDeleteOptions): Promise<FileActionResult>`

建议错误码：

- `runtime-session-invalid`
- `path-invalid`
- `path-not-found`
- `directory-read-failed`
- `file-read-failed`
- `file-write-failed`
- `file-create-failed`
- `directory-create-failed`
- `rename-failed`
- `delete-failed`
- `unsupported-file-type`
- `file-too-large`
- `unknown`

### `packages/browserpod/src/command`

新增文件：

- `browserpodCommand.interfaces.ts`
- `browserpodCommand.impl.ts`
- `asyncTaskQueue.impl.ts`
- `index.ts`

实现类：

- `AsyncTaskQueue`
  - 通用异步任务队列工具，支持构造时配置 `concurrency`。
  - `enqueue(task)` 返回该任务自身的 Promise 结果，不要求调用方理解队列内部状态。
  - FIFO 启动任务；单个任务失败只 reject 当前任务，不阻断后续任务继续执行。
  - 队列本身不绑定 BrowserPod，供 command runner 或后续 adapter 复用。
- `BrowserPodCommandRunner`
  - 基于 `pod.createCustomTerminal({ onOutput })` 捕获输出 chunk，但不得为每次命令新建 terminal。
  - 同一个 `BrowserPodCommandRunner` 实例在同一 BrowserPod session 内最多 lazy 创建一个 custom terminal；该 terminal 创建后作为 runner 本地持有的资源存在，后续 `run()` 调用都复用它。
  - `run()` 必须允许用户层面的并发调用，但内部使用 `AsyncTaskQueue({ concurrency: 1 })` 串行执行 `pod.run(...)`，保证同一 custom terminal 上不并发执行命令。
  - 并发进入的多个 `run()` 调用必须按进入队列的顺序逐个启动、逐个 resolve / reject；每个调用返回自身命令结果，不得因后续命令覆盖前一个调用的 output 或状态。
  - 每次 run 使用独立 output buffer；`onOutput` 只写入当前 active command buffer，避免连续命令输出串线。
  - 基于 `pod.run("sh", ["-lc", script], { terminal, cwd, echo: false })` 执行非交互式命令。
  - 调用 BrowserPod SDK 方法时必须保留 `pod` 作为 receiver；不得将 `pod.run` 解构为裸函数后直接调用，否则真实 SDK 内部 `this` 绑定会丢失。
  - 不假设 `pod.run` 返回标准 Promise；adapter 需将 `Promise`、thenable、process-like `cosProcess` 与同步返回值归一化为内部完成 Promise。
  - 提供 `dispose()` / `close()` 释放复用 terminal；释放是 adapter 主动动作，但 BrowserPod 2.8.0 是否立即回收 virtual terminal quota 仍需真实验证。
  - 返回轻量 `ShellRunResult`：
    - `ok: boolean`
    - `code?: number | string`
    - `output: string`
  - `output` 为 combined text；文件 adapter 负责按文件场景解析。
  - `ok/code` 只表达命令是否成功或超时，不返回文件领域结构。
  - 不支持 stdin；如调用方需要 stdin，应使用默认终端或另起需求。

设计依据：

- `custom-terminal` demo 已验证 stdout/stderr 都会进入 `onOutput`。
- `custom-terminal` demo 已验证 `write` 不适合喂给 `pod.run` 前台 stdin。
- `pod.run` 返回值先归一化为内部完成 Promise 后作为完成判据；超时由 command runner 映射为 `ok: false` 和固定 `code`。
- 真实 Files Tab 堆栈已暴露：`waitForRunResult` 不得直接依赖 raw `.then(...)` 返回值进入 `Promise.race`，否则内部 `{ type }` 判别对象可能为 `undefined`。
- 真实 Files Tab 点击文件时暴露 `Virtual terminals are exhausted`：当前一次命令一次 `createCustomTerminal` 的资源模型不可接受；custom terminal 必须视为稀缺资源，由队列和复用策略调度。
- 当前方案的优先策略是“单 runner 单 custom terminal 复用 + 串行队列”。若真实 BrowserPod 不允许同一个 custom terminal 连续绑定多次 `pod.run`，则回退为“队列并发 1 + 每次命令创建 terminal”，但必须在文档中保留 quota 回收不可证明的风险，并提示 runtime 重启作为恢复手段。

### `packages/browserpod/src/files`

新增文件：

- `browserpodFile.impl.ts`
- `browserpodFilePath.impl.ts`
- `browserpodFileCommand.impl.ts`
- `index.ts`

实现类：

- `BrowserPodFileService implements FileService`
  - 构造函数接收 `BrowserPodRuntimeManager`
  - 每次操作通过 `resolvePod(runtimeSession)` 取得 Pod
  - session 不可用时抛或返回 `runtime-session-invalid`
- `BrowserPodFilePath`
  - 负责 normalize / join / shellQuote / 防空路径
  - 可复用 `BrowserPodTerminalPath` 的思路，但不要让 files 域依赖 terminal 域实现细节
- `BrowserPodFileCommandRunner`
  - 薄封装 `BrowserPodCommandRunner`，只负责文件场景的命令拼装、`output` 字符串解析和错误映射。
  - 使用 `sh -lc` 执行 `ls` / `ls -l` / `mv` / `rm`，不使用 `node -e`。
  - 不引入 sentinel、JSON 或 TSV 包裹协议。

目录读取命令建议：

- 不区分文件/目录时，可用 `ls "$target"` 读取单层目录，JS 按行拆分。
- 需要区分文件/目录时，用 `ls -l "$target"` 读取单层目录；JS 跳过 `total` 行，每行解析权限列和名称列；权限以 `d` 开头判定为目录，否则按文件处理。
- 排序：目录优先，其次按名称自然排序
- 单次只读目标目录，不递归扫描
- 禁止使用 `node -e`；目录读取不依赖 Node 脚本，也不依赖额外 `stat`/`wc` 元数据。

结构操作建议：

- `createDirectory`：优先 SDK `createDirectory(path, { recursive: true })`；若不可用再考虑 `mkdir -p` 降级。
- `createFile`：文本文件创建使用 SDK `createFile(path, "utf-8")`；真实 BrowserPod 会拒绝 `"w"` 等 POSIX 风格 mode。
- `rename`：使用 `mv <from> <to>`。
- `delete`：使用 `rm -f <path>` 或 `rm -rf <path>`；递归删除需由 UI 明确确认后传入。

文本读写建议：

- `readTextFile`：优先 SDK `openFile(path, "utf-8")`，读取 `getSize()` 后按大小上限读取；暂按 UTF-8 文本处理。
- `readTextFile` 自身负责大小检查、文本检测与内容读取；UI 打开文件时不得先 `inspectTextFile()` 再 `readTextFile()` 造成同一次点击重复检测。
- `writeTextFile`：优先 SDK `openFile(path, "utf-8")` 或 `createFile(path, "utf-8")`；不得使用 `"r"` / `"w"` 等 BrowserPod 不支持的 mode。
- 非文本类型判断以容器内文件内容检测为准，不以扩展名白名单作为最终依据；adapter 在读取前必须提供 `unsupported-file-type` / `file-too-large` 防线。
- 文本检测语义：空文件视为文本；非空文件参考 `LC_ALL=C grep -Iq "" "$file"` 判断是否可作为文本读取；扩展名仅用于语言标签、图标等展示辅助。
- 检测命令输出必须使用稳定 sentinel，并以包含 sentinel 的方式解析结果，避免 BrowserPod 自定义终端混入提示符、ANSI 控制字符或其他输出时把文本文件误判为非文本。

## App Architecture / 应用架构

### `apps/web-claw/src/lib/core/files`

新增文件：

- `fileServiceProvider.ts`
- `fileWorkspaceState.ts`
- `fileLanguageResolver.ts`
- `fileTextPolicy.ts`

职责：

- `FileServiceProvider`
  - 仿照 `TerminalServiceProvider`
  - 单例创建 `BrowserPodFileService(RuntimeManagerProvider.getBrowserPodRuntimeManager())`
- `FileWorkspaceState`
  - 纯 TS class，维护当前路径、目录缓存、展开路径集合、选中路径、打开文件 Tabs、当前 Tab、dirty 状态
  - 不直接操作 DOM，不直接 import Svelte
  - 对外提供方法：`setRootPath`、`expandDirectory`、`refreshOpenedDirectories`、`openTextFile`、`updateDraft`、`markSaved`、`closeTab`、`renamePathInCache`、`removePathFromCache`
- `FileLanguageResolver`
  - 第一阶段只根据扩展名返回展示标签（如 `TypeScript`、`JSON`、`Markdown`），用于 Tab 或状态提示。
  - 不加载语言包；语法高亮作为后续增强项。
- `FileTextPolicy`
  - 判定大小是否允许、是否可编辑
  - 不负责根据扩展名判断文件是否为文本；文本/非文本由 file service 基于内容检测
  - 技术方案默认建议：单文件读取/编辑上限 `1 MiB`，执行前需用户确认

### `apps/web-claw/src/lib/features/files/components`

新增组件建议：

- `FilesPanel.svelte`
  - 连接 runtime 状态、file service、workspace state
  - 容器未 running 时展示阻塞态，并提供打开 runtime drawer 的入口
- `FileAddressBar.svelte`
  - 显示 / 输入当前路径
  - 提交后切换 root path 并读取目录
- `FileTreeToolbar.svelte`
  - icon 工具栏，第一阶段包含刷新目录
- `FileTree.svelte`
  - 渲染嵌套目录树
  - 支持展开 / 收起 / 选中
- `FileTreeNode.svelte`
  - 单节点展示与 context menu trigger
- `FileContextMenu.svelte`
  - 文件 / 文件夹操作：新建文件、新建文件夹、改名、删除
- `FilePreviewTabs.svelte`
  - 右侧打开文件 Tab 管理
  - Tab 行右侧放保存 icon 按钮
- `TextEditor.svelte`
  - Textarea wrapper
  - 接收 `content`、`language`、`readonly?`
  - on change 回传 draft
- `UnsupportedFilePanel.svelte`
  - 非文本文件提示
- `FileConfirmDialog.svelte`
  - 删除 / 覆盖 / 重命名冲突确认

## Page Design / 页面设计

- 页面入口/路由：
  - 复用 `App.svelte` 中现有 `Tabs.Content value="files"`。
  - 将占位替换为 `<FilesPanel />`。
- 布局结构：
  - Files Tab 内使用左右分栏，优先用已有 `Resizable` 组件（Paneforge）实现。
  - 左栏固定最小宽度，承载路径栏、工具栏、目录树。
  - 右栏承载文件 Tab 行、保存 icon、编辑器 / 空态 / 不支持提示。
- 核心组件：
  - Bits UI / shadcn-svelte：`Button`、`ContextMenu`、`Tabs` 或自定义 tab row、`Resizable`、`Dialog` / `AlertDialog`、`Input`、`ScrollArea`、`Tooltip`。
  - Icons 使用现有 `@hugeicons/svelte`。
- 交互状态：
  - `idle`: 未打开文件，右侧显示空态。
  - `loading-directory`: 当前目录读取中。
  - `loading-file`: 文件读取中。
  - `editing`: 当前 Tab 有未保存修改。
  - `saving`: 保存中，保存 icon disabled 或显示 loading。
  - `unsupported`: 非文本文件或过大文件。
  - `blocked`: runtime 非 running。
- 视觉约束：
  - 参考 `docs/design/BitsUI.md` 中 Button、Context menu、Tabs、Resizable、Dialog 等组件。
  - 文件树样式参考 VSCode / IDE：紧凑行高、缩进层级、选中态、hover 态、目录展开 icon。
- 响应式/可访问性：
  - 第一阶段以桌面 Chromium 为基线。
  - 文件树节点和 Tab 需要键盘可聚焦；Context menu 保持 Bits UI 默认可访问能力。

## Text Editor / 文本编辑器方案

- 选型：第一阶段使用 Textarea。
- 依赖建议：
  - 不新增编辑器依赖。
  - 优先使用已有 `apps/web-claw/src/lib/components/ui/textarea` 或原生 `<textarea>` 封装。
- 集成策略：
  - 自建 `TextEditor.svelte` wrapper，内部使用 Textarea。
  - 当前 Tab 切换时以 `FileWorkspaceState` 中的 draft 作为内容来源。
  - Textarea change / input 回传 draft，Tab 标记 dirty。
  - 可展示文件语言标签，但不提供语法高亮。
- 能力边界：
  - 支持基础文本编辑和保存。
  - 不支持语法高亮。
  - 不接 LSP。
  - 不做智能补全、诊断、hover、代码格式化。
  - 不把 Textarea DOM 作为文件事实源；保存仍通过 `FileService.writeTextFile`。

## Data Flow / 数据流

1. `App.svelte` Files Tab 渲染 `FilesPanel`。
2. `FilesPanel` 订阅 `RuntimeManager` snapshot。
3. runtime 非 `running`：展示阻塞态。
4. runtime `running`：
   - `FileWorkspaceState` 初始化默认 root path `/home/user`。
   - `FileService.listDirectory(runtimeSession, rootPath)` 读取当前目录。
   - `FileWorkspaceState` 缓存目录 entries 与展开状态。
5. 用户展开目录：
   - 若未缓存或用户触发刷新，通过 `listDirectory` 读取该目录。
6. 用户刷新目录：
   - 遍历 `FileWorkspaceState.expandedPaths`，依次 `listDirectory`。
   - 更新缓存，保留展开状态。
7. 用户打开文本文件：
   - `readTextFile` 每次读取当前内容。
   - `FileWorkspaceState` 创建或聚焦 Tab。
8. 用户编辑：
   - `TextEditor` 将 draft 写入 `FileWorkspaceState`。
   - Tab 标记 dirty。
9. 用户点击保存 icon：
   - `writeTextFile` 写入当前 Tab draft。
   - 成功后清除 dirty，必要时刷新父目录 metadata。
10. 用户 context menu 操作：
   - 调用对应 `FileService` 方法。
   - 成功后刷新受影响目录或更新缓存。

## Impacted Areas / 影响范围

- 文件/模块：
  - `packages/os-core/src/files/**`
  - `packages/os-core/src/index.ts`
  - `packages/browserpod/src/files/**`
  - `packages/browserpod/src/command/**`
  - `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`
  - `packages/browserpod/src/index.ts`
  - `apps/web-claw/src/lib/core/files/**`
  - `apps/web-claw/src/lib/features/files/components/**`
  - `apps/web-claw/src/App.svelte`
  - `apps/web-claw/package.json`
- 接口/类型：
  - 新增 `FileService`、文件 snapshot、目录 entry、错误类型。
  - BrowserPodLike 需要把 `createDirectory` / `createFile` / `openFile` 的类型从 `unknown` 收紧为可调用契约。
- 数据/状态：
  - `FileWorkspaceState` 维护前端缓存，不持久化到本地存储。
  - Runtime session 仍是所有文件操作前置，不反向依赖 files。
- UI/交互：
  - Files Tab 从占位变为可操作分栏。
  - 新增 Textarea 文本编辑区与目录树 context menu。
- 测试：
  - `os-core` 文件契约类型与错误类型。
  - `browserpod` file service 的 mock Pod 单元测试。
  - `demos/browserpod-demo` 新增 package command runner probe，用真实 BrowserPod 验证 custom terminal command runner 的输出捕获、sentinel 完成判据与 timeout 行为。
  - `apps/web-claw` 最小 svelte-check / build。

## Execution Steps / 执行步骤

1. **步骤 1：文件契约**
   - 在 `os-core` 新增 `files` 域类型与错误。
   - 导出 `FileService`、snapshot、action result。
   - 增加最小类型测试或编译验证。
2. **步骤 2：BrowserPod 文件 adapter**
   - 收紧 `BrowserPodLike` 文件 API 类型。
   - 新增 `BrowserPodCommandRunner`，基于 custom terminal 捕获 output 并返回 `ok/code/output`。
   - 先通过 `browserpod-demo` package command runner probe 验证真实 BrowserPod 行为；mock 测试只覆盖纯逻辑边界，不作为 SDK 行为证据。
   - 实现 `BrowserPodFileService`。
   - 实现命令驱动目录读取：`ls -l` 输出由 JS 解析。
   - 实现 SDK 文本读写与结构操作。
   - 用 mock Pod / mock terminal 测试目录读取、读写、错误映射。
3. **步骤 3：App core 文件状态**
   - 新增 `FileServiceProvider`。
   - 新增 `FileWorkspaceState`、路径/语言/文本策略工具类。
   - 固化默认路径 `/home/user`，执行前需确认是否作为正式默认用户目录。
4. **步骤 4：Files UI 骨架**
   - 新增 `FilesPanel`，替换 Files Tab 占位。
   - 实现 runtime 阻塞态、左右分栏、路径栏、工具栏。
5. **步骤 5：目录树与上下文菜单**
   - 实现嵌套目录树、展开状态、缓存刷新。
   - 接入 context menu 的新增、改名、删除入口。
   - 接入确认 Dialog。
6. **步骤 6：多 Tab 文本编辑**
   - 实现 Textarea 版 `TextEditor.svelte` wrapper。
   - 实现文件语言展示标签。
   - 实现 Tab 打开/切换/关闭/dirty 状态。
   - 保存 icon 放在 Tab 行右侧。
7. **步骤 7：验证与文档回写**
   - 运行静态检查、包测试、web-claw build。
   - 记录 BrowserPod 真实目录读取 / 文本保存手动验证证据。
   - 更新 `lifecycle.md`。

## Risk And Mitigation / 风险与缓解

- 风险：BrowserPod SDK 文件 mode 行为不明确。
  - 缓解方式：执行阶段先在 adapter 单测 / 最小 probe 中确认 `openFile` / `createFile` mode；无法确认时暂停实现并回写方案。
- 风险：命令输出经过 terminal 捕获时混入控制字符。
  - 缓解方式：文件 adapter 在解析 `ls` / `ls -l` 前剥离 ANSI 控制字符，并只解析当前目录单层输出。
- 风险：`ls -l` 对包含换行或非常规空白的文件名不友好。
  - 缓解方式：第一阶段按常规项目文件名处理；后续如需要支持极端文件名，再升级目录输出协议。
- 风险：将 programmatic command 放入 terminal 契约导致 files 依赖 interactive terminal 语义。
  - 缓解方式：第一阶段只在 `packages/browserpod/src/command` 提供 adapter 内部 command runner；`os-core` 暂不新增公共 command/process 契约，除非后续服务预览等能力也需要共享。
- 风险：BrowserPod custom terminal virtual quota 被重复创建耗尽。
  - 缓解方式：新增 `AsyncTaskQueue` 控制命令并发；`CustomTerminalCommandRunner` 默认 `concurrency: 1`，同一 runner lazy 创建并复用一个 custom terminal，禁止文件命令并发创建 custom terminal。
- 风险：复用 custom terminal 时连续 `pod.run` 输出串线。
  - 缓解方式：每次 run 建立独立 output buffer；`onOutput` 只写入当前 active command；队列保证同一 custom terminal 上同一时刻只有一个 active command。
- 风险：BrowserPod 2.8.0 的 terminal `close` 是否回收 virtual terminal quota 不可证明。
  - 缓解方式：提供 `dispose()` / `close()` 主动释放；真实验证若发现 quota 长时间不回收，将该状态映射为可恢复错误，并提示用户重启 runtime 释放 BrowserPod 内部资源。
- 风险：大目录刷新已展开路径时性能差。
  - 缓解方式：只刷新已展开目录；串行或限并发；为目录读取加 loading 状态。
- 风险：Textarea 无语法高亮，编辑体验弱于 IDE。
  - 缓解方式：第一阶段接受轻量方案；后续如需语法高亮，再评估 CodeMirror 6 并单独更新方案。
- 风险：未确认文件大小上限导致大文件卡 UI。
  - 缓解方式：技术方案默认 `1 MiB` 上限，执行前请求用户确认。
- 风险：删除目录造成不可恢复数据丢失。
  - 缓解方式：删除文件/目录必须确认；删除目录需明确显示路径和“目录及其内容”。

## Validation Plan / 验证计划

- 静态检查：
  - `pnpm --filter os-core check-types`
  - `pnpm --filter browserpod check-types`
  - `pnpm --filter web-claw check`
- 单元/集成测试：
  - `pnpm --filter os-core test`
  - `pnpm --filter browserpod test`
  - BrowserPod command queue tests：
    - `AsyncTaskQueue` 遵守配置并发数，FIFO 启动任务。
    - 单个任务 reject 不阻塞后续任务。
    - `enqueue(task)` resolve / reject 对应各自任务结果。
  - BrowserPod command runner reuse tests：
    - 并发多个 `run()` 时，最多只调用一次 `createCustomTerminal`。
    - 多个命令经队列串行执行，且每个命令获得独立 output。
    - `dispose()` 调用 terminal `close`，并在后续 run 时可重新 lazy create。
  - Files open tests：
    - 单次 UI 打开文件只调用一次 `readTextFile`，不得先独立 `inspectTextFile` 再读。
    - `readTextFile` 内部失败仍映射为可读文件错误。
  - BrowserPod demo package probe：
    - `createCustomTerminal({ onOutput })` 捕获真实 `pod.run` 的 stdout/stderr。
    - 同一个 custom terminal 能否连续执行多次 `pod.run`；若不支持，记录回退方案证据。
  - `pod.run("sh", ["-lc", script], { terminal, cwd: "/home/user", echo: false })` 可返回轻量 `ShellRunResult`。
  - 成功路径输出 `ok: true` 与 combined `output`。
  - timeout 路径输出 `ok: false`、固定 `code` 与 timeout 前捕获到的 `output`。
  - BrowserPod file adapter mock tests：
    - shell run 轻量结果的纯逻辑边界；不得替代真实 BrowserPod probe 结论。
    - `ls -l` 输出解析。
    - SDK read/write 调用。
    - rename/delete 命令构造。
    - runtime session invalid 错误。
- 构建验证：
  - `pnpm --filter web-claw build`
- 手动验证：
  - 有效 `VITE_BP_APIKEY` + cross-origin isolation 环境。
  - 打开 Files Tab 自动加载 `/home/user`。
  - 展开目录后缓存与展开状态保留。
  - 刷新目录只扫描已打开目录。
  - 打开多个文本文件 Tab。
  - 编辑文本并通过 Tab 行右侧保存 icon 保存。
  - 终端创建/修改文件后，文件面板通过对应交互读取最新内容。
  - 非文本文件展示不支持提示。
- 验收证据：
  - 命令输出或截图记录。
  - 测试命令结果。
  - lifecycle 执行日志。

### BrowserPod Demo Package Probe Evidence / package command runner 真实探测证据

- 时间：2026-05-27 00:54 左右。
- 入口：`demos/browserpod-demo`，新增 `Package Command Runner` case。
- 被测对象：直接 import `packages/browserpod/src/command/browserpodCommand.impl.ts` 的 `CustomTerminalCommandRunner`，使用真实 `BrowserPod` session，不使用 mock Pod。
- 环境：Vite dev server `http://localhost:5175/`，页面已成功 boot BrowserPod。
- 成功路径：
  - `runner.run(ctx.pod, "sh", ["-lc", script], { cwd: "/home/user", timeoutMs: 12000 })`
  - Console checks：
    - `ok: true`
    - `stdoutSeen: true`
    - `stderrSeen: true`
    - `outputPreview: "package-runner-stdout\npackage-runner-stderr\n"`
- timeout 路径：
  - `runner.run(ctx.pod, "sh", ["-lc", script], { cwd: "/home/user", timeoutMs: 1000 })`
  - Console checks：
    - `ok: false`
    - `code: "timeout"`
    - `startSeen: true`
    - `completionSeen: false`
    - `outputPreview: "PACKAGE_TIMEOUT_STARTED\n"`
- 结论：
  - 真实 BrowserPod 下，`CustomTerminalCommandRunner` 可以通过 custom terminal `onOutput` 捕获 stdout/stderr。
  - command runner 返回轻量 `ok/code/output`，文件 adapter 只解析 `output`。
  - timeout 路径可观测，且会保留 timeout 前已捕获的 output。
  - 后续 mock 单测只应覆盖纯逻辑边界，不应替代上述 SDK 行为证据。

## Execute Checkpoint / 执行检查点

- 当前理解：
  - 技术方案已覆盖文件契约、BrowserPod adapter、Files UI、Textarea 文本编辑器和验证路径。
- 核心目标：
  - 将 Files Tab 从占位推进到命令驱动目录树 + SDK 文本读写 + IDE 风格多 Tab 编辑，并修复 BrowserPod custom terminal 资源调度问题。
- 下一步动作：
  - 当前先完成方案落地；代码执行需用户再次明确批准。
- 执行前仍需确认：
  - 文件大小上限是否采用 `1 MiB`。
  - 删除/覆盖/重命名确认策略是否采用本方案默认：删除必确认，重命名冲突必确认，保存当前已打开文件不额外确认。
  - 本地上传是否不纳入第一阶段。
  - 是否需要补写 `docs/prd/prd-web-claw-files-light.md`。
- 风险：
  - BrowserPod SDK 文件 API mode、custom terminal command runner 完成判据、同一 custom terminal 连续执行多次 `pod.run` 的行为需要实现阶段实证。
- 验证方式：
  - 先跑包级类型检查和 adapter 单测，再跑 `web-claw` check/build，最后做 BrowserPod happy path 与 custom terminal 复用手动验证。
- Execution Approval: `Pending for command queue / custom terminal reuse fix`
