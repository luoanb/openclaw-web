# `web-os`

面向浏览器 **WebContainer** 场景的 TypeScript 工具库：虚拟文件系统引导、工作区快照（IndexedDB）、与 **xterm** 集成的 shell 执行与缓冲、预览 iframe 与 `server-ready` 的对接。

**入口**：从包根导入即可（本仓库通过 `"web-os": "workspace:*"` 链接）。

```ts
import { webOsRuntime, attachPreview, WebContainerTerminalSession } from "web-os";
```

**运行环境**：依赖 `@webcontainer/api` 与浏览器 **cross-origin isolated**（通常由 dev/preview 服务器返回 COOP/COEP 头）。终端相关 API 需配合 `@xterm/xterm` 的 `Terminal` 实例使用。

**契约与默认实例（`packages/` 库约定）**：对外优先暴露 **`interface`**，逻辑落在 **类**（如 `TerminalConfigLoader`、`WebContainerTerminalSession`）与 **`webOsRuntime` / `webOsPreviewAttachment`** 等默认单例上；**`terminalCwdPrompt`** 为实现 **`ITerminalCwdPrompt`** 的**无状态对象**（与 **`TerminalCwdPrompt`** 同一引用）。Shell 执行与进程 IO 已收敛在 **`WebContainerTerminalSession`**（`terminalSession.ts`）。**`attachPreview`** 与 **`TerminalCwdPrompt.*`** 调用形式不变。

---

## 预览（Preview）

源码域：`packages/web-os/src/preview/`（`preview.interfaces.ts` + `preview.ts`）。

| 名称 | 说明 |
|------|------|
| `IWebOsPreviewAttachment` | 推荐契约：`attach(wc, iframe, sink)` → 取消订阅函数。 |
| `IPreviewAttachment` | `@deprecated`，与 `IWebOsPreviewAttachment` 等价。 |
| `WebOsPreviewAttachment` | 默认实现类。 |
| `webOsPreviewAttachment` | 默认单例（与 `attachPreview` 行为一致）。 |
| `attachPreview(wc, iframe, sink)` | 委托 `webOsPreviewAttachment.attach`。订阅 WebContainer 的 `server-ready`：先 `sink({ status: "waiting" })`，就绪后设置 `iframe.src = url` 并 `sink({ status: "ready", url, port })`。 |
| `PreviewStatus` | `"idle" \| "waiting" \| "ready" \| "load-error"` |
| `PreviewStatusEvent` | `{ status, url?, port? }` |

**用途**：在 UI 里把「终端里起的 HTTP 服务」展示到 iframe；不负责启动进程，只负责监听就绪并喂 URL。

---

## WebContainer 运行时（Runtime）

源码：`packages/web-os/src/webcontainer/runtime/`（`runtime.interfaces.ts`、`webOsRuntime.impl.ts`）。按 File Manager **当前盘**挂载工作区；正式 **`mount` 前**先 **`mount({})`** 做干净挂载（见 `docs/specs/2026-05-09_12-00_web-os-webcontainer-runtime.md`）。

| 名称 | 说明 |
|------|------|
| `IWebOsRuntime` | `start` / `mount` / `switchDriveAndBoot`、`fileStore`。 |
| `WebOsRuntime` | 实现类；可注入 `IFileManagerIdbStore`。 |
| `webOsRuntime` | 默认单例。 |
| `switchDriveAndBoot(driveId)` | 便捷函数；等价 `webOsRuntime.switchDriveAndBoot`。 |
| `start()` | `WebContainer.boot()` + 当前盘 `resolveMountTreeForDrive` + `mount`（含§5.2 前置空树）。 |
| `mount(wc, payload)` | §5.2 + `wc.mount(payload)`；快照导入用。 |
| `OPENCLAW_VERSION` | 见 `minimalWorkspaceTemplate.ts`（包入口直接导出）。 |
| `FEASIBILITY_PATH` | 文档路径常量。 |
| `tree` | 内置最小 `FileSystemTree`（种子盘用）。 |

---

## 工作区常量（Workspace）

| 名称 | 说明 |
|------|------|
| `WORKSPACE_KEY` | 当前 demo 约定的工作区逻辑键（IndexedDB 等按 key 区分）。 |
| `EXPORT_ROOT_PATH` | 导出根路径（MVP 为 `"."`）。 |
| `WORKSPACE_IDB_NAME` | IndexedDB 数据库名。 |
| `EXPORT_KIND_LABELS` | `WorkspaceExportKind` → 展示用中文标签。 |

---

## 文件树与快照（File system）

### 类型与校验

| 名称 | 说明 |
|------|------|
| `WorkspaceExportKind` | `"json-tree" \| "binary-snapshot" \| "zip-archive"`（与导出格式对应）。 |
| `WorkspaceTreeSnapshotRecord` | 快照记录结构（含 `schemaVersion`、`snapshotId`、`tree` 或 `binaryPayload` 等）。 |
| `assertValidFileSystemTree(tree)` | 断言对象符合可 `mount` 的 JSON 树形状。 |
| `assertSnapshotRecordPayload(record)` | 断言快照记录内部一致。 |
| `exportKindIsImportable(kind)` | 是否可被 `mount` 导入（JSON 树或 binary；**ZIP 不可导入**）。 |

### 错误类

| 名称 | 说明 |
|------|------|
| `InvalidSnapshotError` | 快照内容或结构非法。 |
| `IdbQuotaError` | IndexedDB 写入配额不足。 |

### IndexedDB：`WorkspaceTreeIdbStore`

构造时可传自定义 `dbName`（默认与 `WORKSPACE_IDB_NAME` 一致）。

| 方法 | 说明 |
|------|------|
| `open()` | 打开数据库。 |
| `close()` | 关闭连接。 |
| `putSnapshot(input)` | 写入快照；`input` 为 `PutSnapshotInput`（JSON 树或二进制负载 + workspace 元数据）。返回 `snapshotId`。 |
| `getSnapshot(snapshotId)` | 读取单条记录。 |
| `listSnapshots(workspaceKey)` | 按工作区键列出，按保存时间倒序。 |
| `deleteSnapshot(snapshotId)` | 删除一条。 |

---

## 终端（Terminal，与 xterm + WebContainer 配合）

对外 `interface` 与选项类型见域内 `*.interfaces.ts`（`config` / `cwdPrompt` / `terminalSession`）；实现仍为 `config.ts`、`terminalSession.ts` 等。

### 配置

| 名称 | 说明 |
|------|------|
| `TerminalConfig` | 日志字节/行上限、命令最大长度、截断策略与标记等。 |
| `DEFAULT_TERMINAL_CONFIG` | 默认配置对象。 |
| `ITerminalConfigLoader` | `load(): TerminalConfig`。 |
| `terminalConfigLoader` | 默认单例；`TerminalConfigLoader.load()` 静态方法委托该实例。 |
| `TerminalConfigLoader.load()` | 读取包内 `terminal.config.json` 并与默认值合并（固定 `truncateStrategy`）。 |

### 缓冲与引用对象

| 名称 | 说明 |
|------|------|
| `TerminalLogBuffer` | 按配置截断后写入 `Terminal`（`writeCapped` / `clear` / `compactToCap`）；前台流式输出可用 `writeCapped(..., { streamingForeground: true })` 推迟破坏性 `clear`，见 `terminal.config.json` 的 `logForegroundHardMaxFactor`。 |
| `WebContainerProcessRef` | 持有当前 `WebContainerProcess`（`current`）。 |
| `StdinForwardRef` | 持有子进程 stdin 的 writer（`current`）。 |
| `OutputReaderRef` | 持有 stdout pump 的 reader，便于中止时 `cancel`。 |

### 会话路径提示：`TerminalCwdPrompt`

在「单行 `cd`」语义下解析/更新会话 cwd，并格式化提示符文案（如 `~/leaf/sub $ `）。

| 名称 | 说明 |
|------|------|
| `ITerminalCwdPrompt` | `isCdOnlyLine`、`cdArgFromLine`、`resolveCdArg`、`formatPromptLabel`、`formatPromptLine`。 |
| `terminalCwdPrompt` | 默认实现对象（`satisfies ITerminalCwdPrompt`）；无状态。 |
| `TerminalCwdPrompt` | 与 `terminalCwdPrompt` **同一引用**，便于沿用 `TerminalCwdPrompt.*` 写法。 |

| 方法 | 说明 |
|------|------|
| `isCdOnlyLine(line)` | 是否为整行 `cd`。 |
| `cdArgFromLine(line)` | 取出 cd 目标参数。 |
| `resolveCdArg(currentRel, arg)` | 解析相对/绝对路径片段。 |
| `formatPromptLabel` / `formatPromptLine` | 展示用路径与完整 prompt 行。 |

### 会话类：`WebContainerTerminalSession`（推荐）

源码：`terminalSession.interfaces.ts`、`terminalSession.ts`。

| 名称 | 说明 |
|------|------|
| `IWebContainerTerminalSession` | 会话 Facade 契约：`bindWebContainer`、`runLine`、`runSpawn`、`abort`、`dispose`、`cwdRel`、`formatPromptLine`、`*Ref` / `logBuffer` 只读访问。 |
| `WebContainerTerminalSession` | 实现类：构造传入 `term` + `config`；订阅 **`term.onResize`**，在前台进程存在时调用 **`WebContainerProcess.resize`**；`WebContainer` 通过 **`bindWebContainer(wc)`** 注入（可与多面板共享同一 `wc`）；内部持有 `TerminalLogBuffer` 与各类 `*Ref`。 |
| `WebContainerTerminalSessionOptions` | `term`、`config`、`onForegroundChange?`、`onCwdRelChange?`、`initialCwdRel?` |
| `WebContainerTerminalSessionSpawnOptions` | `runSpawn` 的 `intro?`、`cwd?`（省略 `cwd` 时用会话 `cwdRel`） |
| `RunShellLineOptions` | `runLine` 的 `noCommandEcho?`、`cwd?`（与单行 `sh -c` 回显及工作目录覆盖相关）。 |
| `SpawnExtraOptions` | 底层 spawn 的 `cwd?`（相对容器 workdir）；一般通过 `runSpawn` 选项间接使用。 |

**典型用法**：面板 `onMount` 创建 xterm `Terminal` 后 `new WebContainerTerminalSession({ term, config })`；在 **`await webOsRuntime.start()`** 得到 `wc` 后 **`session.bindWebContainer(wc)`**，再 **`session.runLine("ls")`** / **`session.runSpawn("npm", ["install"])`**；在销毁 `Terminal` 之前调用 **`session.dispose()`** 以释放 `onResize` 订阅。多终端时 **每个面板一个 session 实例**，同一 `wc` 可 `bind` 到多个 session（勿共用同一组 `*Ref`）。

---

## 依赖版本

本包 `package.json` 声明：`@webcontainer/api`、`@xterm/xterm`。消费方通常还需直接依赖 `@xterm/addon-fit` 等（包未列出 addon，由应用按需添加）。
