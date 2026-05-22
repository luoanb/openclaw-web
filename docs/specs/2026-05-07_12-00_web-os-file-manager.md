# Web OS — `fileManager`：IndexedDB 实时同步与硬盘分区

## 1. 目标（Goal）

- 在 **保留** `packages/web-os/src/webcontainer/fileSystem/**` 的前提下，新增 **`packages/web-os/src/webcontainer/fileManager/`**，实现：
  1. **实时同步**：虚拟工作区文件变更时，将当前工作区以 **JSON `FileSystemTree`** 形式持久化到 IndexedDB（默认模式；与现有「仅导入/导出快照」解耦）。
  2. **扁平追加存储**：每次同步 **push 一条记录**；单条记录的载荷形态为 **`FileSystemTree`**（与 `@webcontainer/api` 的 `mount` / `export({ format: 'json' })` 对齐）。
  3. **硬盘（分区）模型**：命名空间化持久化；启动时 **绑定一块硬盘**；一块硬盘下可存在 **多条** `FileSystemTree` 记录；提供 **合并为单一 `FileSystemTree`** 供 Web OS / `boot` 挂载调用。

## 2. 边界（Boundary）

### 2.1 允许改动

- 新增 `fileManager/**`（类型、IDB 布局、存储类、`merge`、可选 `watch` 适配层）。
- `packages/web-os/src/index.ts`：按需 **export** `fileManager` 公共 API（与现有 `fileSystem` 并列）。
- 文档：本 spec；必要时在 `packages/web-os` README 增加一行指向（若已有 README 且合适）。

### 2.2 禁止 / 暂缓

- **不删除、不重命名** 现有 `fileSystem` 模块；导入导出对话框等仍可走旧路径，直至另有任务切换。
- **不在本任务内** 强制改造 `boot.ts` 的默认 PoC 流程；仅提供 **可被调用的 API**（例如：`resolveMountTreeForDrive(driveId)`、`attachSync(wc, driveId, …)`），应用层接入列为后续或单独 PR。
- 二进制 / zip 模式的实时同步：**不在本 spec 默认范围**（默认仅 JSON 树）；若后续需要，另开 spec 扩展记录类型。

## 3. 领域模型

### 3.1 硬盘（`HardDrive` / `driveId`）

- **`driveId`**、`recordId`：**均由存储实现内部生成**（例如 `crypto.randomUUID()`）；**调用方不得自创 ID**，仅使用 API **返回值**（`createDrive` / `copyDrive` / `listDrives`）中的 `driveId`。
- 语义：**隔离的持久化分区**；同一浏览器配置下可多块硬盘并存。
- **注册表**：独立 object store（建议名 **`drive_registry`**，`keyPath: driveId`），与 **`tree_records`** 并列；详见 §3.4、§5。

### 3.2 树记录（扁平日志）

- 每条记录至少包含：
  - `recordId: string`（主键，UUID）
  - `driveId: string`（索引键）
  - `savedAt: number`（时间戳；**审计 / 展示用**，**不作为「最新记录」或合并次序的依据**，次序以 `schemaVersion` 为准）
  - `tree: FileSystemTree`（本条追加时刻的 JSON 树快照，单次 export 产物）
  - `mergedTree?: FileSystemTree`（**可选直至首次合并**）在同一块硬盘上执行 **merge** 后，将 **全量合并结果** 写入 **当前最新树记录（tip，见下）** 的该字段；用于挂载时直接读取，避免每次启动全表扫描再算一遍。**仅由 merge 写入/更新**，与 `isCurrent` **同一时机**（§4.2）。
  - `isCurrent: boolean`：是否为 **当前合并锚点**。**仅在 merge 操作时** 与 `mergedTree` **一并** 更新（§4.2）；**追加 push 不得修改** 盘上任意记录的 `isCurrent`。同一 `driveId` 下 **至多一条** 为 `true`。
  - `schemaVersion: number`：**在同一块 `driveId` 内单调递增** 的正整数（每条 **追加** 记录分配 `max(既有同盘记录)+1`，或等价策略）。**「最新树记录」定义为：`schemaVersion` 最大的那条**（若并列再以 `recordId` 字典序决胜，正常不应并列）。合并顺序与 tip 定位均以此字段为准。若将来需单独表达「记录载荷格式版本」，可另增字段（如 `recordFormatVersion`），避免与「世代序号」混淆。
- **追加语义**：每次实时同步仍 **追加** 一条带 `tree` 的记录。**追加事务内只写本条快照字段**（如 `recordId`、`driveId`、`savedAt`、`tree`、`schemaVersion`）；**不** 修改任何既有记录的 `mergedTree` / `isCurrent`。**合并**（§4.2）才 **原地更新** `mergedTree` / `isCurrent`，不以追加新行表达合并结果。
- **仅 merge 写锚点**：`mergedTree` 与 `isCurrent` **只在 merge 流程中** 更新，**时机一致**（同一持久化步骤/事务内完成 tip 的 `mergedTree` 写入与前一条锚点的 `isCurrent` 清除）。因此在 **tip 已因追加而前进、但尚未再次 merge** 期间，盘上「带 `isCurrent`」的记录可能 **不是** `schemaVersion` 最大者——属预期态，读路径见 §4.2「启动挂载」。

### 3.3 与 WebContainer 的关系

- **挂载**：合并得到的单个 `FileSystemTree` 仍通过现有 `mountImportedWorkspace(wc, tree)` 或等价 `wc.mount(tree)` 消费。
- **实时同步**：利用官方 **`webcontainerInstance.fs.watch`**（支持目录 `recursive`）监听变更；在 **debounce**（防抖，避免 npm install 等高频写放大）后调用 `wc.export({ format: 'json', … })`（或与官方一致的 JSON 导出路径）得到完整树，校验后 **push** 一条记录。

### 3.4 硬盘管理（CRUD）— **已对齐决议**

下列行为与 **`pushTreeRecord` / `resolveMountTreeForDrive`（§4.2 写回分支）正交**：`push` **只追加树快照**，**不** 承担创建硬盘、改 meta 的职责。

#### 类型：`FileManagerDriveRecord`（注册表一行）

- **`driveId`**：`string`（内部生成，对外仅透传）。
- **`meta?`**：`Record<string, unknown>`，**可选**；宿主自定义展示/业务字段；包内不解释键语义。
- 可选实现字段：`createdAt` / `updatedAt`（便于排序；若省略则由实现约定列表顺序）。

#### 新增 `createDrive(meta?)`

- 内部生成 **`driveId`**，写入 **`drive_registry`**；**不向 `tree_records` 写入任何行**。
- 验收：`listRecords(driveId)` 返回 **`[]`**。
- 可选传入 **`meta`**，写入该硬盘条目。

#### 复制 `copyDrive(sourceDriveId)`

- 内部生成 **新 `driveId`**；**源盘每一条 `FileManagerTreeRecord`** 在目标盘复制为一条新行：
  - **`recordId`**：新生成（全局唯一）。
  - **`driveId`**：目标盘（新生成）。
  - **`schemaVersion` / `isCurrent` / `mergedTree` / `tree` / `savedAt`**：**与原行完全相同**（目标是独立盘上的**一致副本**）。
- **源盘 `meta`**：复制到目标盘 **`FileManagerDriveRecord.meta`**（与源一致；若源无 `meta` 则目标可无）。
- 源盘须存在且可为空记录列表（仅注册表无树行亦允许复制，结果仍为空盘但有自己的注册与 meta 拷贝）。

#### 删除 `deleteDrive(driveId)`

- **同一逻辑单元**（建议同一 IDB 事务）：删除 **`drive_registry`** 中该 `driveId`，并删除 **`tree_records`** 中 **`driveId` 索引下的全部行**。
- 调用方若对该盘挂了 `FileManagerSync`，须先 **`stop()`**（约定，非存储层强制）。

#### 列表 `listDrives()`

- 返回 **`FileManagerDriveRecord[]`**（至少含已注册硬盘的 `driveId` 与 `meta`）。

#### 仅改 meta：`patchDriveMeta(driveId, meta)`（命名实现可微调）

- **只更新** 该硬盘在 **`drive_registry`** 中的 **`meta`**（替换或按实现约定合并；**默认推荐整块替换**以便语义简单）；**不** 写入 `tree_records`，**不** 改变 `pushTreeRecord` 语义。

#### 当前默认硬盘 `getCurrentDriveId` / `setCurrentDriveId`

- 语义：在 **本机 IDB 域** 内持久化 **「默认选中的硬盘」** 的 `driveId`，供应用启动时决定挂载/同步哪一块；**不** 改变 `tree_records` / `merge` 算法。
- **`getCurrentDriveId(): Promise<string | null>`**：未设置或已清空时返回 **`null`**。
- **`setCurrentDriveId(driveId: string | null): Promise<void>`**：
  - 传 **`null`**：清除默认项。
  - 传 **非 `null`**：**推荐** 校验该 `driveId` 已在 **`drive_registry` 存在**，否则 **拒绝**（与 `pushTreeRecord` 规则一致）；若实现允许弱校验，须在契约中写死，避免误存孤儿 id。
- **`deleteDrive(driveId)` 补充**：若被删 `driveId` 与 **当前默认** 相同，应 **同时清除** 当前默认（或等价为 `setCurrentDriveId(null)`），避免 `getCurrentDriveId` 指向不存在的盘。

#### `pushTreeRecord` 前置条件（补充）

- **`driveId` 必须已在 `drive_registry` 中存在**（须先 **`createDrive`** 或 **`copyDrive`** 得到合法 `driveId`）。对未注册 `driveId` 调用 **`pushTreeRecord`**：**拒绝**（抛错或 Result，由实现选定并在契约固定）。

## 4. 合并算法

### 4.1 纯函数 `mergeFileSystemTrees`（内存侧）

- **输入**：同一 `driveId` 下按 **`schemaVersion` 升序**（与追加世代一致）取各条的 `tree` 得到的 `FileSystemTree[]`（可为空）。若实现侧先按 `savedAt` 过滤，须保证与 **`schemaVersion` 序** 一致，否则以 **`schemaVersion`** 为准。
- **输出**：单个 `FileSystemTree`。
- **规则**（路径级深度合并，后者覆盖前者）：
  - 根级均为「路径段 → 节点」映射；对同名键递归合并。
  - **目录 + 目录**：合并子树。
  - **文件 + 文件**：保留 **较晚（ latter ）** 一侧节点。
  - **目录 + 文件 / 文件 + 目录**：后者覆盖前者（与较晚记录一致）。
- **空列表**：返回 `{}`（须在 API 文档与实现中固定）。

#### 4.1.1 合并起点（全量 / 增量）

**`merge` 计算合并结果时**，须在下列两条路径中 **择一**（优先增量以降低重复折叠成本）；两条路径在数据一致前提下 **数学结果须相同**。

| 路径     | 何时采用                                                               | 基底                                                                                                                                                  | 再叠加的 `tree`                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **全量** | 盘上 **无** `isCurrent === true`，或锚点存在但 **`mergedTree` 未定义** | 等价于从 **空树 `{}`** 起，按 `schemaVersion` **升序** 对该盘 **全部** 记录的 **`tree`** 依次 §4.1 折叠（亦即 **从第一条记录的 `tree` 起** 参与折叠） | （已含于「全部」）                                                                                                                                                                     |
| **增量** | 盘上存在 **`isCurrent === true`**，且该条 **`mergedTree` 已定义**      | 以该条的 **`mergedTree`** 为 **唯一基底**（表示截至该锚点世代已一致的合并结果）                                                                       | 仅包含 **`schemaVersion` 严格大于** 该锚点记录之 **`schemaVersion`** 的各条记录的 **`tree`**，仍按 **`schemaVersion` 升序** 依次叠加以 §4.1 同一规则（即在基底上依次「后者覆盖前者」） |

**说明**：增量路径下，锚点记录自身的 **`tree`** 不再单独参与折叠——其贡献已凝结在 **`mergedTree`** 中；若实现错误地再次叠加锚点的 `tree`，可能导致与全量路径不一致（除非另行约定，**禁止**）。

**退避**：若增量基底缺失或不信任（损坏、校验失败），**退化为全量路径**。

**优化**：仅 **全量路径** 且每条记录均为 **全量** 导出快照时，结果才可能等价于「仅 **`schemaVersion` 最大** 的那条 `tree`」；增量路径下不适用该短路。

### 4.2 合并结果持久化（与存储字段联动）

合并不仅产出返回值，还须 **写回 IndexedDB**。**`mergedTree` 与 `isCurrent` 仅在本节流程内更新**，且 **同一持久化步骤（建议同一 IDB 事务）内** 完成，**与 append/push 解耦**。

规则如下：

1. **定位「最新树记录」（tip）**：在同一 `driveId` 下，取 **`schemaVersion` 最大** 的那条记录（若多条并列，再以 `recordId` 字典序打破平局）；**即用户语义下的「最新树记录」= `schemaVersion` 最大者**。
2. **计算合并结果 `merged`**：严格按 **§4.1.1** 选择 **全量** 或 **增量** 路径得到与 tip 对应的完整工作区树；**不得**跳过 §4.1.1 另行口径。
3. **同时写入派生锚点（与 `isCurrent` 同一时机）**：
   - 在 **tip** 上设置 `mergedTree = merged`；
   - 将 **tip** 的 `isCurrent` 设为 **`true`**；
   - 将 **此前** `isCurrent === true` 的那条记录（若存在且不是 tip）更新为 **`isCurrent: false`**（**不得**在 push 阶段做此轮换）。
4. **不变式（merge 完成后）**：同一 `driveId` 下 **至多一条** `isCurrent === true`；且该条 **必为当前 tip**（`schemaVersion` 最大者）。**merge 完成前**（仅有追加、未再 merge）允许「`isCurrent` 所指记录的 `schemaVersion` < 全盘最大」，见下。

**启动挂载（读路径）**：

- 若存在 `isCurrent === true` 的记录，且其 **`schemaVersion` 等于** 该盘 **`schemaVersion` 的最大值**（即该条即为 tip），且 **`mergedTree` 已定义**：可直接使用其 `mergedTree` 挂载。
- 若 **`isCurrent` 所指不是 tip**（盘上已有更大 `schemaVersion` 的追加记录、尚未 merge）：**不得**单独使用锚点上的过时 **`mergedTree`** 作为完整挂载树；应 **按 §4.1.1 增量路径**（以 `isCurrent.mergedTree` 为基底 + 叠加大于锚点 `schemaVersion` 的各条 `tree`）现场算出完整树，或 **先执行 merge** 再读 tip 上新的 `mergedTree`。允许 **全量路径** 校验同一结果。
- 若无 `isCurrent` 或无可用 `mergedTree`（例如从未 merge）：按 **§4.1.1 全量路径** 现场合并或按产品冷启动流程。

**挂载解析写回**：`FileManagerIdbStore.resolveMountTreeForDrive(driveId)` 在 **不能** 直接使用 tip 上已与 tip 对齐的 `mergedTree`（上述快路径）时，已在内存侧完成 §4.1.1 合并；**须在返回前** 执行 §4.2 **原子写回**（`tip.mergedTree`、`tip.isCurrent`、旧锚点清除）。否则每次启动都会重复全表折叠，违背派生字段缓存语义。快路径仅 **读取** tip.`mergedTree`，**不得**为此触发写库。

**说明**：`mergedTree` 是 **派生数据**，真相序列仍是按条追加的 `tree`；合并写回用于加速启动。**增量合并**（§4.1.1）以锚点 `mergedTree` 为起点时，须与 **从第一条起全量折叠** 结果一致；重建或校验时可任选一路径。

## 5. IndexedDB 形状（建议）

- **数据库名**：可与现有 `WORKSPACE_IDB_NAME` 区分或共用同一 DB 不同 object store——本阶段推荐 **独立 DB 名常量**（例如 `openclaw-wc-file-manager`），避免与旧 `snapshots` store 升级逻辑纠缠；若团队倾向单 DB，需在实现注释中写明 **版本迁移** 责任。
- **`tree_records`**：`keyPath: 'recordId'`，字段含 §3.2 所列（含 `mergedTree`、`isCurrent`）。
- **`drive_registry`**：`keyPath: 'driveId'`，字段含 §3.4 **`FileManagerDriveRecord`**（至少 `driveId`、可选 `meta`；可选时间字段）。
- **`settings`**（建议名，或等价的 **KV 单条** store）：`keyPath: 'key'`，至少存一条 **`{ key: 'currentDriveId', value: string }`**；**无该键** 时视为未设置。实现亦可采用 **单 key 的 object store 仅放一条记录** 等变体，**语义** 与 `get`/`set` 一致即可。

- **DB 版本**：引入 **`drive_registry`** 时递增版本号；若已有仅含 `tree_records` 的库，迁移时需 **按 `tree_records` 中出现过的 `driveId` 回填注册表**（无 `meta`，或由实现约定占位），以满足 §3.4 **`pushTreeRecord` 前置条件**（可选策略：允许旧库首次打开时一次性回填）。
- **索引（`tree_records`）**：
  - `driveId`（非唯一）：列举某盘全部记录、合并输入。
  - `schemaVersion`（非唯一）：确定 tip、合并次序；可选 **复合索引 `(driveId, schemaVersion)`** 便于查每盘最大世代。
  - `savedAt`（非唯一）：仅作辅助诊断 / 展示；**不作为「最新记录」判定**（以 `schemaVersion` 为准）。
  - 可选：`isCurrent`（非唯一）或与 `driveId` 的复合查询策略——便于找到当前锚点；若库存量小，也可在 `driveId` 范围内过滤 `isCurrent === true`。

## 6. 对外 API（草案，实现时可微调命名）

以 **类为主**（符合包约定），例如：

- `FileManagerIdbStore`：`open()` / `close()`；
  - **硬盘**：`createDrive(meta?) → Promise<driveId>`、`copyDrive(sourceDriveId) → Promise<newDriveId>`、`deleteDrive(driveId)`、`listDrives()`、`patchDriveMeta(driveId, meta)`（仅注册表）；
  - **默认盘**：`getCurrentDriveId() → Promise<string | null>`、`setCurrentDriveId(driveId | null)`（§3.4）；
  - **树**：`pushTreeRecord(driveId, tree)`（**要求** `driveId` 已在注册表；**不** 写 `mergedTree` / `isCurrent`）、`listRecords(driveId)`、`resolveMountTreeForDrive(driveId)`（挂载：**tip `mergedTree` 快路径则只读**；否则 §4.1.1 计算并在返回前 §4.2 写回，见 §4.2「挂载解析写回」）。
- `FileManagerSync`（或等价）：`start(wc, driveId, options?: { debounceMs; exportRootPath })`、`stop()`：注册 `fs.watch`、防抖导出、调用 `pushTreeRecord`。
- `FileSystemTreeMerge`（**仅 static**）：`mergeFileSystemTrees`、`sortRecordsBySchemaVersion`、`findTipRecord`、`computeMergedForDrive`、`resolveMountTree`、`resolveMountTreeWithCacheInfo`（纯内存；是否写库由 `FileManagerIdbStore` 决定）；**不** 再于包入口提供同名的顶层函数式导出，避免与「类为主」的 API 重复。

公开类型放入 `*.interfaces.ts` 或 `types.ts`，错误类复用或对齐 `fileSystem/errors` 风格。

## 7. 验收（Done Contract）

1. **存在** `packages/web-os/src/webcontainer/fileManager/` 下可编译实现；`fileSystem` 目录未被移除。
2. **push**：可向指定 `driveId` 追加一条含 `FileSystemTree` 的记录并在 IDB 中可读回；**且不** 更改既有记录的 `mergedTree` / `isCurrent`。
3. **挂载解析与 §4.2 写回**：`resolveMountTreeForDrive` 在慢路径按 **§4.1.1** 计算合并树，且 **写回** §4.2：`tip.mergedTree`、`tip.isCurrent = true`、原 `isCurrent` 记录置 `false`；空硬盘行为与 §4.1 约定一致。
4. **读锚点**：在 **最近一次 §4.2 写回之后**（`isCurrent` 与 tip 一致时）能通过 `mergedTree` 走快路径挂载；且 **push 从不单独改写** `isCurrent`/`mergedTree`。
5. **同步**：`start` 后在模拟文件变更（或集成测试中 mock watch 回调）能在防抖后触发 **至少一次** push（或在测试中直接调用内部「导出并 push」路径并验证记录条数递增）。
6. **校验**：push 前对树执行与现有模块一致的校验（可 **复用** `assertValidFileSystemTree` 从 `fileSystem/treeGuard` 导入，避免重复实现）；`mergedTree` 写入前同样须满足有效树形状。
7. **硬盘 CRUD**：`createDrive` 后 `listRecords` 为空；`copyDrive` 产生新 `driveId` 且树字段按 §3.4 逐条复制（新 `recordId`）；`deleteDrive` 后注册表与对应树行均不存在；`listDrives` / `patchDriveMeta` 行为与 §3.4 一致。
8. **默认盘**：`getCurrentDriveId` / `setCurrentDriveId` 与 §3.4、`settings` store（§5）一致；删盘时若命中当前默认则清除。

## 8. 验证方式（Validation）

- `pnpm` 在 `packages/web-os` 下执行类型检查 / 单元测试（若包内已有脚本）；若无测试基础设施，至少 **`tsc --noEmit`** 或 monorepo 约定的 `lint` 通过。
- 手动：在 demo 中临时挂载 `FileManagerSync`（可选，非本任务强制交付）。

## 9. 风险与开放问题

- **高频写**：必须 debounce；必要时合并窗口内只保留最后一次导出。
- **配额**：大仓库 JSON 导出体积；沿用 `IdbQuotaError` 类似处理。
- **Watch 根路径**：默认监听工作区根（与 `exportRootPath` / `workdir` 对齐），需在实现中与现有 `EXPORT_ROOT_PATH` 语义一致。
- **锚点滞后**：仅追加、长期不 merge 时，`isCurrent` 仍指向旧 tip，tip 上尚无新鲜 **`mergedTree`**；挂载侧 **必须** 按 §4.2「启动挂载」分支：**增量** 或 **全量** 现场合并，**不得**仅使用锚点 `mergedTree` 而忽略其后的 `tree`。

## 10. Change Log（实现后回写）

- **实现**：`packages/web-os/src/webcontainer/fileManager/`（`FileManagerIdbStore`、`FileManagerSync`、`FileSystemTreeMerge` / `mergeTrees.impl.ts`）；IDB 名 **`openclaw-wc-file-manager`**，store **`tree_records`**、**`drive_registry`**、**`settings`**（§5）。
- **导出**：`web-os` 包入口已 `export *` 上述模块。
- **2026-05-06**：§3.4 硬盘 CRUD 决议：`driveId`/`recordId` 库内生成；`createDrive` / `copyDrive` / `deleteDrive` / `listDrives` / `patchDriveMeta`；复制语义见 §3.4；`pushTreeRecord` 须已注册 `driveId`。
- **2026-05-06**：**默认盘** `getCurrentDriveId` / `setCurrentDriveId`，持久化见 §5 **`settings`**；删盘清除默认。
- **2026-05-07**：§4.2 补充「挂载解析写回」：`resolveMountTreeForDrive` 在慢路径返回前须 §4.2 写回；`FileSystemTreeMerge.resolveMountTreeWithCacheInfo` 暴露是否命中 tip 缓存供存储层分支。
- **2026-05-07**：移除独立 `mergeDriveToBootTree` API；合并写回仅经 `resolveMountTreeForDrive` 慢路径触发（快路径不重算、不写库）。
- **2026-05-07（执行）**：`FileManagerIdbStore` 实现 `createDrive` / `copyDrive` / `deleteDrive` / `listDrives` / `patchDriveMeta`、`getCurrentDriveId` / `setCurrentDriveId`；`pushTreeRecord` / `listRecords` / `resolveMountTreeForDrive` / `setCurrentDriveId`（非 null）前校验注册表；DB **v2** 含 `drive_registry` + `settings`，v1→v2 自 `tree_records` 回填盘表；`FileManagerUnknownDriveError`。
