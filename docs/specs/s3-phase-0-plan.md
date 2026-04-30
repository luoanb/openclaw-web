# S3 — Phase 0 执行规划（草案）

| 字段 | 内容 |
|------|------|
| 文档类型 | 阶段规划（Phase Plan / 可拆任务清单） |
| 状态 | Draft |
| 所属方案 | [solution-s3-openclaw-browser.md](./solution-s3-openclaw-browser.md) §3.1 |
| 最后更新 | 2026-04-30 |

---

## 1. Phase 0 的目标（一句话）

在 **不承诺完整产品** 的前提下，用可自动化证据回答三件事：

1. **依赖**：目标包（或选定子树）在 **`--no-addons`** 下能否 **安装并加载** 到可运行入口？
2. **运行时**：是否存在 **最小 Gateway-Lite**（健康检查 + **经代理** 的一轮模型调用）？
3. **契约**：浏览器侧与 **Browser Proxy / BFF** 之间的 **HTTP 契约** 是否成文、可版本化？

Phase 0 **结束条件**：上述三条均有 **CI 或等价自动化** 与 **文档** 支撑；任一长期不可达则 **上调风险或收窄范围**（例如改为仅审计上游、不绑定 OpenClaw 包名）。

---

## 2. 范围（In Scope / Out of Scope）

### 2.1 In Scope

- 针对 **选定版本** 的 `openclaw`（或 fork / 子包）做 **依赖与安装脚本** 审计。
- **Node `--no-addons`** 下的 `install` + **最小 smoke**（可选：第二轨 **WebContainer** 手工或夜间跑，不作为 Phase 0 阻塞项）。
- **占位或极简** Gateway-Lite：进程启动、HTTP 健康、经代理调用 **一次** completion（可用 mock 模型响应，若代理层先实现 stub）。
- **代理契约 v0.1**：路径、方法、鉴权头、错误码、**允许转发的上游白名单** 字段。

### 2.2 Out of Scope（Phase 0 不做）

- 完整 Control UI、多通道、工具白名单以外的能力。
- 生产级代理（多租户计费、完整审计留存、SOC2）；Phase 0 只需 **可部署的参考实现** 或 **契约 + mock**。
- 与 OpenClaw 上游的 **正式品牌/合并线** 谈判（可并行，不阻塞技术骨架）。

---

## 3. 交付物分解

### D1 — 依赖图审计脚本

**目的**：在合并任何「browser 构建」相关 PR 前，阻断 **native addon、危险 postinstall、可疑 optionalDependencies**。

**规格与实现索引**（规则表、双模式、CI 验收）：[s3-p0-d1-dependency-audit.md](./s3-p0-d1-dependency-audit.md)

**本仓库参考实现**：workspace 包 `@repo/browser-deps-audit`（[packages/browser-deps-audit](../../packages/browser-deps-audit)），根目录 `pnpm run research:browser-deps-audit`（审计对象默认为仓库根；指向 OpenClaw 克隆目录时传路径参数）。

**建议实现要点**：

| 项 | 说明 |
|----|------|
| 输入 | `package.json` + lockfile（pnpm/npm/yarn 择一）；可选：已展开的 `node_modules` 列表 |
| 规则示例 | 解析 `dependencies` / `optionalDependencies`；标记已知 **带 native 的二进制包** 名单（可维护 JSON）；扫描 `scripts.postinstall` / `preinstall` 是否存在 **下载可执行文件** 等模式 |
| 输出 | SARIF 或人类可读报告；CI 非零退出表示 **阻断** |
| 注意 | `--no-addons` 与「包名不含 native」不等价；以 **实际 `require()` 图** 或维护名单为主，辅以启发式 |

**验收**：在干净 CI 镜像中运行脚本；对 **已知含 native 的依赖** 注入 fixture 时能失败；对纯 JS fixture 通过。

---

### D2 — `no-addons` CI Job

**目的**：证明 **安装 + 最小启动** 在接近 WebContainers 约束的 Node 下可行。

**建议矩阵**：

| 维度 | 建议 |
|------|------|
| Node 版本 | 与 OpenClaw 文档下限对齐（如 22.14+）及一个 LTS |
| 启动参数 | `NODE_OPTIONS=--no-addons`（以 Node 实际支持为准；若版本差异大，文档写明最低 Node） |
| 步骤 | `install`（`pnpm i --frozen-lockfile` 等）→ `smoke` 子命令或 `node scripts/smoke.mjs` |

**验收**：主分支（或 `browser/*` 分支）上该 Job **绿色**；失败时日志能区分 **install 失败 / require 失败 / 网络失败**。

**与 WebContainers 的关系**：Phase 0 以 **CLI CI 为门禁** 成本最低；WebContainer E2E 可作为 **非阻塞** 或 **nightly**，避免 flakiness 阻塞首版。

---

### D3 — Gateway-Lite PoC

**目的**：证明 **网关形态** 在受限环境下的最小闭环，而非证明 OpenClaw 全功能。

**最小行为**：

1. 监听 **单端口**（或 stdio，但 HTTP 更利于与代理对齐）；提供 `GET /health` → `200` + 固定 JSON。
2. 提供 `POST /v0/chat`（路径可调整，但需与 **D4 契约** 一致）：请求体含 `messages`（或等价）；**不向公网模型直连**，只向 **配置的 Proxy Base URL** 转发。
3. Proxy 未配置或不可达时：**明确错误**（503/502 + body），不静默崩溃。

**实现策略（择一）**：

- **A**：独立小仓库 `gateway-lite`，仅复用 OpenClaw 的 **类型或极少 util**（若上游未模块化，复制量可接受于 PoC）。
- **B**：在 monorepo 新增 `packages/browser-gateway-lite`，从上游 **git submodule 或 npm 依赖** 拉取后 tree-shake（Phase 0 若成本过高则优先 A）。

**验收**：本地与 CI 中，在 `--no-addons` 下执行 smoke：**health 绿** + **经 mock 或真实代理** 返回一条 assistant 消息（可为 stub 字符串）。

---

### D4 — 代理契约文档（v0.1）

**目的**：把「浏览器不直连模型」落成 **可对接的 API 规范**，便于 BFF 或独立 Proxy 并行开发。

**建议章节**：

1. **Base URL**：例如 `https://bff.example.com/openclaw-browser/v0`。
2. **鉴权**：`Authorization: Bearer <token>` 或 cookie 会话；**禁止**在 URL query 中传长期密钥。
3. **转发聊天**：`POST .../completions`（或 OpenAI-compatible 子路径）；请求/响应字段表（model、messages、temperature、stream 是否支持）。
4. **白名单**：配置项 `allowed_upstream_hosts`；代理 **拒绝** 未列入的上游（防 SSRF）。
5. **错误模型**：4xx/5xx JSON body 形状、`request_id`。
6. **版本**：`X-Contract-Version: 0.1`。

**验收**：文档评审通过 + Gateway-Lite 集成测试 **按契约** 对 mock 代理断言；契约变更走 **版本号 bump**。

---

## 4. 建议里程碑（顺序）

| 序号 | 里程碑 | 依赖 | 产出 |
|------|--------|------|------|
| M1 | 锁定审计对象 | 选定 npm 包与版本范围 | README「审计范围」 |
| M2 | D1 脚本 + CI | M1 | 审计 Job 绿/红可解释 |
| M3 | D4 v0.1 文档 | 无 | Markdown / OpenAPI YAML 任选 |
| M4 | Mock Proxy | M3 | 本地可跑容器或单文件 Worker |
| M5 | D3 Gateway-Lite | M2、M4 | 仓库内可执行 PoC |
| M6 | D2 no-addons Job | M5 | 主线门禁 |

M3 与 M2 可部分并行；**M5 依赖 M4** 可降低联调阻塞。

---

## 5. 风险与对策

| 风险 | 对策 |
|------|------|
| 上游 `openclaw` 无法在 `--no-addons` 下安装 | 及早跑 D1/D2；必要时 Phase 0 对象改为 **「自研 lite + 协议向 OpenClaw 对齐」** 而非整包 |
| Node 版本与 WebContainers 不一致 | 文档列「支持矩阵」；CI 多版本；WebContainer 仅作参考 |
| 代理契约频繁变动 | v0.1 冻结两周评审窗；之后 semver |
| 无专职安全评审 | Phase 0 契约中 **强制白名单**；日志不落用户正文 |

---

## 6. Phase 0 完成定义（Definition of Done）

- [ ] D1：审计脚本在 CI 中运行，失败会阻断合并。
- [ ] D2：`no-addons` Job 在默认分支稳定绿色 ≥ 连续 N 次（团队自定 N）。
- [ ] D3：README 中 **一键命令** 可复现 health + 经代理对话（可用 mock）。
- [ ] D4：契约 v0.1 落盘，且与 D3 的集成测试或手动 checklist **对齐**。
- [ ] 回写：在 [solution-s3-openclaw-browser.md](./solution-s3-openclaw-browser.md) 中更新 Phase 0 状态与 **实际工期**（Retro）。

---

## 7. 相关文档

- [s3-p0-d1-dependency-audit.md](./s3-p0-d1-dependency-audit.md) — D1 规格与脚本用法
- [solution-s3-openclaw-browser.md](./solution-s3-openclaw-browser.md) — S3 总览与后续 Phase
- [feasibility-openclaw-webcontainers.md](./feasibility-openclaw-webcontainers.md) — 背景与约束

---

## 8. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | 2026-04-30 | 首版：Phase 0 目标、交付物、里程碑、DoD |
| 0.2 | 2026-04-30 | D1 链至 `s3-p0-d1-dependency-audit.md` 与本仓库 `packages/browser-deps-audit` |
