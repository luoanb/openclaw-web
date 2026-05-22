# `packages/web-os` — 单元测试技术方案

## 1. 文档定位

- **类型**：测试策略与工程化方案（实施前评审用；实现与 CI 接入以本文验收条目为准）。
- **受众**：维护 `web-os` 包的开发与 CI；与既有 File Manager、Runtime、终端规格交叉时以 **各专题 Spec 为行为真相**，本文为 **测试分层与覆盖边界** 的补充。
- **范围**：仅针对 **`packages/web-os`** 源码树内的可测单元与协作级测试；**不**替代浏览器内 WebContainer 真机验证或 Demo E2E。

---

## 2. 现状摘要

| 项 | 现状 |
|----|------|
| 包管理 | `pnpm` workspace；`web-os` 为 `"type": "module"`，依赖 `@webcontainer/api`（**不再**依赖 `@xterm/xterm`，xterm 仅应用侧）。 |
| 测试基础设施 | 包内 **无** `test` 脚本与 Vitest/Jest；工作区根 **未** 统一接入 Vitest。 |
| 其他包参考 | `packages/browser-deps-audit` 使用 Node 内置 `node --test`（本包优先 **Vitest**，见 §5）。 |
| 源码形态 | 纯 TS：文件系统校验与合并、**Shell**、预览订阅、Runtime + IndexedDB 存储等；**可测性差异大**，须分层（§4）。 |

---

## 3. 目标与非目标

### 3.1 目标

1. 建立 **`packages/web-os` 可重复的自动化测试入口**（本地与 CI 均可一键执行）。
2. **优先覆盖无浏览器 boot 成本**的纯逻辑：文件树断言与合并、快照记录校验、**Shell 会话 Mock** 等，降低回归成本。
3. 对 **预览胶水**、**IndexedDB 存储** 等采用 **假实现 / 假环境**，避免把「集成测试」误标为单元测试。
4. 文档化 **不测清单** 与替代验证手段（§8），避免团队对覆盖率产生错误预期。

### 3.2 非目标

- 不在本文强制规定 **Demo 应用**（如 `demos/webcontainer-openclaw`）的 E2E 工具选型。
- 不要求在单元测试任务中 **真实 `WebContainer.boot()`** 或依赖 **cross-origin isolated** 页面（此类归入集成 / 手测 / Playwright 等）。
- 不替代既有 **`docs/specs/2026-05-07_12-00_web-os-file-manager.md`**、**`docs/specs/2026-05-09_12-00_web-os-webcontainer-runtime.md`** 等中的行为定义；测试用例须与 Spec 一致，**Spec 与代码冲突时先修 Spec 再修代码**（仓库约定）。

---

## 4. 分层测试策略（按源码域）

### 4.1 文件系统与快照（`src/webcontainer/fileSystem/`）— **优先级：高**

| 内容 | 建议测法 | 说明 |
|------|-----------|------|
| `assertValidFileSystemTree`（`treeGuard.ts`） | 表驱动单元测试 | 合法树、非法路径段、`directory`/`file` 键约束、symlink / contents 分支、`InvalidSnapshotError` 信息。 |
| `assertSnapshotRecordPayload`、`exportKindIsImportable`（`snapshotPayload.ts`） | 分支覆盖 | 各 `exportKind` 与非法组合；与 `treeGuard` 联动。 |

**环境**：Node（Vitest `environment: 'node'`）即可。

### 4.2 文件树合并与 Tip（`src/webcontainer/fileManager/mergeTrees.impl.ts`）— **优先级：高**

| 内容 | 建议测法 | 说明 |
|------|-----------|------|
| `FileSystemTreeMerge.mergeFileSystemTrees` | 单元测试 | 空、单树、多树覆盖、目录递归合并、非目录与目录冲突时「后者覆盖」语义（对齐 File Manager Spec §4.1）。 |
| `sortRecordsBySchemaVersion`、`findTipRecord` | 单元测试 | 空数组、同 `schemaVersion` 多 `recordId` 的字典序规则。 |
| `resolveMountTreeWithCacheInfo` / 内部合并路径 | 行为测试 | `usedTipMergedTreeCache`、`anchor.mergedTree` 合法与非法回退；依赖 `assertValidFileSystemTree` 的失败路径。 |

**依赖**：`structuredClone` 与 Node 18+ 对齐（与工作区 `engines` 一致）。

### 4.3 Shell（`src/shell/`）— **优先级：高**

| 内容 | 建议测法 | 说明 |
|------|-----------|------|
| `ShellSession` | Mock `WebContainer.spawn` / 最小 `WebContainerProcess` | 透传 `write`、输出泵、`onExit` / `dispose`、默认 spawn 选项；见 `shellSession.impl.test.ts`。 |

**已移除（2026-05-09）**：原 **`src/terminal/`**（`WebContainerTerminalSession`、`TerminalCwdPrompt`、`TerminalLogBuffer` 等）已从包内删除；日志截断与 xterm 协作由应用自建（如 `demos/webcontainer-openclaw` 的 `xtermLogBuffer.ts`）。

**非目标**：`WebContainer.boot()` 全流程仍不归入单元测试强制范围。

### 4.4 预览（`src/preview/preview.ts`）— **优先级：中**

| 内容 | 建议测法 | 说明 |
|------|-----------|------|
| `WebOsPreviewAttachment.attach` | 单元测试 | 构造实现 `on('server-ready', …)` 的 **假 WebContainer**；断言 `sink` 顺序、`iframe.src`、取消订阅后不再回调。 |

**环境**：需 DOM 类型时可选用 Vitest **`happy-dom` / `jsdom`** 子环境，或仅测 sink + 假 iframe 对象。

### 4.5 运行时与 IndexedDB（`runtime/`、`fileManager/*Store*`、`workspaceTreeIdbStore`）— **优先级：中低（分阶段）**

| 内容 | 建议测法 | 说明 |
|------|-----------|------|
| IDB 读写主路径 | **fake-indexeddb**（或等价）+ Vitest 异步用例 | 覆盖 `put`/`get`/`list`/`delete` 等；注意与真实浏览器配额、`IdbQuotaError` 的差异。 |
| `WebOsRuntime` | **注入 `IFileManagerIdbStore` 假实现** | 协作级测试启动顺序与 `mount` 调用矩阵；真 **`WebContainer.boot`** 仍不在单元测试强制范围。 |

### 4.6 明确归入「非单元」或「可选集成」

- **`WebContainer.boot()`**、**COOP/COEP**、真实 iframe 预览加载。
- **换盘 / §5.2 干净挂载** 与 WC 实例完整编排：以 Runtime 专题 Spec + Demo/Playwright 为主，单元层仅测 **可注入分支**。

---

## 5. 工具链与工程化建议

| 项 | 建议 | 说明 |
|----|------|------|
| 运行器 | **Vitest** | ESM、TS、与包 `"type": "module"` 一致；后续与 Vite 类工具链统一成本低。 |
| 配置位置 | **`packages/web-os/vitest.config.ts`**（或 `.mts`） | 包内为真源；根目录 `turbo` 增加 `test` pipeline 时再聚合。 |
| 默认环境 | **Node** | 覆盖 §4.1–4.3 大部分用例。 |
| DOM / 全局 | 按需 **`environmentMatchGlobs`** | 仅 `preview`、假 Terminal 等文件使用 `happy-dom`。 |
| IDB | **fake-indexeddb** | 开发依赖写入 `packages/web-os` 或工作区根（与仓库现有 **pnpm** 约定一致即可）。 |
| 文件命名 | `*.test.ts` / `*.spec.ts` | 与 `.cursor/rules/packages-conventions.mdc` 二级后缀约定一致；可与源文件同目录，便于对照。 |

---

## 6. 实现落地顺序（执行说明）

本节描述将 §4–§5 落到代码与 CI 的**推荐执行顺序**；行为真相仍以专题 Spec 与本文件 §4 为准。

### 6.1 总体顺序

1. **先打通工具链**：在 `packages/web-os` 内配置 Vitest，默认 **Node** 环境，确保 `pnpm --filter web-os test`（或包内等价命令）稳定退出码 0。
2. **再按 ROI 写用例**：优先 **无 DOM、无 `WebContainer.boot()`** 的纯逻辑（§4.1–§4.3 中与 Node 兼容部分），以满足 §7 验收契约的前几项。
3. **最后接假环境**：预览（假 `WebContainer`）、IndexedDB（`fake-indexeddb`）、Runtime（注入假 `IFileManagerIdbStore`）；不把真实 boot 纳入必测集（§4.5–§4.6）。

### 6.2 脚手架（工程改动清单）

| 项 | 建议 |
|----|------|
| 开发依赖 | `vitest` 必选；按需 `happy-dom`（预览/DOM）、`fake-indexeddb`（存储阶段）；TypeScript 版本与 workspace 对齐。 |
| `package.json` | 增加脚本：`"test": "vitest run"`，可选 `"test:watch": "vitest"`。 |
| `vitest.config.ts` | 置于 `packages/web-os/`；默认 `environment: 'node'`；用 `environmentMatchGlobs` 仅为需要 DOM 的测试指定 `happy-dom`。 |
| TypeScript | 从 `vitest` 显式导入 `describe`/`it`/`expect`，或启用 Vitest `globals` 并与 `tsconfig` 一致，避免与现有 `noEmit` 配置冲突。 |
| Monorepo（可选） | 根目录 `turbo.json` / 根 `package.json` 聚合 `test` 任务，便于 CI；**首轮可仅包内脚本**。 |

### 6.3 用例文件组织

- 与实现同目录：`treeGuard.test.ts` 与 `treeGuard.ts` 并列，便于对照。
- **表驱动**：校验类、合并类用 `{ input, expectOk \| expectThrow }[]`，减少重复。
- **仅测公开 API**：private 方法通过公开静态方法间接覆盖；避免测试实现细节导致重构即碎。

### 6.4 分阶段实施（建议 PR 切分）

| 阶段 | 内容 | 说明 |
|------|------|------|
| **A** | Vitest 脚手架 + `treeGuard` / `snapshotPayload`（§4.1） | 打通链路；第一个 PR 可仅含脚手架 + 最小用例集。 |
| **A′** | `FileSystemTreeMerge` 与 `resolveMountTreeWithCacheInfo` 等（§4.2） | 依赖 Node `structuredClone`（≥18）。 |
| **B** | `TerminalCwdPrompt`、`TerminalLogBuffer.applyByteAndLineCap`（§4.3） | 必选；`writeCapped`/`compactToCap` 可选假 `Terminal`。 |
| **C** | `WebOsPreviewAttachment.attach`（§4.4） | 假 `WebContainer` + 假 `iframe`；按需 happy-dom。 |
| **D** | IDB、`WebOsRuntime` 与假 store（§4.5） | 可分独立 PR；协作级测试，不 boot。 |

### 6.5 刻意推迟或非单元范围

- **`WebContainerTerminalSession` 全流程**：首轮不强制；后续抽取纯函数或独立集成测试（与 §4.3「非目标」一致）。
- **真实 boot、COOP/COEP、真实 iframe 加载**：Demo 手测或 E2E（§4.6、§8）。

---

## 7. 验收契约（Done Contract）

满足下列条目即视为本方案「测试基础设施 + 首轮覆盖」落地完成：

1. **`pnpm --filter web-os test`**（或包目录下等价命令）可稳定执行退出码 0。
2. **§4.1、§4.2** 所列核心函数/静态方法具备表驱动或等价用例，且对已知非法输入有断言。
3. **§4.3** 中 `TerminalCwdPrompt` 与 `applyByteAndLineCap` 具备用例；`writeCapped` 可选第二轮补齐。
4. 文档 **§8** 与 README 交叉引用已更新（仓库「反向同步」）；若 CI 接入 turbo `test`，在 PR 描述或 CI 配置中可追溯到本 Spec 文件名。

未完成也可先行合并「仅 Vitest 脚手架 + treeGuard」等渐进 PR，但须在后续迭代补齐验收条目或在 Spec 中修订日期与范围。

---

## 8. 风险与不测清单（预期管理）

| 风险 | 缓解 |
|------|------|
| fake IndexedDB 与真实浏览器行为不一致 | 关键路径用手测或 E2E；`IdbQuotaError` 可对存储层注入失败单独测。 |
| `@webcontainer/api` 版本升级导致类型或运行时差异 | 纯逻辑测试不 boot；升级时在 Demo 做冒烟。 |
| 过度 mock 导致测试与实现耦合 | 优先测 **公开静态 API** 与 **纯函数**；会话类延后或拆辅助函数。 |

---

## 9. 相关文档与代码索引

- 包说明与对外 API：`packages/web-os/README.md`
- File Manager：`docs/specs/2026-05-07_12-00_web-os-file-manager.md`
- Runtime：`docs/specs/2026-05-09_12-00_web-os-webcontainer-runtime.md`
- 终端会话类（**已移除**，存档）：`docs/specs/2026-05-03_18-00_web-os-terminal-session-class.md`
- 包内命名与测试后缀：`.cursor/rules/packages-conventions.mdc`

---

## 10. Change Log

| 日期 | 变更 |
|------|------|
| 2026-05-09 | 初稿：分层策略、Vitest 工具链、Done Contract、风险与不测清单。 |
| 2026-05-09 | 新增 §6「实现落地顺序」：脚手架清单、分阶段 PR、推迟范围；原 §6–§9 顺延为 §7–§10。 |
| 2026-05-09 | 落地：`packages/web-os` 接入 Vitest（`vitest.config.ts`、`pnpm test`）；首轮用例覆盖 §4.1–§4.3（`treeGuard`、`snapshotPayload`、`FileSystemTreeMerge`、`TerminalCwdPrompt`、`applyByteAndLineCap`）；根目录 `pnpm test` → `turbo run test`。 |
| 2026-05-09 | 扩充 `fileManager`：`mergeTrees` 增量/回退边界、`FileManagerUnknownDriveError`、`FileManagerSync`（mock WC）、`FileManagerIdbStore`（`fake-indexeddb`）；修复 `setCurrentDriveId` 在事务未激活时 `put` 的顺序问题（先校验盘再开 settings 写事务）。 |
| 2026-05-09 | 终端：`spawn` 在会话位于 workdir 根（`cwdRel` 空）时显式传 `cwd: "."`；`TerminalCwdPrompt.normalizeCdTypography` 将 `cd..`/`cd../…` 规范为带空格后再执行 shell 与 cd-only 判定。 |
| 2026-05-09 | **`resolveCdArg`**：传入 **`workdirAbs`** 时按访客绝对路径（`/` 开头）计算相对 workdir 的 `cwdRel`，单测覆盖；**`formatPromptLabel`** 在 cwd 跃出 workdir 子树时显示访客绝对路径（不再对含 `../` 的 `cwdRel` 误做 strip）。 |
| 2026-05-09 | **`resolveCdArg(currentRel, arg, workdirAbs?)`**：相对 `cd` 在已知 **workdir** 时按交互式 shell 从**当前会话目录**解析（含 `cd ..` 离开工程目录）；恢复与会话 `cwdRel` 的合成语义，单测覆盖。 |
| 2026-05-09 | **移除 `src/terminal/`**：单元分层 §4.3 改为 **`ShellSession`**；包不再依赖 `@xterm/xterm`。 |
