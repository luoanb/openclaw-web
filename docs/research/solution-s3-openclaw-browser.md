# 方案设计（草案）：S3 — OpenClaw-Browser / WebContainer 裁剪发行版

| 字段 | 内容 |
|------|------|
| 文档类型 | 方案探索（Solution / Architecture Draft） |
| 状态 | Draft |
| 前置文档 | [feasibility-openclaw-webcontainers.md](./feasibility-openclaw-webcontainers.md) |
| 最后更新 | 2026-04-30（Phase 0 见 [s3-phase-0-plan.md](./s3-phase-0-plan.md)） |

---

## 1. 定位与边界

### 1.1 S3 要解决什么

在 **不追求与本机完整 OpenClaw 等价** 的前提下，提供一条 **可维护的** 路径，使 **WebContainers（或同类 `--no-addons` 环境）** 中能运行 **「网关能力的一个受控子集」**：会话内聊天、有限工具、可选的 **HTTP 友好通道**，且 **安全模型与运维模型在文档与产品中显式化**，避免用户误以为与 local-first 完整网关同权。

### 1.2 命名与形态（建议）

- **OpenClaw-Browser**（工作名）：独立 **npm scope 或包后缀**（例如 `@openclaw/browser-gateway`），与官方 `openclaw` CLI **并存**，不替代主发行版。
- **宿主**：优先支持 **StackBlitz WebContainers**；其它 `--no-addons` / 浏览器内 Node 若 API 兼容，可作为二级目标。

### 1.3 明确非目标（Non-goals）

以下默认 **不在 S3 v1 范围**，除非单独立项并过安全评审：

- 与本机版 **全通道矩阵** 对等（尤其依赖 native / 本机 OS / 非 HTTP 栈的通道）。
- **无代理** 下直接持有高敏密钥调用任意第三方 API（浏览器来源 + CORS 现实）。
- **真守护进程**、跨标签页 **强一致持久化**（可与宿主页面协作做「尽力持久化」，但不承诺等价 systemd）。
- **任意 exec / 任意文件系统** 与完整沙箱逃逸防护等价于服务端 hardened VM（浏览器内只能做 **能力降级 + 明示风险**）。

---

## 2. 高层架构

```text
┌─────────────────────────────────────────────────────────────┐
│  宿主 Web 应用（非 OpenClaw 官方必选，可由集成方实现）          │
│  - COOP/COEP、WebContainer boot、可选 IndexedDB 快照恢复      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  WebContainer 内：OpenClaw-Browser 运行时                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Gateway-Lite│  │ Tool 子系统   │  │ Channel 插件宿主     │  │
│  │ (纯 JS)     │──│ (白名单能力)  │──│ (仅加载允许的插件)   │  │
│  └──────┬──────┘  └──────────────┘  └──────────┬──────────┘  │
│         │                                        │             │
│         └────────────────┬───────────────────────┘             │
│                          │ HTTP(S) only / fetch 语义            │
└──────────────────────────┼────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│  受控出站层（S3 核心设计点之一）                                 │
│  A) 官方或自建「Browser Proxy」—— 统一加 CORS、鉴权、速率、审计    │
│  B) 集成方提供的同域 BFF（责任边界在集成方）                      │
└─────────────────────────────────────────────────────────────┘
                           │
                    LLM / 通道 HTTP API / 其它允许端点
```

**要点**：

1. **Gateway-Lite**：从 OpenClaw 网关协议中 **裁剪** 或 **复用可 tree-shake 的模块**，禁止在默认构建中加载 native 依赖路径。
2. **出站**：浏览器内 **不假装** 拥有服务器 Node 的网络自由；**默认** 所有模型与通道流量经 **Browser Proxy 或同域 BFF**，由该层持有 **服务端密钥** 或 **用户 OAuth 交换后的短期 token**（具体模式需按合规选择）。
3. **通道插件化**：通道实现 **动态 import + 能力声明**；WebContainer 构建只打包 **允许列表** 内的插件；每个插件声明 `capabilities: ['http']` / `needsProxy: true` 等。

---

## 3. 能力分层（建议路线图）

### 3.1 Phase 0 — 可证明的骨架（4–8 周量级，视上游可 fork 性而定）

**独立执行规划**（里程碑、DoD、风险、交付物细化）：[s3-phase-0-plan.md](./s3-phase-0-plan.md)

| 交付物 | 说明 |
|--------|------|
| 依赖图审计脚本 | 对 `openclaw` 及子包做 **native / optionalDependencies / postinstall** 扫描；CI 失败即阻断 browser 构建 |
| `no-addons` CI Job | 在 Node `--no-addons` 或 WebContainer 镜像中跑 **install + smoke** |
| Gateway-Lite PoC | 单一入口：健康检查 + 一轮「经代理的」completion 请求 |
| 代理契约文档 | 请求/响应形状、鉴权方式、禁止直连接名单 |

### 3.2 Phase 1 — 可演示产品（MVP）

- **控制面**：最小 Web UI 或复用 OpenClaw Control UI 的 **静态子集**（若许可与构建链允许）。
- **模型**：仅支持 **经代理** 的 OpenAI 兼容或上游明确允许的调用路径。
- **工具**：白名单（例如：只读 `fetch`、结构化 JSON、**无** shell exec）。
- **持久化**：会话内内存 + 可选 **宿主注入的 storage adapter**（IndexedDB 由宿主实现，避免在核心内绑死浏览器 API 以便测试）。

### 3.3 Phase 2 — 通道子集

- 仅纳入 **纯 HTTP/WebSocket + 无 native** 的通道（例如部分 Bot API 模式）；每个通道 **独立包**、`peerDependencies` 标明浏览器构建。
- **Webhook / 长轮询**：若需公网入口，必须由 **代理或 BFF** 提供，不在 WebContainer 内开裸端口假设。

### 3.4 Phase 3 — 与上游关系（战略选项）

| 选项 | 优点 | 代价 |
|------|------|------|
| **上游贡献「browser 条件导出」** | 单仓、减少分叉 | 需 OpenClaw 维护者接受节奏与责任 |
| **长期 fork** | 自主 | 合并成本、安全补丁滞后 |
| **独立网关、协议兼容** | 清晰边界 | 重复实现协议与部分逻辑 |

建议起步以 **独立包 + 少量 upstream PR（如条件导出 / 纯 JS 路径）** 组合，避免一上来全仓 fork。

---

## 4. 安全与合规（S3 必须成文的章节）

### 4.1 密钥与身份

- **默认**：浏览器 bundle **不包含** 长期 API Key；使用 **代理侧** 或 **OAuth + 短期 token**。
- **威胁模型**：恶意网页若嵌入同一套 WebContainer 应用，需依赖 **集成方** 的 CSP、iframe 隔离与 **用户授权** 流程；OpenClaw-Browser 文档需写明 **「嵌入方责任」**。

### 4.2 工具与执行

- **禁止类**：默认关闭 `exec`、任意路径读写、子进程。
- **允许类**：经代理的 HTTP、受限的内置工具（例如计算器、JSON 变换）。
- **用户同意**：高风险操作需 **显式 UI 确认**（与完整版策略对齐思路，但实现可简化）。

### 4.3 供应链

- lockfile、SBOM、对 **postinstall** 的审查；browser 构建在 CI 中 **禁止执行不可信脚本** 或与上游策略对齐。

### 4.4 隐私叙事

- UI 与文档中 **禁止** 使用与本机完整版相同的「100% 本地、零出站」表述，除非技术架构真正满足；S3 的准确表述应为 **「密钥与敏感策略在代理侧；浏览器内为会话沙箱」** 等。

---

## 5. 与 WebContainers 的集成要点

- **COOP/COEP**：按 [WebContainers 教程](https://webcontainers.io/tutorial/1-build-your-first-webcontainer-app) 配置宿主页面。
- **性能**：冷启动与 `npm install` 体积；考虑 **预打包镜像** 或 **预装 node_modules 快照** 降低首次打开时间。
- **网络**：所有出站假设 **CORS**；代理域名需在 **允许列表** 中可配置。

---

## 6. 成功标准（可验收）

1. 在指定 WebContainers 演示项目中 **`pnpm install` 成功** 且无 native addon 加载。
2. **无密钥** 的 demo 可通过 **公开 demo 代理** 完成一轮对话（或集成方自有代理）。
3. **安全文档** 与 **威胁模型** 随首版发布。
4. **通道**：至少 0 条（MVP）或 N 条在允许列表内通过 E2E（Phase 2）。

---

## 7. 未决问题（需在 Plan 前收敛）

1. **OpenClaw 许可证与品牌**：独立发行是否允许使用 OpenClaw 商标、Control UI 资源；需与上游社区确认。
2. **代理归属**：官方 Browser Proxy 是否由 OpenClaw 团队运营；若否，仅提供 **自托管代理参考实现**（Docker/Worker）。
3. **状态同步**：多标签页、刷新后的会话恢复是否属于 v1。
4. **上游模块化程度**：若不拆包，Gateway-Lite 的 **重复代码量** 是否可接受。

---

## 8. 相关文档

- [s3-phase-0-plan.md](./s3-phase-0-plan.md) — Phase 0 交付物、里程碑与完成定义（DoD）
- [s3-p0-d1-dependency-audit.md](./s3-p0-d1-dependency-audit.md) — P0-D1 依赖审计规格与脚本
- [feasibility-openclaw-webcontainers.md](./feasibility-openclaw-webcontainers.md) — 背景与 S0–S3 总表
- WebContainers：<https://webcontainers.io/>
- WebContainers Troubleshooting：<https://webcontainers.io/guides/troubleshooting>

---

## 9. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | 2026-04-30 | 首版：S3 架构、阶段、安全与验收草案 |
| 0.2 | 2026-04-30 | Phase 0 拆至 `s3-phase-0-plan.md`；§3.1 / §8 交叉引用 |
| 0.4 | 2026-04-30 | D1 迁入 `packages/browser-deps-audit`（`@repo/browser-deps-audit`） |
