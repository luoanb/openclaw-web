# Technical Plan / 技术方案: Web Claw File Management Phase 2

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-05-27_22-38_web-claw-file-management-phase-2/requirements.md`
- 需求确认状态：`Approved`
- 本方案覆盖范围：
  - 目录树 item 与目录树容器空白区域的上下文菜单目标判定。
  - 文件上传到工作区 / 目录 / 文件父目录。
  - 文件下载。
  - 应用内复制粘贴文件与目录。
  - 操作完成后刷新受影响目录、展示反馈、处理同名冲突。
- 本方案不覆盖：
  - 目录下载、剪切移动、系统剪贴板文件互通、拖拽上传、大文件分片和断点续传。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `docs/sdd-lab/2026-05-27_22-38_web-claw-file-management-phase-2/requirements.md`
  - `docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`
  - `packages/os-core/src/files/file.interfaces.ts`
  - `packages/browserpod/src/files/browserpodFile.impl.ts`
  - `packages/browserpod/src/files/browserpodFileCommand.impl.ts`
  - `packages/browserpod/src/files/browserpodFilePath.impl.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`
  - `packages/browserpod/src/command/browserpodCommand.impl.ts`
  - `apps/web-claw/src/lib/core/files/fileWorkspaceState.ts`
  - `apps/web-claw/src/lib/features/files/components/FilesPanel.svelte`
  - `docs/design/BitsUI.md`
- 已用 MCP 读取 Figma Bits UI Context menu 节点：
  - MCP server：`user-figma-developer-mcp`
  - 工具：`get_figma_data`
  - fileKey：`P4HsiLObiYcXgVqrtHMHdH`
  - nodeId：`2704:424`
  - 设计事实：菜单为圆角浮层、行高约 40px、支持图标、分隔线、hover 高亮和快捷键提示。
- 当前实现事实：
  - `FileService` 目前提供 `listDirectory`、`inspectTextFile`、`readTextFile`、`writeTextFile`、`createFile`、`createDirectory`、`rename`、`delete`。
  - `FileService` 还没有通用字节读写、下载、上传或复制文件契约。
  - `BrowserPodFileService` 目前对文本文件使用 `openFile(path, "utf-8")` / `createFile(path, "utf-8")`，文件句柄类型已声明 `read(length)` 可返回 `string | ArrayBuffer`，`write(data)` 可接收 `string | ArrayBuffer`。
  - `BrowserPodFileCommandRunner` 已通过 `CustomTerminalCommandRunner` 执行 `ls -l`、`mv`、`rm`、`grep` 等 shell 命令。
  - `CustomTerminalCommandRunner` 已按一期修复方向使用单 custom terminal + 队列串行执行，并保留 `pod.run` receiver。
  - `BrowserPodFilePath` 已提供 `normalize`、`dirname`、`basename`、`join`、`shellQuote`。
  - `FileWorkspaceState` 维护 root path、选中路径、已展开目录、目录缓存、打开文件 Tab；目前没有应用内文件剪贴板状态。
  - `FilesPanel.svelte` 目前将 ContextMenu 绑定在每个目录树 row 上；目录树容器空白区域没有 ContextMenu trigger。
  - `FilesPanel.svelte` 目前新增、改名、删除使用原生 `window.prompt` / `window.confirm`；二期可沿用最小实现，但同名冲突需明确确认，不得静默覆盖。
- 当前约束与风险：
  - BrowserPod SDK 二进制文件 mode 尚未在当前代码中验证；真实实现前必须 probe `openFile/createFile` 的二进制读写方式。
  - 自定义 terminal 输出不适合直接承载原始二进制；若走命令降级，必须使用 base64 文本传输。
  - 浏览器下载需要在 app 层创建 `Blob` 和临时 object URL；不能把 BrowserPod SDK 文件句柄泄漏到 app。

## Proposed Solution / 拟定方案

- 方案摘要：
  - 在 `os-core` 文件契约中新增最小二期能力：读文件字节、写文件字节、复制路径。
  - 在 `browserpod` 文件 adapter 中实现二期能力：
    - 上传：app 读取浏览器 `File.arrayBuffer()`，通过 `FileService.writeFileBytes(...)` 写入容器目标路径。
    - 下载：app 调用 `FileService.readFileBytes(...)` 获取 `ArrayBuffer`，再由浏览器 `Blob` 下载。
    - 复制粘贴：不把文件内容拉回浏览器，adapter 使用容器内 `cp` 完成同容器文件 / 目录复制。
  - 在 `apps/web-claw` 中新增统一菜单目标模型：右键 row 时目标为文件 / 目录；右键目录树空白区域时目标为当前工作区 root path。
  - 在 `FileWorkspaceState` 中新增应用内剪贴板状态，记录源路径、名称与 kind，不写入系统剪贴板。
  - 粘贴同名冲突默认策略：不弹二次确认，不覆盖；文件和目录都由系统自动探测并选取第一个不存在的副本目标名，例如 `{name}_copy`、`{name}_copy_2`、`{name}_copy_3`。
- 为什么选择该方案：
  - 契约先行，继续保持 app / `os-core` / `browserpod` 分层。
  - 上传下载需要字节能力，不能复用只面向文本编辑的 `readTextFile/writeTextFile`。
  - 同容器复制用 `cp` / `cp -r` 比“读到浏览器再写回容器”更少传输、更符合文件管理语义。
  - 菜单目标由显式 state 决定，避免空白区域误用最近选中项。
- 不采用的方案：
  - 不把 BrowserPod SDK 文件对象暴露给 app。
  - 不把复制内容放入浏览器系统剪贴板。
  - 不用 terminal raw output 传输二进制。
  - 不在二期实现目录打包下载。
  - 不把右键菜单目标绑定到 `selectedPath`，因为 selected 与 context target 是两个不同交互概念。

## Contract Design / 契约设计

### `packages/os-core/src/files`

更新文件：

- `file.interfaces.ts`
- `file.errors.ts`
- `index.ts` 如需导出新增类型。

新增类型建议：

- `BinaryFileSnapshot`
  - `path`
  - `content: ArrayBuffer`
  - `readAt`
  - `size?: number`
  - `mimeType?: string`
- `FileBytesWriteOptions`
  - `overwrite?: boolean`
- `FileCopyOptions`
  - `overwrite?: boolean`，仅供内部或后续显式覆盖能力使用；Files UI 粘贴不使用覆盖确认。
- `FileCopyKind = "file" | "directory"`
- `FileService` 新增方法：
  - `readFileBytes(runtimeSession: RuntimeSession, path: string): Promise<BinaryFileSnapshot>`
  - `writeFileBytes(runtimeSession: RuntimeSession, path: string, content: ArrayBuffer, options?: FileBytesWriteOptions): Promise<FileActionResult>`
  - `copyPath(runtimeSession: RuntimeSession, fromPath: string, toPath: string, kind: FileCopyKind, options?: FileCopyOptions): Promise<FileActionResult>`

新增或复用错误码建议：

- `file-read-failed`
- `file-write-failed`
- `file-create-failed`
- `copy-failed`
- `path-not-found`
- `path-already-exists`
- `unsupported-file-type`
- `file-too-large`
- `runtime-session-invalid`

约束：

- `readTextFile/writeTextFile` 继续服务文本编辑。
- `readFileBytes/writeFileBytes` 服务上传下载，不做文本检测。
- `copyPath` 承诺文件与目录复制；目录复制只支持同容器递归复制，不处理目录下载或系统剪贴板。

### `packages/browserpod/src/runtime`

更新文件：

- `browserpodRuntime.interfaces.ts`

调整建议：

- 保持 `BrowserPodFileLike.read(length): Promise<string | ArrayBuffer>`。
- 保持 `BrowserPodFileLike.write(data: string | ArrayBuffer): Promise<number>`。
- 执行阶段先用真实 BrowserPod probe 确认二进制文件打开 / 创建 mode：
  - 优先尝试 SDK 文档或 runtime 行为支持的 binary mode。
  - 若真实 SDK 只稳定支持 `"utf-8"`，则二进制上传下载走 base64 命令降级，不把 `"utf-8"` 当成二进制通道。

### `packages/browserpod/src/files`

更新文件：

- `browserpodFile.impl.ts`
- `browserpodFileCommand.impl.ts`
- `browserpodFilePath.impl.ts`
- `browserpodFile.impl.test.ts`
- `browserpodFileCommand.impl.test.ts`

实现策略：

- `readFileBytes`：
  - 优先路径：使用 BrowserPod SDK 打开二进制文件，读取 size 后返回 `ArrayBuffer`。
  - 降级路径：通过 `base64 <file>` 输出文本，在 adapter 中解码为 `ArrayBuffer`。
  - 加大小上限，建议二期先设为 `5 MiB`，避免 base64 输出和浏览器内存压力过大。
- `writeFileBytes`：
  - 优先路径：使用 BrowserPod SDK 创建 / 打开二进制文件并写入 `ArrayBuffer`。
  - 降级路径：将 `ArrayBuffer` 转 base64，使用 shell `base64 -d > target` 写入。
  - `overwrite` 为 false 且目标存在时返回 `path-already-exists`，不覆盖。
- `copyPath`：
  - 文件复制：源必须为普通文件；`overwrite` 为 false 且目标存在时，自动按 `{name}_copy`、`{name}_copy_2`、`{name}_copy_3` 顺序探测，选择第一个不存在的同级目标文件名。
  - 文件复制显式覆盖：仅当调用方传入 `overwrite: true` 时执行 `cp -f "$source" "$target"`；Files UI 粘贴不触发该路径。
  - 目录复制：源必须为目录；目标不存在时执行 `cp -r "$source" "$target"`。
  - 目录复制同名冲突：若 `target` 已存在，自动按 `{name}_copy`、`{name}_copy_2`、`{name}_copy_3` 顺序探测，选择第一个不存在的同级目标目录名。
  - 目标探测必须使用稳定 sentinel 输出判断存在/不存在，不直接依赖 BrowserPod `pod.run` 的 exit code。
  - 禁止把目录复制到自身或自身子路径，例如 `/a` 粘贴到 `/a/b`。
- `BrowserPodFileCommandRunner` 可新增：
  - `pathExists(pod, path): Promise<boolean>`
  - `copyPath(pod, fromPath, toPath, kind, options): Promise<{ readonly targetPath: string }>`
  - `readFileBase64(pod, path): Promise<string>`
  - `writeFileBase64(pod, path, base64, options): Promise<void>`

命令约束：

- 命令仍通过 `CustomTerminalCommandRunner` 串行执行。
- shell 参数必须使用 `BrowserPodFilePath.shellQuote`。
- base64 降级路径需要 sentinel 包裹输出，避免 terminal prompt 或 ANSI 内容混入。
- 不使用 raw binary stdout。

## App Architecture / 应用架构

### `apps/web-claw/src/lib/core/files`

更新文件：

- `fileWorkspaceState.ts`
- `fileServiceProvider.ts` 如新增 service 实例依赖。
- `index.ts` 如新增类型导出。

新增状态建议：

- `FileClipboardSnapshot`
  - `kind: "file" | "directory"`
  - `sourcePath`
  - `name`
  - `copiedAt`
- `FileWorkspaceState` 新增方法：
  - `setCopiedPath(path: string, kind: "file" | "directory"): void`
  - `clearClipboard(): void`
  - `getClipboard(): FileClipboardSnapshot | null`

约束：

- 应用内剪贴板只记录路径和 kind，不缓存文件内容。
- 复制源在粘贴时才由 service 执行真实复制；如果源已被删除，粘贴时显示错误。

### `apps/web-claw/src/lib/features/files/components/FilesPanel.svelte`

重构建议：

- 引入统一菜单目标：
  - `workspace`: 当前 root path。
  - `directory`: 目录 entry。
  - `file`: 文件 entry。
- 将 ContextMenu 从“每个 row 一个菜单”调整为“目录树区域一个菜单 + 显式 target state”，或保留 row 菜单但额外包裹容器菜单。
- 推荐方案：单个 `ContextMenu.Root` 包住目录树滚动区域。
  - row `oncontextmenu` 设置 target 为对应 entry。
  - 容器 `oncontextmenu` 在 `event.target === event.currentTarget` 或未命中 row 时设置 target 为 workspace。
  - row 右键不得冒泡为 workspace target。
- 菜单项按 target 展示：
  - workspace / directory：New file、New folder、Upload file、Paste（有剪贴板时启用）。
  - file：Open、Download、Copy、Rename、Delete、Upload file to parent folder。
  - directory：Copy、Rename、Delete。
  - workspace：Refresh。
- 上传实现：
  - 使用隐藏 `<input type="file">`。
  - 第一轮支持单文件；多文件上传作为后续增强。
  - 触发上传前记录目标目录；选择文件后读取 `file.arrayBuffer()` 并调用 `writeFileBytes`。
  - 目标文件名使用浏览器文件名；目标路径为 `joinPath(targetDirectory, file.name)`。
- 下载实现：
  - 仅文件 target 可用。
  - 调用 `readFileBytes`，使用 `Blob` + `URL.createObjectURL` + 临时 `<a download>` 触发下载。
  - 下载后 `URL.revokeObjectURL`。
- 复制粘贴实现：
  - Copy file：记录文件路径与 kind 到 `FileWorkspaceState`。
  - Copy directory：记录目录路径与 kind 到 `FileWorkspaceState`。
  - Paste：目标为 workspace 或 directory；目标路径为 `joinPath(targetDirectory, copiedName)`。
  - 文件粘贴前若目标存在，不弹确认；由 `copyPath(..., "file", { overwrite: false })` 自动生成第一个不存在的副本目标名。
  - 目录粘贴前若目标存在，不弹确认；由 `copyPath(..., "directory", { overwrite: false })` 自动生成第一个不存在的副本目标名。
  - 粘贴目录时必须禁止目标目录位于源目录内部。
- 冲突检查：
  - 粘贴不做二次确认；`copyPath` 默认不覆盖，冲突时持续探测副本目标名，直到找到第一个不存在的路径或达到实现上限。
  - 后续可新增专门的 `exists` 契约优化交互。

## Page Design / 页面设计

- 页面入口/路由：
  - 仍复用 `App.svelte` 中现有 Files Tab，不新增顶层导航。
- 布局结构：
  - 保持左侧 Explorer + 右侧 Tab 编辑区。
  - 目录树滚动容器成为上下文菜单可触发区域。
- 核心组件：
  - `ContextMenu`：用于 row 与空白区域菜单。
  - `Button`：下载、保存、刷新等按钮仍按现有小尺寸风格。
  - 隐藏原生 file input：只负责选择本地文件，不作为视觉组件。
  - 后续如替换 prompt/confirm，应使用 Bits UI `Dialog` / `Alert dialog`。
- 视觉约束：
  - 对照 `docs/design/BitsUI.md` 的 Context menu 节点 `2704-424`：圆角浮层、图标 + 文案、hover 高亮、分隔线。
  - 右键空白区域时菜单文案要体现 workspace 目标，例如 `Upload to workspace` / `Paste into workspace`。
- 可访问性：
  - 保持 ContextMenu 键盘触发能力。
  - 上传 input 由菜单项触发时需保证失败和取消都有清晰状态。
  - 下载菜单项只在文件 target 上启用。

## Data Flow / 数据流

1. 用户右键目录树 row：
   - UI 设置 `menuTarget = { kind: row.entry.kind, path: row.entry.path }`。
   - Context menu 渲染对应菜单项。
2. 用户右键目录树空白区域：
   - UI 设置 `menuTarget = { kind: "workspace", path: workspace.rootPath }`。
   - Context menu 渲染工作区菜单项。
3. 上传文件：
   - UI 根据 target 计算上传目录。
   - 浏览器 file input 返回 `File`。
   - UI 读取 `ArrayBuffer`。
   - `FileService.writeFileBytes(session, targetPath, buffer, { overwrite: false })`。
   - 若目标存在，确认后使用 `overwrite: true` 重试。
   - 成功后刷新目标目录。
4. 下载文件：
   - `FileService.readFileBytes(session, filePath)`。
   - UI 创建 `Blob` 并触发浏览器下载。
5. 复制文件或目录：
   - UI 调用 `workspace.setCopiedPath(path, kind)`。
   - 不访问容器，不读文件内容。
6. 粘贴文件或目录：
   - UI 根据 target 计算目标目录和目标路径。
   - 文件粘贴：`FileService.copyPath(session, sourcePath, targetPath, "file", { overwrite: false })`；若目标存在，由 adapter 自动使用第一个不存在的副本目标名。
   - 目录粘贴：`FileService.copyPath(session, sourcePath, targetPath, "directory", { overwrite: false })`；若目标目录存在，由 adapter 自动使用第一个不存在的副本目标名，不覆盖、不合并。
   - 成功后刷新目标目录。

## Impacted Areas / 影响范围

- 文件/模块：
  - `packages/os-core/src/files/file.interfaces.ts`
  - `packages/os-core/src/files/file.errors.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`
  - `packages/browserpod/src/files/browserpodFile.impl.ts`
  - `packages/browserpod/src/files/browserpodFileCommand.impl.ts`
  - `packages/browserpod/src/files/browserpodFilePath.impl.ts`
  - `packages/browserpod/src/files/*.test.ts`
  - `apps/web-claw/src/lib/core/files/fileWorkspaceState.ts`
  - `apps/web-claw/src/lib/features/files/components/FilesPanel.svelte`
- 接口/类型：
  - 新增字节文件 snapshot、字节写入选项、复制 kind 与复制选项。
  - `FileService` 新增 `readFileBytes`、`writeFileBytes`、`copyPath`。
- 数据/状态：
  - `FileWorkspaceState` 新增应用内文件剪贴板。
  - `FilesPanel` 新增 context menu target state、upload pending target state。
- UI/交互：
  - 目录树空白区域右键菜单。
  - 文件上传 input。
  - 文件下载 Blob 触发。
  - 文件与目录复制 / 粘贴菜单项。
- 测试：
  - `os-core` 类型编译。
  - `browserpod` adapter 单测覆盖字节读写降级、文件/目录 copy 命令、冲突错误。
  - `web-claw` svelte-check 覆盖 UI 类型。

## Execution Steps / 执行步骤

1. **步骤 1：BrowserPod 二进制读写 probe**
   - 用真实 BrowserPod 或最小 demo 验证 `openFile/createFile` 二进制 mode。
   - 记录可用 mode；若不可用，执行 base64 降级方案。
2. **步骤 2：文件契约扩展**
   - 扩展 `FileService` 类型。
   - 增加 `path-already-exists`、`copy-failed` 等错误码。
3. **步骤 3：BrowserPod adapter**
   - 实现 `readFileBytes`、`writeFileBytes`、`copyPath`。
   - 为 base64 降级、`cp` / `cp -r` 命令、目录副本名策略补单测。
4. **步骤 4：App core 状态**
   - 在 `FileWorkspaceState` 增加应用内文件剪贴板。
   - 增加必要 helper，保持路径拼接规则一致。
5. **步骤 5：FilesPanel 菜单与上传下载**
   - 引入统一 menu target。
   - 让目录树容器空白区域可打开 workspace 菜单。
   - 接入上传、下载、复制、粘贴。
   - 操作完成后刷新受影响目录。
6. **步骤 6：验证与回写**
   - 跑类型检查、测试和 `web-claw` check。
   - 真实页面验证空白区域右键、上传、下载、复制粘贴。
   - 回写 `lifecycle.md`。

## Risk And Mitigation / 风险与缓解

- 风险：BrowserPod SDK 二进制 mode 不明确。
  - 缓解方式：执行第一步先 probe；若不稳定，使用 base64 命令降级，并限制文件大小。
- 风险：base64 输出混入 terminal 提示符或 ANSI。
  - 缓解方式：使用 sentinel 包裹 payload，只解析 sentinel 之间内容；解析前剥离 ANSI。
- 风险：大文件上传下载导致内存或 terminal 输出压力过大。
  - 缓解方式：二期先设 `5 MiB` 文件上限；超过上限返回可读错误。
- 风险：右键空白区域误判为当前选中项。
  - 缓解方式：菜单目标由 `contextmenu` 命中区域显式设置，不能从 `selectedPath` 推导。
- 风险：粘贴同名文件覆盖用户数据。
  - 缓解方式：Files UI 粘贴不使用覆盖；目标存在时自动探测第一个不存在的副本目标名。
- 风险：目录粘贴同名冲突时覆盖或合并用户已有目录。
  - 缓解方式：目录冲突不覆盖、不合并，自动探测第一个不存在的副本目标名。
- 风险：复制目录到自身子目录导致递归或失败。
  - 缓解方式：在 UI 与 adapter 均禁止目标路径等于源路径或位于源路径内部。
- 风险：复制源在粘贴前被删除。
  - 缓解方式：`copyPath` 返回 `path-not-found`，UI 展示错误并保留或清除剪贴板由用户下一步决定。
- 风险：下载 Blob object URL 泄漏。
  - 缓解方式：触发下载后立即 `URL.revokeObjectURL`。

## Validation Plan / 验证计划

- 静态检查：
  - `pnpm --filter os-core check-types`
  - `pnpm --filter browserpod check-types`
  - `pnpm --filter web-claw check`
- 单元/集成测试：
  - `pnpm --filter browserpod test`
  - BrowserPod file adapter tests：
    - `writeFileBytes` 写入 `ArrayBuffer`。
    - `readFileBytes` 返回 `ArrayBuffer`。
    - base64 降级只解析 sentinel payload。
    - `pathExists` 不依赖 exit code，使用 sentinel 输出判断路径存在性。
    - `copyPath` 文件复制使用 `cp`，默认不覆盖，同名冲突时生成第一个不存在的副本目标名。
    - `copyPath` 目录复制使用 `cp -r`，同名目录冲突时生成第一个不存在的副本目标名。
    - 目录复制禁止复制到自身或自身子路径。
    - 目标已存在时返回 `path-already-exists`。
- 构建验证：
  - `pnpm --filter web-claw build`
- 手动验证：
  - 右键文件 row：菜单目标为该文件。
  - 右键目录 row：菜单目标为该目录。
  - 右键目录树空白区域：菜单目标为当前工作区 root path。
  - 上传单个文本文件到工作区，目录刷新后可见。
  - 上传单个二进制小文件到目录，目录刷新后可见。
  - 下载文件到浏览器本地。
  - 复制文件并粘贴到另一个目录。
  - 复制目录并粘贴到另一个目录。
  - 复制目录到存在同名目录的目标目录时，自动生成第一个不存在的副本目标名。
  - 粘贴同名文件时不弹二次确认，自动生成第一个不存在的副本目标名。
  - runtime 非 running 时菜单操作不可执行或被阻塞态覆盖。
- 验收证据：
  - 测试命令输出。
  - 浏览器手动验证记录。
  - 如有 BrowserPod binary mode probe，记录结论到 `lifecycle.md`。

## Execute Checkpoint / 执行检查点

- 当前理解：
  - 二期需求已确认，技术方案覆盖右键菜单作用域、上传、下载、复制粘贴文件与目录。
- 核心目标：
  - 在不泄漏 BrowserPod SDK 类型到 app 的前提下，补齐文件字节传输与同容器文件/目录复制能力，并修正目录树空白区域右键目标。
- 下一步动作：
  - 等待用户 review 技术方案并明确批准执行。
- 执行前仍需确认：
  - 二期单文件上传/下载大小上限是否采用 `5 MiB`。
  - 上传是否先只支持单文件。
  - 粘贴同名冲突已确认不弹二次确认；文件和目录均使用 `{name}_copy`。
  - 复制目标命名已确认使用自动探测策略；实现上限采用 100 次候选路径探测，超过后失败提示。
  - 是否暂不实现 `Ctrl+C` / `Ctrl+V` 快捷键。
- 风险：
  - BrowserPod SDK 二进制 mode 需要真实 probe；如果不可用，需要走 base64 降级并接受文件大小限制。
- 验证方式：
  - 先跑包级类型检查与 adapter 单测，再跑 `web-claw` check/build，最后做真实页面手动验证。
- Execution Approval: `Pending`
