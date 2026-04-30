# S3 Phase 0 — D1 依赖审计（规格 + 本仓库脚本）

| 字段 | 内容 |
|------|------|
| 文档类型 | 交付规格（D1 Spec） |
| 状态 | Draft |
| 所属 | [s3-phase-0-plan.md](./s3-phase-0-plan.md) §3 D1 |
| 最后更新 | 2026-04-30 |

---

## 1. D1 目标

在合并「浏览器 / WebContainer / `--no-addons`」相关变更前，**自动**发现：

1. **证据驱动阻断**：`native-risk-packages.json` 的 `blockedEntries` 中每一项须带 `wc-runtime` 或 `wc-doc` 及 `evidenceRef`；命中时 **error**（与 [s3-browser-deps-audit-webcontainers-evidence-spec.md](../specs/s3-browser-deps-audit-webcontainers-evidence-spec.md) 对齐）。
2. **安装脚本风险**（`preinstall` / `install` / `postinstall` 中的 `node-gyp`、`prebuild-install`、可疑 `curl|wget` 等）— 仍为 **error / warn**（启发式，非 WC 唯一依据）。
3. **已安装树中的启发式信号**：包目录下存在 `*.node` 或 `binding.gyp` → **warn**（`HEURISTIC_*`）；**不**单独作为与 WC 阻断等价的 error。

**不承诺**：覆盖 100% 未知 native 包；与 `npm audit` 漏洞库等价。

**旧版**：仅含平面 `blockedPackages`、无 `blockedEntries` 时，命中名单 **仅 warn**（`LEGACY_*`），引导迁移。

---

## 2. 两种运行模式

| 模式 | 适用 | 行为 |
|------|------|------|
| **resolve**（默认） | 已在 CI 执行 `pnpm i` / `npm ci` 之后 | 从根 `package.json` 出发，用 Node 模块解析 **BFS 遍历依赖树**；检查每个解析到的包目录与脚本。 |
| **lockfile-only** | 尚未安装、或只做锁文件级门禁 | 解析 **pnpm-lock.yaml**（`packages:` 键）或 **package-lock.json** 的 `packages` 键，与名单做 **保守匹配**；并扫描根 `package.json` 的声明与脚本。 |

**默认解析范围**：仅 **production** — `dependencies`、`optionalDependencies`（不含根级 `devDependencies`，除非传 `--include-dev`）。

**与 `--no-addons` 的关系**：本脚本**不启动** Node 的 `--no-addons`；它依据名单与启发式在 **install 之前/之后** 提示 WC 下高风险依赖。D2 再在运行时验证。

**Monorepo**：单次运行仅一个 `projectRoot`（默认仓库根）。**resolve** 从该根的 `package.json` 解析依赖树；**lockfile-only** 扫描该根下的锁文件（通常含 workspace 全量包名）。若需按子包门禁，对每个子包目录分别执行 CLI。

---

## 3. 阻断策略（严重级别）

| 级别 | 典型条件 | 默认 CI |
|------|----------|---------|
| **error** | 命中带证据的 `blockedEntries`（`BLOCKLIST_*`）；命中高危 `scriptDangerPatterns`（如 `node-gyp`）；`NO_PACKAGE_JSON` | 退出码 **1** |
| **warn** | `HEURISTIC_BINDING_GYP` / `HEURISTIC_DOT_NODE`；脚本中可疑 `curl|wget`；无法解析的依赖；`LEGACY_*`（旧平面名单）；`BLOCKLIST_LOCKFILE_ALLOWED`（策略放行）；根 `devDependencies` 声明阻断包 | 退出码 **0**；`--strict` 时 **除** `HEURISTIC_*` 外的 warn 视为失败；再加 `--strict-heuristic` 则 `HEURISTIC_*` 也导致失败 |

`lockfile-only` 下对锁内命中 **不区分 optional**（偏保守）。若 monorepo 因 **Next 等** 在锁内必然出现 `sharp` 等，可在 **项目根** 使用 `openclaw-browser-audit.config.json` 的 `allowLockfilePackages` 或 CLI `--allow-lockfile`，该项为 **warn**（`evidenceLevel: policy`）。**resolve** 下若实际安装树含阻断包仍为 **error**；仅存在 `*.node` 而无阻断包名时为 **warn**（`HEURISTIC_DOT_NODE`）。

---

## 4. 本仓库实现位置

| 路径 | 说明 |
|------|------|
| [packages/browser-deps-audit/audit.mjs](../../packages/browser-deps-audit/audit.mjs) | CLI（`--lockfile-only`、`--strict`、`--strict-heuristic`、`--json` 等） |
| [packages/browser-deps-audit/native-risk-packages.json](../../packages/browser-deps-audit/native-risk-packages.json) | `schemaVersion` 2：`blockedEntries`（证据）+ `scriptDangerPatterns` |
| [packages/browser-deps-audit/schema/blocked-entries.schema.json](../../packages/browser-deps-audit/schema/blocked-entries.schema.json) | 单条条目的 JSON Schema（IDE 校验） |
| [packages/browser-deps-audit/fixtures/wc-evidence/](../../packages/browser-deps-audit/fixtures/wc-evidence/) | WC 证据 fixture（Tier-2 手工 / 定时跑） |
| [openclaw-browser-audit.config.json](../../openclaw-browser-audit.config.json) | （可选）`allowLockfilePackages`：仅 **lockfile-only** |

**根目录快捷命令**（见 `package.json` 中 `research:browser-deps-audit`）：

```bash
pnpm run research:browser-deps-audit
pnpm run research:browser-deps-audit -- --lockfile-only --strict
pnpm run research:browser-deps-audit -- /path/to/openclaw --strict --json
pnpm run research:browser-deps-audit -- . --lockfile-only --allow-lockfile sharp
pnpm --filter @repo/browser-deps-audit test
```

对 **OpenClaw 上游仓库** 使用时：将 `projectRoot` 指到该克隆路径；若需 **fork 专用名单**，可维护该仓库内的 `native-risk-packages.json` 副本，或在本 monorepo 中扩展 [packages/browser-deps-audit/native-risk-packages.json](../../packages/browser-deps-audit/native-risk-packages.json) 后另发 npm 包。

---

## 5. 验收（对齐 Phase 0 DoD）

1. **Fixture 失败**：在临时 fixture 的 `package.json` **dependencies** 中声明 `better-sqlite3`（或 `blockedEntries` 任一项），**resolve** 模式应 **非零退出**。
2. **Fixture 通过**：依赖树无阻断包命中，**零退出**；仅存在 `binding.gyp` / `.node` 时为 **warn**，默认不失败。
3. **CI 集成**：`pnpm i` → `pnpm exec browser-deps-audit`；**lockfile-only** 时按需配置放行；`pnpm --filter @repo/browser-deps-audit test` 校验名单 JSON。

---

## 6. 已知局限与后续增强

- **名单维护**：新包须写入 `blockedEntries` 并填 `evidenceRef`；配置非法时进程 **退出码 2**（启动失败）。可选接 **optionalDependencies 里带 `libc` 平台三元组** 的启发式（易误判，需白名单）。
- **pnpm peer / phantom deps**：解析模式依赖 Node 实际解析结果，与 pnpm 严格性一致；若需「未安装也能扫全图」，以 **lockfile-only** 为主并接受保守误报。
- **SARIF**：当前输出为 CLI + `--json`；若需 GitHub Code Scanning，可在后续迭代把 findings 映射为 SARIF。

### 6.1 结论备案（能力边界，2026-04-30）

**不能**将 Phase 0 **D1（本依赖审计）** 等同于「OpenClaw / 某项目在 WebContainers 或浏览器内**是否整体可用**」的准确扫描。

- **D1 实际覆盖**：npm 锁文件 / 解析树中的**包名与证据链**、安装脚本模式、包目录内 **native 相关启发式**（`HEURISTIC_*`）。这是 **「WC 下常见硬失败因素之一（native 等）」的必要条件筛查**，不是产品级「支持矩阵」。
- **D1 明确不覆盖**：系统服务注入（launchd / systemd / 计划任务）、长驻 daemon 模型、出站网络/CORS 语义、多通道与本机 OS 能力、应用源码中的平台分支等——这些**不会**稳定地表现为「某个可枚举 npm 包名」，故 **单独通过 D1 无法得到「是否支持」的完备结论**。
- **若需「是否支持」**：须叠加 **可行性 / 架构规格**（如 [feasibility-openclaw-webcontainers.md](./feasibility-openclaw-webcontainers.md)）、**功能裁剪或构建变体**、以及 **在目标环境（含 WC）内的运行时验证**。

换言之：D1 **有实际意义**，但意义 **限于依赖与安装侧风险门禁**；若预期是「一键准确判定 WC 全栈支持」，则 **超出本产出设计目标**，应视为 **范围外**。

---

## 7. 相关文档

- [s3-phase-0-plan.md](./s3-phase-0-plan.md)
- [solution-s3-openclaw-browser.md](./solution-s3-openclaw-browser.md)
- [s3-browser-deps-audit-webcontainers-evidence-spec.md](../specs/s3-browser-deps-audit-webcontainers-evidence-spec.md) — 阻断名单以 **WebContainers 内证据（实测 / 官方）** 为唯一硬依据的重构方案

---

## 8. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | 2026-04-30 | 首版：D1 规格 + 与仓库脚本对齐 |
| 0.2 | 2026-04-30 | lockfile-only 放行清单（config / CLI）；验收 fixture 与 sharp 说明 |
| 0.3 | 2026-04-30 | 实现迁入 `packages/browser-deps-audit`（`@repo/browser-deps-audit`） |
| 0.5 | 2026-04-30 | §6.1 结论备案：D1 不等价于 WC/产品「是否支持」的完备扫描 |
