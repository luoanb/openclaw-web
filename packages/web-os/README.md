# `web-os`

面向浏览器 **WebContainer** 场景的 TypeScript 工具库：虚拟文件系统引导、工作区快照（IndexedDB）、与 **xterm** 集成的 shell 执行与缓冲、预览 iframe 与 `server-ready` 的对接。

**入口**：从包根导入即可（本仓库通过 `"web-os": "workspace:*"` 链接）。

```ts
import { bootWebContainer, attachPreview, WebContainerShellRunner } from "web-os";
```

**运行环境**：依赖 `@webcontainer/api` 与浏览器 **cross-origin isolated**（通常由 dev/preview 服务器返回 COOP/COEP 头）。终端相关 API 需配合 `@xterm/xterm` 的 `Terminal` 实例使用。

---

## 预览（Preview）

| 名称 | 说明 |
|------|------|
| `attachPreview(wc, iframe, sink)` | 订阅 WebContainer 的 `server-ready`：先 `sink({ status: "waiting" })`，就绪后设置 `iframe.src = url` 并 `sink({ status: "ready", url, port })`。返回 **取消订阅函数**。 |
| `PreviewStatus` | `"idle" \| "waiting" \| "ready" \| "load-error"` |
| `PreviewStatusEvent` | `{ status, url?, port? }` |

**用途**：在 UI 里把「终端里起的 HTTP 服务」展示到 iframe；不负责启动进程，只负责监听就绪并喂 URL。

---

## WebContainer 引导（Boot）

| 名称 | 说明 |
|------|------|
| `bootWebContainer()` | 单例 `WebContainer.boot()`，多次调用共享同一实例。 |
| `ensureWorkspace(wc)` | **首次**将内置最小模板树 `tree` `mount` 到容器（仅一次）；若已通过导入挂载过工作区则不再覆盖。 |
| `mountImportedWorkspace(wc, payload)` | 用快照恢复整个虚拟 FS：`payload` 为 `FileSystemTree` 或 `ArrayBuffer`（与官方 `mount` 一致）。执行后标记「已挂载」，后续 `ensureWorkspace` 不再套用模板。 |
| `OPENCLAW_VERSION` | 内置模板里声明的 openclaw 依赖版本字符串。 |
| `FEASIBILITY_PATH` | 文档路径常量（展示/链接用）。 |
| `tree` | 内置最小 `FileSystemTree`（含根 `package.json`）。 |

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

### 配置

| 名称 | 说明 |
|------|------|
| `TerminalConfig` | 日志字节/行上限、命令最大长度、截断策略与标记等。 |
| `DEFAULT_TERMINAL_CONFIG` | 默认配置对象。 |
| `TerminalConfigLoader.load()` | 读取包内 `terminal.config.json` 并与默认值合并（固定 `truncateStrategy`）。 |

### 缓冲与引用对象

| 名称 | 说明 |
|------|------|
| `TerminalLogBuffer` | 按配置截断后写入 `Terminal`（`writeCapped` / `clear`）。 |
| `WebContainerProcessRef` | 持有当前 `WebContainerProcess`（`current`）。 |
| `StdinForwardRef` | 持有子进程 stdin 的 writer（`current`）。 |
| `OutputReaderRef` | 持有 stdout pump 的 reader，便于中止时 `cancel`。 |

### 会话路径提示：`TerminalCwdPrompt`

在「单行 `cd`」语义下解析/更新会话 cwd，并格式化提示符文案（如 `~/leaf/sub $ `）。

| 方法 | 说明 |
|------|------|
| `isCdOnlyLine(line)` | 是否为整行 `cd`。 |
| `cdArgFromLine(line)` | 取出 cd 目标参数。 |
| `resolveCdArg(currentRel, arg)` | 解析相对/绝对路径片段。 |
| `formatPromptLabel` / `formatPromptLine` | 展示用路径与完整 prompt 行。 |

### Shell 执行：`WebContainerShellRunner`

静态方法；需传入 `WebContainer`、`xterm.Terminal`、`TerminalLogBuffer`、`WebContainerProcessRef`、`TerminalConfig` 及 stdin 引用等（与现有 demo 一致）。

| 方法 | 说明 |
|------|------|
| `abortCurrentShell(processRef, opts?)` | Ctrl-C、取消 reader、`kill` 当前进程。 |
| `runSpawn(...)` | `wc.spawn` + 输出泵 + 退出码；运行期间设置 `stdinForwardRef`。 |
| `runShellLine(wc, line, term, ring, processRef, cfg, stdinForwardRef, ...)` | 对单行执行 `sh -c`；支持 `RunShellLineOptions`（如 `noCommandEcho`、`cwd`）。 |

| 类型 | 说明 |
|------|------|
| `RunShellLineOptions` | `noCommandEcho?`、`cwd?` |
| `SpawnExtraOptions` | `cwd?`（相对容器 workdir） |

---

## 依赖版本

本包 `package.json` 声明：`@webcontainer/api`、`@xterm/xterm`。消费方通常还需直接依赖 `@xterm/addon-fit` 等（包未列出 addon，由应用按需添加）。
