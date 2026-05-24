# 包状态：`web-os`

| 字段 | 说明 |
|------|------|
| **状态** | **废案**（选型过程产物，已放弃） |
| **标记日期** | 2026-05-24 |
| **含义** | 本包为浏览器运行时选型阶段探索的 **WebContainer（`@webcontainer/api`）** 独立 runtime 封装，**不作为** OpenClaw Web 的正式产品基线或新功能开发起点。 |

## 为何保留在仓库中

- 历史 demo [`demos/webcontainer-openclaw`](../../demos/webcontainer-openclaw) 仍通过 `workspace:*` 依赖本包。
- [`docs/specs/`](../../docs/specs/) 下以 `web-os` 为标题的规格文档保留作**历史决策与实现参考**，不代表当前选型结论。

## 开发约定

- **禁止**：在新应用、新 demo 或正式 `apps/*` 中新增对 `web-os` 的依赖。
- **允许**：为既有 demo 做必要维护、修测、只读查阅 API 与类型。
- **迁移**：若 demo 迁出本包，再评估删除或归档整个目录。

## 选型背景（简述）

仓库在 **WebContainers / Nodepod / BrowserPod** 等浏览器运行时之间做过对比（见 [`docs/reports/browser-runtimes-compatibility.md`](../../docs/reports/browser-runtimes-compatibility.md)）。本包对应 **WebContainer 侧「抽独立 runtime 包」** 的路线；该路线在选型中**未采纳**为后续主方向。

当前正式 runtime / 工作台方向以选型结论与顶层 `PRODUCT.md`、活跃 demo / `apps/*` 为准；勿将本 README 中的 API 表当作「待实现产品 backlog」。
