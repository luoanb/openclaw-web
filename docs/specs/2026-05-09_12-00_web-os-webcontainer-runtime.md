# Web OS — WebContainer 运行时管理与启动方案

## 1. 文档定位

- **类型**：方案 / 接口边界说明（实现前评审用）。
- **受众**：产品与实现侧对齐「当前硬盘 ↔ 工作区挂载 ↔ WebContainer 单例」的职责划分。
- **与旧 Boot 的关系**：现有 **`boot.ts` / `Boot` / `bootWebContainer` 等为历史入口**，本方案 **不承认**与其 API 或行为兼容；**唯一编排契约**为 **`runtime` 模块的 `IWebOsRuntime` / `WebOsRuntime`**。旧文件在调用方迁移完成后 **删除**，不做薄封装、不做双轨导出。

---

## 2. 背景与问题

- File Manager（IndexedDB）已具备 **默认盘**（`getCurrentDriveId` / `setCurrentDriveId`）与 **按盘解析挂载树**（`resolveMountTreeForDrive`），见仓库既有规格 `docs/specs/2026-05-07_12-00_web-os-file-manager.md`。
- 若编排层仍以**固定最小模板**填充工作区，会与「持久化多硬盘 / 当前盘」产品语义割裂。
- 需要一层 **运行时编排**：把「进程内 WebContainer 单例」与「当前盘对应文件树」对齐，并支持 **换盘后重新挂载工作区**。

---

## 3. 目标与非目标

### 3.1 目标

1. **对外启动即挂载当前默认盘**：调用方使用的 **启动方法**（契约中为 **`start()`**，见 §5）须在 **单次调用** 内完成：`WebContainer.boot()` → 按 File Manager **当前默认盘** `resolveMountTreeForDrive` → `wc.mount(tree)`。集成路径 **禁止**「只启动容器、不挂盘」作为默认行为。
2. **工作区权威来源**：挂载树必须以 **`getCurrentDriveId` 对应盘** 为唯一来源（§6 种子策略另述）。
3. **换盘并挂载**：先 **`setCurrentDriveId(targetDriveId)`**，再执行与「启动后工作区状态」等价的 **重新挂载**（见 §5.4）；**不**要求与旧「仅模板 tree」行为兼容。
4. **职责收敛**：**仅**通过 **`runtime`** 模块对外提供编排能力；**不**再演进旧 `Boot`。
5. **干净挂载**：每次正式 **`wc.mount(真实树)` 之前**，须在同一挂载位置上 **先 `wc.mount` 空树**（见 §5.2）；官方无 `unmount`，**不**以 **`fs.rm` 为主路径**。
6. **WebContainer 约束**：同一页面通常 **一个** `WebContainer` 实例；「换盘」为 **复用实例并 `mount` 新树**（与官方 `mount` 语义一致）。

### 3.2 非目标（本方案不强制）

- 不在本文强制规定 **FileManagerSync** 与终端/UI 的接线顺序（仅要求运行时提供「当前盘树已挂载」这一前提）。
- 不规定导入/导出 UI 交互细节。
- **不**维持与旧 **`boot.ts`** 的符号兼容、行为兼容或并存导出策略（旧入口按迁移计划移除即可）。

---

## 4. 概念与依赖

| 概念 | 说明 |
|------|------|
| **当前盘** | `IFileManagerIdbStore.getCurrentDriveId()` 非空时的 `driveId`；持久化在 settings。 |
| **挂载树** | `resolveMountTreeForDrive(driveId)` 的合并结果（含 tip 缓存路径），与 File Manager 规格 §4.2 一致。 |
| **挂载位置** | §5.2：记录上一轮正式 **`mount` 的目标**（默认根或 **`mountPoint`**）；用于判断连续两轮是否 **同一位置**（可短路前置 **`mount({})`**）。 |
| **WC 单例** | 多次调用 **`start()`**（或内部缓存路径）返回同一已就绪实例：底层仍为 **`WebContainer.boot()`** 的 Promise 缓存 + 当前盘 **已 mount**。 |

---

## 5. 行为规格

### 5.1 与 `@webcontainer/api` 的事实关系（对齐官方）

- 官方仍为：**先** `WebContainer.boot()` **再** `mount(tree)`；**没有**对称的 **`unmount`**。清理工作区优先用 **§5.2 空树覆盖**；彻底销毁实例用 **`teardown()`**。
- 本产品对外默认 **`start()`**；由运行时在同一调用栈内完成 **`boot` →（§5.2）→ `mount(真实树)`**。

### 5.2 干净挂载（**必选**）

官方 **无 `unmount`**。本产品采用：**在每一次即将挂载「真实树」之前，先在同一挂载位置上 `mount` 一棵空树**（**`FileSystemTree` 使用 `{}`**，若使用 **`mountPoint`** 则空树与真实树 **共用同一 `mountPoint`**），作为「清空该挂载范围内上一轮内容」的手段。

**记录挂载位置**：运行时须记住 **上一轮正式 `mount` 使用的目标**（默认根、或相同的 **`mountPoint`** 字符串）。**本轮**即将挂载时：

1. **若本轮目标与上轮一致**（最常见：始终在默认工作区根、且选项一致）：可直接 **`await wc.mount({})`** 再 **`await wc.mount(真实树)`**；若实现能证明 **无需**前置空树也能达到等价干净语义（例如产品约定），允许 **短路**该前置步骤，**须在注释中写明依据**。
2. **若本轮目标与上轮不一致**（例如切换了 `mountPoint`）：分别对各目标按需在正式树之前 **`mount({})`**，或按产品约定只清 relevant 区域。

**验收心智**：连续两次 **`start()` / 换盘 / `mount`** 后，不应残留 **仅属于上一轮** 的、且位于 **同一挂载位置** 的文件（在 WebContainer 对 **`mount({})`** 的语义下成立为前提）。

**回退**：若实测 **`mount({})`** 对现有文件仅为 **合并**、无法移除遗留节点，再启用 **`fs.rm`** 或固定子目录等补救策略（实现细节，须单测）。

**`teardown()`** 后丢弃运行时内挂载位置记录。

### 5.3 `start()` —— 对外启动（默认唯一入口）

**契约**：一次调用返回的 `WebContainer` **已经**在 **§5.2 空树前置（若未短路）后** 按当前默认盘完成 **`mount(真实树)`**（若命中 §8.4 的 **import** 跳过策略，则 **不**用当前盘树覆盖导入结果，直至换盘等）。

**内部顺序（须实现等价语义）**：

1. `wc = await WebContainer.boot()`（单例 Promise 缓存，仅首次真正 boot）。
2. `await fileStore.open()`。
3. 解析 **当前盘** `driveId`（§6）；得到树 `tree = await resolveMountTreeForDrive(driveId)`（含种子盘后）。
4. 若挂载来源允许覆盖为当前盘（§8.4）：§5.2 **先空树再真实树** → 来源记 **filemanager**，并 **更新「上轮挂载位置」记录**。
5. 返回 `wc`。

**幂等**：同盘、来源已为 **filemanager** 时可短路（实现细节）；若短路，注释须说明与「空树 + 真实树」的等价关系或与 §5.2 一致的例外。「按当前盘挂载」与 **`switchDriveAndBoot`** 重复逻辑 **私有方法复用**，**不**对外暴露 `ensureWorkspace`。

### 5.4 换盘并挂载当前盘（推荐对外 API）

**语义**：`await fileStore.setCurrentDriveId(targetDriveId)` → 清除挂载短路状态 → 与 **`start()`** 共用 WC 缓存 → **§5.2** → **按新当前盘** `resolveMountTreeForDrive` + `wc.mount(真实树)`。

**命名候选**（实现时统一）：

- `switchDriveAndBoot(driveId): Promise<WebContainer>`（返回的 `wc` **已**挂上新盘树）
- 或拆成 `setCurrentDriveId` + 组合调用。

**注意**：`setCurrentDriveId` 须校验盘已注册；非法盘由 `FileManagerUnknownDriveError` 等既有错误表达。

### 5.5 `mount(wc, payload)` —— 快照 / 自定义树（非当前盘主链路）

**干什么**：在 **`start()` 已有 `wc`** 的前提下：**§5.2** → **`wc.mount(payload)`**（`FileSystemTree | ArrayBuffer`）。用于导入快照等。

**命名**：对外 **`mount`**；与 **`WebContainer#mount`** 区分：**`webOsRuntime.mount(wc, payload)`** 自带 §5.2 **再委托**。

**运行时**：来源记 **import**（§8.4）；**成功后** 更新 **挂载位置** 记录。

**可选删除**：不做导入可从 **`IWebOsRuntime`** 去掉 **`mount`**；直接调用 **`wc.mount`** 则无 §5.2 统一语义。

---

## 6. 无当前盘策略（待拍板）

以下任选其一作为「权威默认」，写入实现与契约注释：

| 方案 | 行为 | 适用 |
|------|------|------|
| **A. 自动种子盘** | `createDrive()` → `setCurrentDriveId` → `pushTreeRecord(driveId, minimalTemplateTree)` → 再 `resolveMountTreeForDrive` / mount | 零配置开箱 |
| **B. 失败** | **`start()`**（或等价启动入口）抛明确错误，由 UI 引导用户选盘/建盘 | 强约束多租户或企业场景 |

本方案 **倾向 A**（与「首次即有小模板工作区」一致），最终以评审结论为准。

---

## 7. 模块与文件布局（建议）

```text
packages/web-os/src/webcontainer/
  runtime/
    runtime.interfaces.ts    # IWebOsRuntime（唯一编排契约）
    webOsRuntime.impl.ts     # WebOsRuntime 默认实现
    index.ts                 # 聚合导出（实例 + 可选便捷函数，命名不与旧 boot 绑定）
```

**遗留删除**：`boot.ts`、`boot.interfaces.ts`（及旧导出链）在仓库内完成迁移后 **删除**，不在本方案中保留适配层。

**依赖方向**：`runtime` → `fileManager`（接口与实现）；`fileManager` **不**依赖 `runtime`。

---

## 8. 契约设计

本节为 **对外边界** 的单一真相源；实现须与之类型一致，注释可与本文同步引用。

### 8.1 分层与依赖

```text
调用方（应用 / demo）
    → IWebOsRuntime / WebOsRuntime（唯一入口：webcontainer/runtime）
        → IFileManagerIdbStore（File Manager）
        → @webcontainer/api（WebContainer）
```

- **编排契约**：仅 **`IWebOsRuntime`** —— 描述 WC 单例、工作区挂载、换盘与 `fileStore` 暴露；**不**继承、不别名旧 **`IBoot`**。
- **持久化层**：`IFileManagerIdbStore` —— 以 `fileManager.interfaces.ts` 为准。

### 8.2 `IWebOsRuntime`（唯一对外编排契约）

路径：`packages/web-os/src/webcontainer/runtime/runtime.interfaces.ts`。

以下成员 **自成一体**；旧 **`boot.interfaces.ts` / `IBoot`** 随 **`boot.ts` 一并废弃**，不在本文维护。

| 成员 | 契约语义 |
|------|----------|
| `readonly fileStore` | 与本运行时绑定的 `IFileManagerIdbStore`（构造注入或默认 `FileManagerIdbStore`）；会话级单例。 |
| **`start()`** | **默认集成唯一入口**：单次调用内完成 `WebContainer.boot()`（单例缓存）+ §5.2 + 按 **当前默认盘** `resolveMountTreeForDrive` + **`wc.mount(真实树)`**；返回 **已挂载当前盘工作区**的 `WebContainer`。 |
| `mount(wc, payload)` | **可选**：§5.5；先 §5.2 **前置空树**（若未短路）再 **`wc.mount`**；来源 **import**；不做导入可从契约删除。 |
| `switchDriveAndBoot(driveId)` | `setCurrentDriveId(driveId)` → 清除挂载短路 → 与 **`start()`** 共用 WC 缓存并完成新当前盘 **mount**；返回 `WebContainer`。 |

**说明**：

- **不**将旧 **`Boot.ensureWorkspace`** 纳入契约；「按当前盘挂载」仅通过 **`start()`** / **`switchDriveAndBoot`**，重复逻辑用私有方法实现。
- 对外 **不提供**单独的「只 `boot`、不挂盘」推荐路径；**`WebContainer.boot()`** 仅作 **`start()` / `switchDriveAndBoot`** 的内部步骤。

```typescript
// runtime.interfaces.ts —— 形状示意
import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import type { IFileManagerIdbStore } from "../fileManager/fileManager.interfaces";

export interface IWebOsRuntime {
  readonly fileStore: IFileManagerIdbStore;

  /** 启动 WC 并挂载当前默认盘（单次调用）。 */
  start(): Promise<WebContainer>;

  mount(
    wc: WebContainer,
    payload: FileSystemTree | ArrayBuffer,
  ): Promise<void>;

  /** 命名可替换为 switchDriveAndRemountWorkspace 等，见 §11 */
  switchDriveAndBoot(driveId: string): Promise<WebContainer>;
}
```

### 8.3 实现类与默认单例

| 符号 | 角色 |
|------|------|
| `WebOsRuntime` | `implements IWebOsRuntime`；`constructor(fileStore?: IFileManagerIdbStore)`，省略则 `new FileManagerIdbStore()`。 |
| `webOsRuntime` | **模块级默认单例** `new WebOsRuntime()`；调用方以此为唯一默认入口（**无**与旧 `Boot` / `webOsBoot` 的委托关系）。 |

**便捷函数（可选）**：若包内需顶层函数，建议 **`startWebOs()`** 等 **指向 `start()`** 的新名，**禁止**复用 `bootWebContainer`；亦可仅导出 `webOsRuntime.start`。

### 8.4 错误、前置条件与挂载来源

**错误传播（不吞）：**

- `FileManagerUnknownDriveError`：`setCurrentDriveId(driveId)` 且盘未注册。
- `InvalidSnapshotError` / `IdbQuotaError` 等：来自 File Manager 写路径。
- `WebContainer.boot()` / `wc.mount()`；若 §5.2 回退使用 **`fs.rm`**，其错误同样 **不吞**。

**挂载来源（实现约束，可不导出类型）：**

| 来源 | 含义 | 对 **`start()`** 的影响 |
|------|------|-------------------------------|
| `filemanager` | 最近一次成功来自当前盘的 `resolveMountTreeForDrive` + `mount` | 同 `driveId` 可短路 |
| `import` | 最近一次为运行时 **`mount`**（§5.5） | **`start()`** **跳过**用当前盘覆盖，直至 `switchDriveAndBoot` 或另行约定 |

### 8.5 `switchDriveAndBoot` 后置保证

- `await fileStore.getCurrentDriveId()` **等于**传入的 `driveId`（在 `setCurrentDriveId` 成功完成后）。
- 返回的 `WebContainer` 与 **`start()`** 在同一会话内为 **同一实例**（共用 boot 单例缓存）。
- 容器文件树与 `resolveMountTreeForDrive(driveId)` **一致**（在 §6 种子策略成立的前提下）。

### 8.6 包导出约定

- **`packages/web-os/src/webcontainer/runtime/index.ts`**：导出 `IWebOsRuntime`、`WebOsRuntime`、`webOsRuntime`；按需导出便捷函数（新命名）。
- **`packages/web-os/src/index.ts`**：以 **`export * from "./webcontainer/runtime"`** 作为 WebContainer 编排的公开面；**移除**对旧 **`boot`** 的导出（在迁移完成后一次性删除旧文件同步执行）。
- **`fileStore`**：通过 `webOsRuntime.fileStore` 访问；不扁平化复制 `IFileManagerIdbStore` 方法。

### 8.7 遗留符号处理（迁移约束）

| 遗留 | 处理 |
|------|------|
| `boot.ts`、`Boot`、`webOsBoot`、`bootWebContainer`、`ensureWorkspace`（顶层）、`mountImportedWorkspace`（顶层）、`boot.interfaces.ts`、`IBoot`、`IWebOsBoot` | **废弃 → 删除**；迁移期若存在顶层 `mount` 别名须与 **`IWebOsRuntime.mount`** 区分 |

---

## 9. 风险与约束

- **IndexedDB 不可用**（SSR、隐私模式限制）：**`start()`** 会失败；与 File Manager 一致，需在应用层降级或延迟到浏览器环境。
- **空盘无记录**：`resolveMountTreeForDrive` 对无记录盘返回空树 `{}`；若采用 §6 方案 A，应用 **push 最小模板** 或接受空挂载（需拍板）。
- **大量重复 mount**：频繁切换盘可能对 WC 内进程有影响；产品侧可加重试/防抖，本文仅要求语义正确。
- **§5.2 空树语义**：若 **`mount({})`** 实际为 **合并**而非清空，会导致遗留文件；须用集成测试验证，必要时走 §5.2 **回退**（`fs.rm` 等）。
- **`mountPoint` / 位置记录错误**：短路判断失误可能导致跳过前置空树；须在实现中固定比较规则并测试。

---

## 10. 验收标准（方案落地后）

1. 设置当前盘为 D1 → **仅调用 `webOsRuntime.start()`** → 容器内文件树与 `resolveMountTreeForDrive(D1)` 一致（且中途无需应用再单独调用挂载）。
2. `switchDriveAndBoot(D2)` → 容器树切换为 D2 的解析结果；`getCurrentDriveId() === D2`。
3. **若契约保留 `mount`**：`mount` 后，在未换盘前，**`start()`** 行为符合 §5.5 / §8.4（不静默覆盖导入或明确约定覆盖）。若已删除 **`mount`**，本条不适用。

---

## 11. 开放问题（评审清单）

1. **无当前盘**：采用 §6 **A** 还是 **B**？
2. **导入快照**：导入后是否必须 **写回当前盘的 `pushTreeRecord`**（与 Sync 打通），还是仅内存挂载直至用户保存？
3. **命名**：`switchDriveAndBoot` 是否误导（实际多为 remount）？是否改名为 `switchDriveAndRemountWorkspace`？
4. **`mount(wc, payload)`**：产品是否做「快照 / 自定义树」？不做则从 **`IWebOsRuntime`** 删除（§5.5）。

---

## 12. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-05-09 | 初稿：运行时 + 当前盘挂载 + 换盘流程，供方案对齐 |
| 2026-05-09 | 补充 §8 契约设计：`IBoot` / `IWebOsRuntime`、错误与挂载来源、包导出约定 |
| 2026-05-09 | **§5.2 修订**：干净挂载以 **`mount({})`** 为主；**同一挂载位置**可简化/短路；**`fs.rm`** 仅作空树无效时的回退 |
| 2026-05-09 | **落地**：`packages/web-os/src/webcontainer/runtime/`（`WebOsRuntime`、`webOsRuntime`、`switchDriveAndBoot`）；删除 **`boot.ts` / `boot.interfaces.ts`**；demo 改用 **`webOsRuntime.start()` / `mount()`** |
