# SDD Spec（技术方案）：browser-deps-audit — WebContainers 证据驱动阻断

| 字段 | 内容 |
|------|------|
| 文档类型 | Plan 合同 + 需求上下文（Research 结论摘要；Execute 前须 `Plan Approved`） |
| 状态 | Draft |
| 关联 | [s3-p0-d1-dependency-audit.md](../research/s3-p0-d1-dependency-audit.md)、[feasibility-openclaw-webcontainers.md](../research/feasibility-openclaw-webcontainers.md) |
| 代码入口 | `packages/browser-deps-audit/audit.mjs`、`native-risk-packages.json` |
| 最后更新 | 2026-04-30 |

---

## 0. Open Questions

- [ ] **WC 实测宿主**：证据 A 以 StackBlitz 在线 WebContainers 为准，还是以本仓库自托管 `@webcontainer/api` 最小页为准？（影响 fixture 运行方式与 CI 成本。）
- [ ] **版本钉扎**：阻断名单是否按「受测包主版本」钉死（`evidencePackageVersion`）， semver 升级后是否自动降级为 warn 直至重跑 A？
- [ ] 无待定项时改为：`[x] None`（进入 Execute 前清零）。

---

## 1. Requirements（Context）

### 1.1 Goal

重构 `browser-deps-audit`，使 **error 级阻断** 仅对应「在 WebContainers 代表环境下**已证不可用**」的依赖；启发式信号与 monorepo 锁文件策略与 WC 可用性**解耦**并分级输出。

### 1.2 In-Scope

- 数据模型：阻断项必须具备 `wc-runtime` 或 `wc-doc` 证据元数据。
- `packages/browser-deps-audit`：配置加载、遍历逻辑、CLI、`--json` 输出字段扩展。
- 文档：`s3-p0-d1-dependency-audit.md` 与本文同步；名单迁移说明。
- 最小 **fixture 矩阵**（仓库内可维护）：至少 1 个「应失败」+ 1 个「应通过」的 WC 侧验证说明或可自动化脚本占位。

### 1.3 Out-of-Scope

- 替代 OpenClaw 在 WC 内完整跑通（属独立 PoC）。
- SARIF、GitHub Code Scanning。
- 自动爬取 npm 全量包做 native 推断（仍属 C 类，不升格为阻断依据）。

### 1.4 Context Sources

- 需求来源：对话决议「排除依据 = WC 内确实不可用」。
- 设计参考：[WebContainers Troubleshooting — Native addons](https://webcontainers.io/guides/troubleshooting)。
- 现状代码：`packages/browser-deps-audit/audit.mjs`、`native-risk-packages.json`。

---

## 2. Research Findings（摘要）

- WC 对 **Node native addon** 默认不可加载；与当前脚本中「`*.node` / node-gyp」类信号**相关但不等价**（纯 JS 包不应因名称或误报被阻断）。
- 现有 `blockedPackages` 平面数组无法承载证据链，也不满足 SDD **Plan 可执行性**（缺少文件级合同）。

---

## 3. Innovate（选项与决议）

| 选项 | 说明 | 取舍 |
|------|------|------|
| **A. 单文件演进** | 保留 `native-risk-packages.json`，增加 `blockedEntries: [...]`，保留 `scriptDangerPatterns`；废弃平面 `blockedPackages` 或读时兼容映射为「无证据 → 仅 warn」 | 改动面小；单文件变长 |
| **B. 拆分文件** | `wc-evidence-blocklist.json` + `native-heuristics.json` + 根配置合并 | 职责清；多路径加载与发布说明成本略增 |

**Decision**：首选 **A**；若单文件超过 ~200 行维护困难再切 **B**（在 Execute 的 `File Changes` 中可修订一次）。

---

## 4. Plan（Contract）

### 4.1 File Changes

| 路径 | 变更类型 | 说明 |
|------|----------|------|
| `packages/browser-deps-audit/native-risk-packages.json` | 修改 | 引入 `blockedEntries[]`（见 §4.3）；`scriptDangerPatterns` 保留；平面 `blockedPackages` 删除或 Deprecated 兼容一层 |
| `packages/browser-deps-audit/audit.mjs` | 修改 | 加载新结构；分轨 **阻断** vs **启发式 warn**；CLI 扩展 |
| `packages/browser-deps-audit/schema/`（可选） | 新增 | `blocked-entries.schema.json`（JSON Schema），供 IDE 校验 |
| `packages/browser-deps-audit/fixtures/wc-evidence/` | 新增 | 每包一目录：`package.json`、`probe.mjs`、可选 `README.md`（贴失败/通过日志模板） |
| `docs/research/s3-p0-d1-dependency-audit.md` | 修改 | §1 目标、§3 严重级别表与脚本行为对齐 |
| 根 `package.json` / CI workflow | 可选 | 增加「WC fixture 手册或定时 job」占位命令 |

### 4.2 Signatures（对外契约）

**CLI（向后兼容）**

- 保留：`[projectRoot]`、`--lockfile-only`、`--allow-lockfile`、`--include-dev`、`--strict`、`--json`。
- 新增：`--strict-heuristic`（可选，默认 **false**）：为 true 时，纯 C 类（如仅 `BINDING_GYP` 无 A/B 包命中）在 `--strict` 下是否升级为失败 — **本方案默认仍不阻断包名，仅影响 warn 聚合策略**；若产品需要「strict 下 binding.gyp 也失败」，在 Execute 中二选一写死并更新下表。

**进程退出码**

- 不变：`fail === true` → `1`，否则 `0`。

**`--json` 输出扩展（Additive）**

- 根级增加：`schemaVersion`（如 `"2"`）、`blocklistSource`（文件名）。
- 每条 finding 增加可选字段：`evidenceLevel`（`wc-runtime` \| `wc-doc` \| `heuristic` \| `policy`）、`evidenceRef`（string）、`blockedEntryId`（string，可选）。

**内部模块边界（audit.mjs 逻辑拆分建议）**

- `loadConfig(configPath) -> { blockedByName: Map<string, BlockedEntry>, scriptPatterns, schemaVersion }`
- `auditPackageDir(dir, pkgName, via, blockedByName) -> findings[]` — 阻断码仅当 `blockedByName.has(pkgName)` 且 entry 证据完整。
- `heuristicScanPackageDir(dir, pkgName, via) -> findings[]` — `binding.gyp`、`.node`；**不**与 `BLOCKLIST_PACKAGE` 混为同一 code，建议 `HEURISTIC_BINDING_GYP`、`HEURISTIC_DOT_NODE`（或保留旧 code 但 `level` 恒为 warn 且文档声明非 WC 依据）。

### 4.3 Data Model（`blockedEntries` 示例）

```json
{
  "schemaVersion": 2,
  "scriptDangerPatterns": [],
  "blockedEntries": [
    {
      "id": "better-sqlite3",
      "package": "better-sqlite3",
      "evidenceLevel": "wc-runtime",
      "evidenceRef": "fixtures/wc-evidence/better-sqlite3/README.md#log",
      "failureMode": "native_addon",
      "verifiedAt": "2026-04-30",
      "verifiedRuntimeNote": "WebContainers @webcontainer/api x.x / stackblitz.com editor"
    }
  ]
}
```

**校验规则（实现时 enforce）**

- `blockedEntries[].package` 必填，与 npm 包名一致（scoped 含 `@scope/name`）。
- `evidenceLevel` ∈ `{ "wc-runtime", "wc-doc" }`；缺失或非法 → **构建/启动审计时抛错**（fail fast），避免静默无证据阻断。
- `evidenceRef` 非空字符串；`wc-doc` 建议 `https://` 前缀或可解析的仓库相对路径。
- `id` 默认等于 `package`；冲突时用稳定 slug。

**向后兼容**

- 若检测到旧键 `blockedPackages: string[]`：加载时合成伪 entry，`evidenceLevel: "legacy-heuristic"`，**统一降级为 warn**（code 如 `LEGACY_BLOCKLIST_NO_EVIDENCE`），**不**产生 error；stderr 或 `--json` 中提示迁移截止版本。一至两个 sprint 后删除兼容分支（在 checklist 中单列任务）。

### 4.4 算法设计（resolve / lockfile-only）

**Resolve 模式**

1. BFS 依赖树（与现实现一致）。
2. 对每个解析到的 `pkgName`：  
   - 若在 `blockedByName` 且证据合法 → 追加 `BLOCKLIST_PACKAGE` **error**，detail 含 `evidenceRef`。  
   - 启发式扫描 → 仅 **warn**（除非未来启用 `--strict-heuristic` 且 spec 已更新）。  
3. 安装脚本命中 `scriptDangerPatterns`：保持现有 **error/warn**；在 `--json` 中 `evidenceLevel: "heuristic"`。

**lockfile-only 模式**

1. 锁内包名集合与现解析一致。  
2. 若 `name` ∈ `blockedByName` 且证据合法 → **error**（与 resolve 一致）。  
3. `allowLockfile`：行为保留；finding 的 `evidenceLevel` 标为 `policy`。  
4. 旧平面名单命中且无 entry → **warn** + 迁移提示。

**复杂度**：与当前 O(包数) 同级；`blockedByName` 为 Map O(1) 查找。

### 4.5 Fixtures（WC 证据 A）

| 目录 | 内容 |
|------|------|
| `fixtures/wc-evidence/<package>/package.json` | `dependencies: { "<package>": "<pinned version>" }`，版本与 `blockedEntries[].verifiedPackageVersion`（若加字段）一致 |
| `fixtures/wc-evidence/<package>/probe.mjs` | `import '<package>'` 或文档推荐入口；`README.md` 记录 **实际** stderr（WC 内粘贴） |
| `fixtures/wc-evidence/_negative-control/bcryptjs/`（示例） | 预期 **通过**，用于防回归误杀纯 JS |

**CI 分层（建议）**

- **Tier-1（每 PR）**：Node 下跑 `browser-deps-audit` + JSON schema 校验（若有）+ 单元测试（配置加载失败应 throw）。
- **Tier-2（每周 / 手动）**：在文档化 WC 环境中 human 或半自动跑 `probe.mjs`，更新 `README.md` 日志与 `verifiedAt`（产出可贴回 PR）。

### 4.6 与 D1 文档对齐

- `s3-p0-d1-dependency-audit.md` §1：改为「证据驱动阻断 + 启发式 warn」；§3 表中增加一行 **legacy / policy** 说明。

### 4.7 Implementation Checklist（Execute 原子任务）

- [x] 定义 `blockedEntries` 与 JSON Schema（或 Zod，与仓库惯例一致则二选一）。
- [x] `audit.mjs`：`loadConfig` + 旧格式兼容分支 + 测试。
- [x] 将现有 `blockedPackages` 逐项迁移：有 A/B 证据的写入 entry；无证据的从 error 源移除，仅保留 heuristic 或移出。
- [x] 拆分 finding code：`BLOCKLIST_PACKAGE`（仅证据包）、`HEURISTIC_*` / `SCRIPT:*`。
- [x] `--json` 输出 `schemaVersion` 与 `evidenceLevel`。
- [x] 新增至少 2 个 fixture 目录（1 fail + 1 pass）。
- [x] 更新 `s3-p0-d1-dependency-audit.md` 与根 `research:browser-deps-audit` 说明。
- [ ] （可选）CI：校验 config 的 npm script。

### 4.8 验收标准（Acceptance）

1. 任意 `blockedEntries` 项缺失 `evidenceLevel`/`evidenceRef` 时，审计进程 **启动失败**（与「静默放行」相反，满足安全侧）。
2. 全量现有「应阻断」包均具备可追溯 `evidenceRef`；误列纯 JS 包已移除或从未进入 `blockedEntries`。
3. `--json` 中每条 error 级 `BLOCKLIST_PACKAGE` 均带 `evidenceLevel` ∈ `{ wc-runtime, wc-doc }`。

**证据分级（与 §1 Goal 对齐）**：`wc-runtime` / `wc-doc` 可单独支撑 error；`heuristic` / `policy`（如 `allowLockfile`）不得冒充 WC 不可用证明。

---

## 5. Execute / Review

### 5.1 Execute Log（2026-04-30）

- 已实现 `loadAuditConfig`、`blockedEntries` 校验（缺字段 → 进程退出码 2）、旧 `blockedPackages` → `LEGACY_*` warn。
- `HEURISTIC_BINDING_GYP` / `HEURISTIC_DOT_NODE` 降为 warn；`BLOCKLIST_PACKAGE` / `BLOCKLIST_LOCKFILE` 仅证据名单。
- `--json` 增加根级 `schemaVersion`、`blocklistSource`；findings 含 `evidenceLevel` / `evidenceRef` / `blockedEntryId`（适用项）。
- CLI：`--strict-heuristic`；pnpm `.bin` 下通过 `realpathSync` 判定入口以执行 `main()`。
- 单测：`pnpm --filter @repo/browser-deps-audit test`。
- Fixture：`fixtures/wc-evidence/better-sqlite3`、`fixtures/wc-evidence/_negative-control/bcryptjs` + README。

### 5.2 Review（占位）

- 对照 §4.8：人工 spot-check `--json` 中 `BLOCKLIST_*` 均带 `wc-runtime` / `wc-doc`。

---

## 6. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | 2026-04-30 | 首版：证据分级与 checklist |
| 0.2 | 2026-04-30 | 对齐 SDD Plan：`File Changes`、`Signatures`、数据模型、算法、fixture/CI、迁移策略、Open Questions |
| 0.3 | 2026-04-30 | Execute：`audit.mjs`、fixtures、`schema/blocked-entries.schema.json`、单测；D1 文档同步 |
