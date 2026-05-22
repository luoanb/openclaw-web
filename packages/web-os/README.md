# `web-os`

面向浏览器 **WebContainer** 场景的 TypeScript 工具库：虚拟文件系统引导、工作区快照（IndexedDB）、**`ShellSession` 绿场终端**、预览 iframe 与 `server-ready` 的对接。

**入口**：从包根导入即可（本仓库通过 `"web-os": "workspace:*"` 链接）。

```ts
import { webOsRuntime, attachPreview, ShellSession } from "web-os";
```

**运行环境**：依赖 `@webcontainer/api` 与浏览器 **cross-origin isolated**（通常由 dev/preview 服务器返回 COOP/COEP 头）。**`ShellSession`** 仅依赖 WebContainer 进程流；**xterm.js** 由应用自行依赖（本包不再声明 `@xterm/xterm`）。

**契约与默认实例（`packages/` 库约定）**：交互 Shell 见 **`ShellSession`**（`src/shell/`，stdin/out 透传 + 默认 `WebContainer.spawn('jsh')`），规格见 **`docs/specs/2026-05-09_17-00_web-os-shell-greenfield.md`**。**`attachPreview`** 用法不变。

---

## 单元测试

分层策略、Vitest 工具链建议与验收契约见：**[`docs/specs/2026-05-09_16-00_web-os-unit-tests.md`](../../docs/specs/2026-05-09_16-00_web-os-unit-tests.md)**。

在仓库根目录执行：`pnpm --filter web-os test`（或本包目录下 `pnpm test`）。

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

## Shell（绿场终端，`src/shell/`）

与 **`@webcontainer/api`** 的 **`spawn`** / 进程流对接；**不**内置 xterm。

| 名称 | 说明 |
|------|------|
| `ShellSession` | `start` / `write` / `writeBytes` / `resize` / `dispose` / `onOutput` / `onExit`。 |
| `IShellSession` | 会话契约。 |
| `ShellSessionOptions` | `command`、`args`、`cwd`、`env`、`terminal` 尺寸、`output`。 |
| `DEFAULT_SHELL_COMMAND` | 默认 `jsh`。 |
| `DEFAULT_TERMINAL_DIMENSIONS` | 默认 80×24。 |

**典型用法**：`await webOsRuntime.start()` 得到 `wc` → `new ShellSession(wc)` → `onOutput` 接到 UI → `write` 接入键盘。**规格**：`docs/specs/2026-05-09_17-00_web-os-shell-greenfield.md`。

---

## 依赖版本

本包 `package.json` 声明：`@webcontainer/api`。终端渲染（xterm）与 addon 由应用按需依赖。
