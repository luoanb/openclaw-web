# 可行性报告：在 WebContainers 中运行 OpenClaw

| 字段 | 内容 |
|------|------|
| 文档类型 | 技术可行性研究（Feasibility Study） |
| 状态 | Draft |
| 最后更新 | 2026-04-30（§5.1 / 修订 0.2） |
| 关联方法论 | SDD-RIPER-one（Research 产出，非经批准的执行 Spec） |

---

## 1. 摘要

**结论（执行摘要）**：在纯 [WebContainers](https://webcontainers.io/) 环境中运行与「本机 / VPS 上完整 OpenClaw 网关」**等价**的产品形态，**当前不具备可行性与可维护性**；主要受限于浏览器沙箱下的 **原生 Node 扩展**、**出站网络与 CORS 语义**、**无操作系统级守护进程与通道栈**，以及 OpenClaw 产品对 **local-first 网关** 的定位。

**推荐方向**：将「浏览器 / WebContainers」限定为 **控制面（Control UI）或教学沙箱**；**数据面与网关进程**部署在受控的 **本机、WSL2 或 VPS**。若需「仅浏览器、零外部服务器」，应单独立项为 **裁剪发行版或 Mock 网关**，并单独评估安全与功能边界。

---

## 2. 背景与问题陈述

### 2.1 WebContainers

WebContainers 由 StackBlitz 提供，在浏览器中提供 **Node 兼容运行时**、虚拟文件系统及包管理器体验，用于在 Web 应用中嵌入可交互的开发/运行环境。官方能力描述见 [webcontainers.io](https://webcontainers.io/)。

### 2.2 OpenClaw

OpenClaw（[github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)）为 **自托管个人 AI 助手 / 网关**：推荐 **Node 22.14+ / Node 24**，提供 `onboard`、`gateway`、多即时通讯通道、工具链（含 exec、浏览器自动化、cron 等）及可选 **systemd/launchd** 守护进程安装路径。官方文档见 [docs.openclaw.ai](https://docs.openclaw.ai/start/getting-started)。

### 2.3 待判定问题

> 是否可以在 WebContainers 中运行 OpenClaw（含网关与通道），以达到与常规本机部署相当的效果？

本报告对该问题做 **技术可行性判定**，并给出 **可选方案分级** 与 **后续决策输入**。

---

## 3. 评估方法

1. 对照 **OpenClaw 运行时假设**（Node 版本、持久进程、文件布局、网络、系统服务）与 **WebContainers 公开约束**（官方文档与排障说明）。
2. 识别 **硬约束**（不可通过配置消除）与 **软约束**（可通过代理、裁剪、架构拆分缓解）。
3. 输出 **方案分级**、**推荐路径**、**验证清单**（若进入 PoC 阶段）。

本报告不依赖对 OpenClaw 私有构建或闭源组件的审计；若依赖树随版本变化，结论需在 PoC 中 **用具体版本复验**。

---

## 4. 技术分析

### 4.1 原生扩展（Native Addons）

WebContainers 文档说明：环境以 **JavaScript 与 WebAssembly** 为主，**原生 addon 默认禁用**（`--no-addons`），除非存在纯 JS 或可编译为 Wasm 的替代路径，否则会出现无法加载原生模块的错误。参考：[WebContainers Troubleshooting — Cannot load native addon](https://webcontainers.io/guides/troubleshooting)。

**影响**：OpenClaw 及其生态依赖中，凡依赖 **Node 原生绑定**（常见于加密、压缩、数据库驱动、部分通道客户端）的链路，在 WebContainers 中 **高概率不可用**，且无法仅靠「换 Node 版本」解决。

### 4.2 网络与浏览器安全模型

WebContainer 内发起的请求仍受 **浏览器同源策略与 CORS** 等约束；这与传统服务器上 Node 进程的出站语义 **不一致**。第三方集成与 LLM API 是否允许自浏览器来源、是否依赖服务端密钥模式，需 **逐一对照**。

**影响**：即便纯 JS 网关能启动，**通道连接、Webhook、部分云 API** 也可能在 WebContainer 中失败或需 **同源代理 / 后端转发**，从而已偏离「纯浏览器自托管」定义。

### 4.3 守护进程与生命周期

OpenClaw 推荐路径包含 **`--install-daemon`**（launchd/systemd）。WebContainers **不提供** 与 macOS/Linux 等价的用户态常驻服务模型；进程生命周期绑定 **浏览器标签页**，关闭即失。

**影响**：无法复用现有「安装为系统服务」的运维模型；仅能作为 **会话内演示**，除非由宿主页面实现持久化与恢复策略（仍不等于真 daemon）。

### 4.4 通道与系统级能力

多通道（WhatsApp、Telegram、Signal、iMessage 等）往往涉及 **长连接、专有协议栈、本机凭证或配套进程**。WebContainers 不提供完整 **TCP/UDP/DNS 与本机 OS API** 语义（与在真机 Node 上假设的能力集不同）。

**影响**：**完整通道矩阵**在纯 WebContainer 中 **不可作为默认目标**；最多保留 **HTTP/WebSocket 友好且无需 native** 的子集，且需单独认证。

### 4.5 Node 版本与兼容性

OpenClaw 要求 **Node 22.14+ / 推荐 24**。WebContainers 所内嵌 Node 版本由 StackBlitz 演进决定，**未必**与 OpenClaw 发布节奏对齐；属 **软风险**，可通过关注 WebContainers 发布说明缓解，但 **不抵消** 上述硬约束。

---

## 5. 方案对比

| 方案 ID | 描述 | 可行性 | 备注 |
|---------|------|--------|------|
| **S0** | 在 WebContainer 内 `npm i` 官方包并直接运行完整 `gateway` + 全通道 | **低** | 极可能在 native、网络、通道、daemon 多层失败 |
| **S1** | 网关运行于本机/VPS；浏览器（可含 WebContainer）仅承载 **Control UI** 或静态资源 | **高** | 与 OpenClaw 现有「浏览器打开 Dashboard」一致 |
| **S2** | WebContainer 内运行 **协议兼容 Mock / 教学网关**，不接真实通道与真实密钥 | **中高** | 适合教程与交互文档；需维护 mock 与真网关差异 |
| **S3** | 维护 **OpenClaw-Browser** 裁剪发行版：无 native、通道插件化、出站经固定代理、明确安全模型 | **中（成本高）** | 接近新产品线；需安全评审与长期维护承诺；**展开设计见** [solution-s3-openclaw-browser.md](./solution-s3-openclaw-browser.md) |

---

## 5.1 S3 方案展开（延伸阅读）

若需将 S3 从「方向」推进到立项与排期，请阅读：[solution-s3-openclaw-browser.md](./solution-s3-openclaw-browser.md)（架构分层、分阶段交付、安全与验收标准、未决问题）。

---

## 6. 推荐结论

1. **默认推荐**：采用 **S1**（远程或本机真实网关 + 浏览器控制面）。不在 WebContainers 中承载 **可信密钥与完整执行面**，除非有专门的安全设计与审计。
2. **教育 / 营销场景**：采用 **S2**，在文档或课程中明确标注「非生产环境」。
3. **S0** 不建议作为路线图承诺；若业务强需求，应先立项 **S3** 并附 **安全与合规** 章节，再进入 Plan / Execute。

---

## 7. 风险登记

| 风险 | 等级 | 缓解 |
|------|------|------|
| 依赖 native 导致安装或运行失败 | 高 | 不做 S0；S3 需依赖审计与 CI 矩阵含 webcontainer/no-addons |
| CORS / 浏览器出站限制导致 API 不可用 | 高 | S1 网关出站；或经后端代理并明确数据流 |
| 用户误以为「浏览器内 = 与本机同等隐私边界」 | 中 | 文档与 UI 显著区分「演示沙箱」与「真网关」 |
| WebContainers / Node 版本漂移 | 低 | 锁定文档中的版本组合；PoC 回归 |

---

## 8. PoC 验证清单（若需实证）

在选定 OpenClaw 与 WebContainers 的具体版本后，可按序验证（任一步失败可终止 S0 路线）：

1. `npm install`（或 pnpm）是否 **无 native 构建失败**。
2. `openclaw gateway`（或等价入口）是否能在 **无 daemon** 模式下启动并监听 **文档声明端口**。
3. 从同一浏览器上下文访问 **至少一个** 官方支持的 LLM HTTP API，确认 **无 CORS/密钥模式** 阻断。
4. 任选 **一条** 不依赖 native 的通道或 WebChat 路径做端到端 smoke（若存在）。
5. 关闭标签页再打开：**状态持久化**是否符合产品预期（通常不符合完整网关预期）。

---

## 9. 参考资料

- WebContainers 官网：<https://webcontainers.io/>
- WebContainers 排障（含 native addon）：<https://webcontainers.io/guides/troubleshooting>
- OpenClaw 仓库：<https://github.com/openclaw/openclaw>
- OpenClaw Getting Started：<https://docs.openclaw.ai/start/getting-started>

---

## 10. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | 2026-04-30 | 首版：基于公开文档与通用架构约束的可行性结论 |
| 0.2 | 2026-04-30 | 方案表 S3 增加指向 S3 设计文档的链接；新增 §5.1 |
