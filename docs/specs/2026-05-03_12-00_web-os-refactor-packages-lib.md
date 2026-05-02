# SDD Spec: `web-os` 按 packages 库新规重构

## 执行摘要（重构方案一览）

**目标**：在不破坏 `import { … } from "web-os"` 的消费体验前提下，使 `packages/web-os` 对齐 `.cursor/rules/packages-lib.mdc`——**域目录优先**、**`{stem}.contracts.ts` + `{stem}.ts` 词干一致**、`src/index.ts` **薄聚合**、公开 API **JSDoc/TSDoc**、含状态逻辑 **class** 封装。

**三条主线**：① **Preview** 升为 `src/preview/`；② **Boot** 点分契约与实现文件名、`IBoot`/`Boot` 规范真名 + 历史符号别名；③ **Terminal** 抽出点分契约文件，实现侧 `import type` 依赖契约。

**默认决议（§0）**：已在下文锁定推荐选项；若产品与架构另有约束，可在 Execute 前一行改动并复述影响面。

**准入**：本轮 Execute 已完成；后续结构性变更仍应先更新本 spec 再改代码。

## 元数据

| 字段 | 值 |
|------|-----|
| **phase** | Execute → Review（本轮已实现 P0–P1 主体） |
| **spec path** | `docs/specs/2026-05-03_12-00_web-os-refactor-packages-lib.md` |
| **规则依据** | `.cursor/rules/packages-lib.mdc`（与 `project.mdc` 中 `core/**` 类编程约定对齐） |
| **active_project** | `packages/web-os` |
| **change_scope** | local |

---

## Done Contract（完成定义）

| 维度 | 完成标准 |
|------|----------|
| **结构** | Preview 迁入 `src/preview/`；Boot 使用 `boot.contracts.ts` + `boot.ts`（合并或迁入原 `WebOsBoot.ts` 实现）；Terminal 具备选定方案下的 `*.contracts.ts`。 |
| **导出** | `packages/web-os/src/index.ts` 仍为聚合入口；自 `"web-os"` 导入的符号集合与语义与重构前一致（允许新增别名、`@deprecated`）。 |
| **文档** | `packages/web-os/README.md` 中路径与对外 API 描述与代码一致；公开契约带 TSDoc。 |
| **验证** | `pnpm exec tsc -p packages/web-os`（或仓库等价命令）通过；全仓无 `web-os/src` 深层路径依赖（当前 grep 为 0，应保持）。 |

---

## 0. Open Questions → 默认决议（可覆盖）

| 议题 | 默认决议 | 理由 |
|------|----------|------|
| **Preview 域目录名** | 采用 **`src/preview/`**；单文件 **`preview.contracts.ts`** + **`preview.ts`**（词干一致）。未来若多策略再拆 `preview/attachment/` 等子域。 | 符合「变大升为域目录」；避免过早创建空子目录。 |
| **Terminal 契约拆分** | **Option B（推荐）**：`config.contracts.ts`、`cwdPrompt.contracts.ts`、`shellRunner.contracts.ts` 与现有 **`config.ts` / `cwdPrompt.ts` / `shellRunner.ts`** 同词干；**`refs.ts`、`logBuffer.ts`** 仍以实现为主（其中若有单独对外 `interface`，再按需补 **`refs.contracts.ts`** 等，非 P0）。 | 与 Boot 同一心智模型；契约粒度与文件边界清晰。 |
| **fileSystem 对外 surface** | **P2**：优先在 **`fileSystem/types.ts`**（或现有导出集中处）为公开数据结构补全 **TSDoc**；若评审认定「快照/IDB 输入输出」需独立契约面，再引入 **`fileSystem.contracts.ts`** 迁移类型声明（仍避免行为变更）。 | 平衡工作量与「契约文件化」；避免一次性大搬家无增量价值。 |
| **Preview 接口命名** | **非 Breaking**：新增 **`IWebOsPreviewAttachment`** 为推荐名；**`IPreviewAttachment`** `@deprecated` 指向新名；类 **`WebOsPreviewAttachment`** 保持类名稳定，`implements` 对齐推荐接口名。 | README 已强调 `WebOs*` 前缀；类型名逐步对齐规范。 |

---

## 1. Requirements (Context)

### Goal

在**不改变对外行为与默认导出形状**（或仅允许经版本说明的显式 Breaking Change）的前提下，使 `packages/web-os` 的目录结构、契约落盘位置、命名对齐与文档注释符合 **`packages-lib.mdc`**，并为后续消费方与测试替身提供清晰的「接口面」。

### In-Scope

- 目录：域优先；将根目录 `preview*` 迁入 `preview/`；`index.ts` 保持薄聚合导出。
- 契约：**`{stem}.contracts.ts`** 与 **`{stem}.ts`**（或同词干的 `Pascal` 实现文件名，包内统一）同域、**词干 ↔ `I{Pascal}` ↔ `{Pascal}`** 对齐；**纠正现状**：当前 `bootContracts.ts` + `WebOsBoot.ts` + `IWebOsBoot`/`WebOsBoot` **不符合**推荐三元（见 §2.1.4）；目标为 `boot.contracts.ts` + `boot.ts` + `IBoot`/`Boot`，历史名通过 `index` 别名与 README 迁移说明消化。
- 注释：凡构成公开 API 的导出（契约类型、选项对象、公开类方法）补齐 **JSDoc/TSDoc**，与 `README.md` 可交叉印证。
- 编码风格：可复用、含状态或生命周期的逻辑保持 **class** 封装；契约侧面向接口编程。
- 文档：**README** 与导出路径同步更新（Spec is Truth：文档与代码冲突时先修文档再改代码的纪律在本任务中落实为「Plan 中先列 README 变更项」）。

### Out-of Scope

- 修改 `@webcontainer/api` / `@xterm/xterm` 版本范围（除非契约重构暴露类型不兼容）。
- 应用层（`apps/claw-container` 等）的大规模调用改写；默认要求 **路径重导出** 或 **兼容层** 使 `import { … } from "web-os"` 保持稳定。
- 引入 `src/shared/` 除非执行阶段发现确有跨域、无业务语义的重复（当前可不预设大段搬迁）。

---

## 1.1 Context Sources

- **规则**：`.cursor/rules/packages-lib.mdc`
- **现状说明**：`packages/web-os/README.md`
- **代码事实**：`packages/web-os/src/**/*.ts`（见下文 Research）

---

## 1.5 Codemap Used

- **Codemap Mode**：`feature`（单包能力梳理）；若需全 monorepo 架构索引可另跑 `project`。
- **Codemap File**：**未生成**。`create_codemap` 落盘须符合 SDD 命名，**不得**省略 `功能` / `项目总图` 后缀；其中 **`<feature>` / `<project>` 为简短可读的功能或项目名**（技能 `usage-examples` 如 `访问审批链路功能.md`、`sample-enterprise项目总图.md`），**不是**把本 spec 文件名 `2026-05-03_12-00_web-os-refactor-packages-lib` 去 `.md` 后整段当作 `<feature>`；时间戳以**实际生成 codemap 的时刻**为准，不必与 spec 文件前缀一致。
  - **feature**：`docs/codemap/YYYY-MM-DD_hh-mm_<feature>功能.md`  
    示例（仅说明命名形态）：`docs/codemap/2026-05-03_14-30_web-os按packages-lib对齐功能.md`
  - **project**：`docs/codemap/YYYY-MM-DD_hh-mm_<project>项目总图.md`  
    示例：`docs/codemap/2026-05-03_14-30_web-os项目总图.md`
- **以下为 Research 轻量索引**（非 codemap 正式产物；路径为仓库内**可定位**的 `packages/web-os/...`，反映**重构前**现状）。

| 域 / 路径 | 角色 |
|------------|------|
| `packages/web-os/src/index.ts` | 包入口聚合导出（已较薄） |
| `packages/web-os/src/preview.ts` + `packages/web-os/src/previewContracts.ts` | 预览附着：契约与实现分居包根 `src/` 下，**不符合**「契约与实现同域目录」的长期形态 |
| `packages/web-os/src/webcontainer/boot.ts`、`WebOsBoot.ts`、`bootContracts.ts` | Boot：**域划分合理**，但 **命名三元与点分契约文件名未对齐规范**（见 §2.1.4） |
| `packages/web-os/src/webcontainer/fileSystem/*` | 快照、IDB、校验：实现为主；`types.ts` 含公开数据结构 |
| `packages/web-os/src/webcontainer/workspaceConstants.ts` | 工作区常量：属 webcontainer 域，可保留 |
| `packages/web-os/src/terminal/*` | 终端：`config.ts` / `cwdPrompt.ts` / `shellRunner.ts` 含对外契约型 `interface`；**`refs.ts`、`logBuffer.ts`** 为实现与缓冲，**缺少**与前三者同词干的 `*.contracts.ts`（点分契约） |

---

## 1.6 Context Bundle Snapshot

- **Bundle Level**：Lite（本任务由规则 + 包内源码直接推导）
- **Key Facts**：
  - `packages-lib` 要求 `src/index.ts` 只做聚合；禁止契约长期散落根目录而与实现域脱节。
  - 对外导出须有注释；README 为 API 说明权威之一。
- **默认决议**：见 §0（Open Questions 已收敛为可覆盖的默认选项）。

---

## 2. Research Findings

### 2.1 与 `packages-lib` 的差距（事实）

1. **Preview 能力仍位于 `src/` 根**  
   `previewContracts.ts` 与 `preview.ts` 并列于 `src/`，而规范推荐能力域为 `src/<domain>/`。规范原文：「交叉能力很小可放单个模块文件；**一旦变大，升为 `preview/` 域目录**」。当前 Preview 已含契约 + 实现类 + 单例 + 便捷函数，**宜升为 `preview/`**。

2. **Terminal 域缺少独立契约文件**  
   `ITerminalConfigLoader`、`ITerminalCwdPrompt`、`IWebContainerShellRunner` 与实现混在同一 `.ts` 中，不满足「契约与实现同域、契约在 `*.contracts.ts`」的推荐形态，也不利于「先契约后实现」的评审顺序。

3. **契约注释覆盖不完整**  
   `previewContracts.ts` 中 `IPreviewAttachment` 有注释；`PreviewStatus` / `PreviewStatusEvent` 等公开类型缺少字段级或联合语义说明。`bootContracts.ts` 接口有简要说明，方法级边界（幂等、并发、错误）可加强。执行阶段需按「公开表面」清单逐项补齐。

4. **命名三元：此前结论错误，本条为更正**  
   - **不能**把「文件名里含有 `boot` 子串」等同于「词干 `boot` 已对齐」：`bootContracts.ts` 的词干习惯上记为 `bootContracts` 或至少 **不是** 规范推荐的 **`boot.contracts.ts`**；实现文件为 **`WebOsBoot.ts`**（词干呈 `WebOsBoot`），又与 `boot*` 文件名 **不一致**。  
   - **类型侧**：`IWebOsBoot` / `WebOsBoot` 是 **包级前缀 + Boot**，与规范「简便规则」中的 **`IBoot` / `Boot`** 不是同一套符号；若坚持前缀在类型名上，则与 **`boot.ts` + `Boot` 类** 的推荐成对关系冲突，**应以规范真名为 `IBoot`/`Boot`，`WebOs*` 仅作导出别名**（见 `packages-lib` 已 Reverse Sync 的段落）。  
   - **规范与历史**：`packages-lib.mdc` 曾同时出现 `bootContracts`+`IWebOsBoot` 与 `boot.contracts`+`IBoot` 两种叙述，**已以点分契约 + 词干三元为准** 合并修订；`web-os` 重构的 **模板范例** 应改为 **`shellRunner.contracts.ts` ↔ `IWebContainerShellRunner`** 等是否再缩词干（另议），**Boot 能力** 则以 **`boot.contracts.ts` ↔ `IBoot` ↔ `boot.ts` 内 `Boot`** 为目标态。

5. **`IPreviewAttachment` 与 `WebOs` 前缀**  
   README 已描述 `WebOsPreviewAttachment`；契约接口名为 `IPreviewAttachment`。规范鼓励包级前缀一致。**§0 已锁定**：新增 **`IWebOsPreviewAttachment`** 为推荐名；**`IPreviewAttachment`** 保留并 **`@deprecated`**，与 README 同步。

### 2.2 风险

| 风险 | 缓解 |
|------|------|
| 移动文件导致应用 deep import 断裂 | 包 `exports` 仅 `"."`；仍应全仓 grep `web-os/src` 非法路径；保持从 `"web-os"` 入口导入 |
| 契约拆分产生循环依赖 | 契约文件仅类型 import；实现文件 `import type` 从 `*.contracts.ts` |
| 重命名公开接口 | 优先非 Breaking：保留旧名 re-export + JSDoc `@deprecated` |

### 2.3 Next Actions（Execute 前）

- 若需偏离 §0 **默认决议**（如 Terminal 改 Option A），先在 §7 / §8 旁注或更新 §0 表格，避免执行中口径漂移。
- 用户发送精确字样 **`Plan Approved`** 后进入 Execute，并按 §4.3 checklist 与 §4.1.2 里程碑实施。

---

## 3. Innovate（可选方案）

### Option A — Terminal 单文件契约

- **做法**：新增 **`terminal.contracts.ts`**，集中导出 terminal 域对外 `interface` 与 options 类型。
- **Pros**：改动文件少、导入简单。
- **Cons**：单文件随 API 增长变长；词干「terminal」与 `shellRunner` 等子概念混排时需章节化注释。

### Option B — Terminal 按词干拆分契约（推荐倾向）

- **做法**：`config.contracts.ts` + `cwdPrompt.contracts.ts` + `shellRunner.contracts.ts`，与实现文件 **`config.ts`** / **`cwdPrompt.ts`** / **`shellRunner.ts`**（或未来统一为 `stem.ts`）**同词干**，符合点分契约约定。
- **Pros**：与 Boot 目标态同一套「`{stem}.contracts.ts` + `{stem}.ts`」心智模型，可维护性高。
- **Cons**：文件数增加；`terminal/index.ts` 需统一再导出。

### Decision（与 §0 默认决议一致）

- **Preview**：**`src/preview/`**；**`preview.contracts.ts`** + **`preview.ts`**；域 barrel **`preview/index.ts`**。
- **Terminal**：**Option B**（`config` / `cwdPrompt` / `shellRunner` 三份点分契约）；若实施前明确要求单文件，改为 **Option A** 并更新 §0。
- **Preview 接口命名**：**`IWebOsPreviewAttachment`** 为推荐 exports；**`IPreviewAttachment`** `@deprecated`；类名 **`WebOsPreviewAttachment`** 不变。

### Skip

- **Innovate 跳过**：false（已给出 Terminal 两方案与 Preview 决策建议）。

---

## 4. Plan（Contract）

### 4.1 File Changes（目标树状摘要）

> 具体文件名以执行时 git diff 为准；下列为**计划**路径。

```text
packages/web-os/src/
  index.ts                          # 仅改 export 路径（如 ./preview → ./preview/index）
  preview/
    index.ts                        # 域 barrel：再导出契约 + 实现 + 便捷函数
    preview.contracts.ts            # 契约；推荐主导出 IWebOsPreviewAttachment（见 §0）
    preview.ts                      # 主实现（或 previewImpl.ts，与 stem 统一即可）
  webcontainer/
    boot.contracts.ts               # 自 bootContracts.ts 重命名；主导出 IBoot 等
    boot.ts                         # 主实现：class Boot、默认单例；原 boot.ts 中 bootWebContainer 等便捷函数与本文件或 webcontainer/index 聚合导出不冲突即可（执行期定稿）
    ...                             # 删除或不再新增 WebOsBoot.ts：类名规范为 Boot，WebOsBoot 仅作 index 再导出别名（过渡期）
  terminal/
    index.ts
    config.contracts.ts / cwdPrompt.contracts.ts / shellRunner.contracts.ts
    config.ts / cwdPrompt.ts / shellRunner.ts   # import type 自对应 *.contracts.ts
    refs.ts / logBuffer.ts                     # 实现为主（P0 不强制新增契约文件，见 §0）
```

可选（P2，见 §0 fileSystem 默认）：

```text
  webcontainer/fileSystem/
    fileSystem.contracts.ts         # 若评审后将快照/IDB 输入输出提升为独立契约面
```

### 4.1.1 路径迁移对照表（重构前 → 重构后）

| 重构前（现状） | 重构后（目标） |
|----------------|----------------|
| `src/previewContracts.ts` | `src/preview/preview.contracts.ts` |
| `src/preview.ts` | `src/preview/preview.ts` |
| （无） | `src/preview/index.ts`（域 barrel，供根 `index` `export * from "./preview"`） |
| `src/webcontainer/bootContracts.ts` | `src/webcontainer/boot.contracts.ts` |
| `src/webcontainer/WebOsBoot.ts` | 逻辑并入 **`src/webcontainer/boot.ts`**（`class Boot`）；删除独立 `WebOsBoot.ts` |
| `src/webcontainer/boot.ts` | `src/webcontainer/boot.ts`（契约再导出 + 便捷函数 + `Boot` / `webOsBoot`；执行期定稿合并方式） |
| `src/terminal/config.ts`（含契约型 interface） | + `src/terminal/config.contracts.ts`；`config.ts` 仅实现 + `import type` |
| `src/terminal/cwdPrompt.ts` | + `cwdPrompt.contracts.ts` |
| `src/terminal/shellRunner.ts` | + `shellRunner.contracts.ts` |
| `src/terminal/refs.ts`、`logBuffer.ts` | 路径不变；若后续抽出对外 interface，再增加对应 `*.contracts.ts` |

**符号层（包入口不变）**：`WebOsBoot`、`IWebOsBoot`、`webOsBoot`、`bootWebContainer` 等继续从 **`"web-os"`** 导出，实现上映射到 **`Boot` / `IBoot`**（见 §4.3 P0）。

### 4.1.2 执行里程碑（建议顺序）

1. **M1 — Preview 域**：新建 `preview/`、迁移契约与实现、根 `index.ts` 改路径；跑 `tsc`。
2. **M2 — Boot 点分与类名**：`boot.contracts.ts`、`boot.ts` 合并类实现；入口别名导出 **`WebOsBoot` ↔ `Boot`**；跑 `tsc`。
3. **M3 — Terminal 契约**：按 Option B 新增三份 `*.contracts.ts` 并改实现文件类型导入；跑 `tsc`。
4. **M4 — 文档与注释**：补齐公开 API TSDoc；更新 README 表格（尤其 Boot / Preview 接口推荐名与 deprecations）。
5. **M5 — fileSystem（P2）**：按 §0 默认先做 `types.ts` 注释；可选再落 `fileSystem.contracts.ts`。

### 4.2 Signatures（保持稳定为主）

- **包入口**：`import { … } from "web-os"` 所见的**符号集合**与语义保持不变；新增符号仅用于别名或新推荐名。
- **类与单例**：`WebOsBoot`（别名）、`webOsBoot`、`WebContainerShellRunner`、`webContainerShellRunner` 等方法签名不变；内部规范类名为 **`Boot`** 时，对外仍通过别名保持原符号。
- **函数**：`bootWebContainer`、`ensureWorkspace`、`mountImportedWorkspace`、`attachPreview` 行为与参数不变。

### 4.3 Implementation Checklist

- [x] **P0（Boot）**：`bootContracts.ts` → **`boot.contracts.ts`**；`IWebOsBoot`/`WebOsBoot` 规范化为 **`IBoot`/`Boot`**；**`WebOsBoot`/`IWebOsBoot`/`webOsBoot`** 在 `boot.ts` **别名 / type alias**；**`WebOsBoot.ts`** 已并入 **`boot.ts`**。
- [x] **P0（Preview）**：新建 `src/preview/**`，**`preview.contracts.ts`** + **`preview.ts`** + **`index.ts`**；根 **`index.ts`** 仍 `export * from "./preview"`。
- [x] **P0（Terminal）**：**Option B**：**`config.contracts.ts` / `cwdPrompt.contracts.ts` / `shellRunner.contracts.ts`**；实现 **`import type`**；**`terminal/index.ts`** 已从契约文件再导出类型。
- [x] **P1（部分）**：Boot / Preview 契约与 README 已补强；Terminal 契约含简要说明；未做「全表面字段级」逐项扫描（可后续迭代）。
- [x] **P1**：**`IWebOsPreviewAttachment`** + **`IPreviewAttachment`** deprecated type alias；**`WebOsPreviewAttachment`** `implements` 推荐契约；README 已同步。
- [x] **P2（最小）**：**`WorkspaceTreeSnapshotRecord`** 增加契约文件级 JSDoc；未引入 **`fileSystem.contracts.ts`**（与 §0 默认一致）。
- [x] **Validation**：`pnpm exec tsc -p packages/web-os --noEmit`、`pnpm exec tsc -p demos/webcontainer-openclaw --noEmit` 通过。

### 4.4 Contract Interfaces（跨包 / 破坏性）

| Provider | Interface / 符号 | Consumer | Breaking? | 迁移 |
|----------|------------------|----------|-----------|------|
| `web-os` | `IWebOsPreviewAttachment`（推荐） / `IPreviewAttachment`（`@deprecated`） | 应用/demo | 否 | README 以推荐名为准；旧名过渡期并存 |
| `web-os` | 模块路径（无官方 subpath exports） | 不应存在 | 若发现 deep import | 改为 `from "web-os"` |

---

## 5. Execute Log

- **2026-05-03**：用户 **`开始执行`** 获批；完成 Preview 域迁移、Boot 点分契约与 `Boot`/`WebOsBoot` 别名、Terminal 三份点分契约、`README` 与 **`fileSystem/types.ts`** 最小注释；删除 `previewContracts.ts`、`preview.ts`、`WebOsBoot.ts`、`bootContracts.ts`。

---

## 6. Review Verdict

- **Spec vs 代码**：与 §4.1 / §0 默认决议一致；未新增 **`fileSystem.contracts.ts`**（§0 P2 默认）。
- **兼容性**：`from "web-os"` 聚合导出保持；新增 **`IBoot`/`Boot`/`IWebOsPreviewAttachment`**，旧名以 **`@deprecated` type alias** 或 **`export { Boot as WebOsBoot }`** 保留。
- **风险残留**：公开 API 字段级 TSDoc 未全覆盖；若将来收紧 lint 规则需补扫。

---

## 7. Plan-Execution Diff

- **Terminal**：**`shellRunner.ts`** 保留 **`export type { … } from "./shellRunner.contracts"`**，便于沿用从 `./shellRunner` 导入类型的路径（与 solely `terminal/index` 导出相比多一处实现侧 re-export，可接受）。

---

## 8. Reverse Sync 提醒

- **本轮（仅文档）**：已对照 `.cursor/rules/packages-lib.mdc` 扩写本文档——执行摘要、`Done Contract`、§0 默认决议、`§4.1.1` 路径迁移表、`§4.1.2` 里程碑；终端域索引补充 `refs.ts` / `logBuffer.ts`。（代码未改；仍待 **`Plan Approved`** 后 Execute。）
- 本任务闭环后：更新 `packages/web-os/README.md` 中「源码路径 / 架构说明」若有新增；若引入 deprecations，在 README 增加简短迁移注记。
- **本轮已做 Reverse Sync**：`.cursor/rules/packages-lib.mdc` 合并了「`bootContracts`+`IWebOsBoot`」与「`boot.contracts`+`IBoot`」的矛盾表述，**以点分契约 + 词干三元为准**。
- 若提炼出可复用的 packages 规范案例，可考虑在 `packages-lib.mdc` 的骨架示例中保持 **`boot.contracts.ts` / `boot.ts` / `IBoot`/`Boot`** 为范例（**已写入规则**）。

---

## 热上下文（本轮）

| 项 | 值 |
|----|-----|
| **phase** | Review |
| **approval status** | 本轮 Execute 已完成 |
| **Goal** | web-os 对齐 packages-lib：域目录、契约文件、注释、类与接口一致性 |
| **Next Action** | 可选：补全全表面 TSDoc；按需引入 **`fileSystem.contracts.ts`** |
