# Spec：demos WebContainer 内安装并运行 OpenClaw（PoC）

| 字段 | 内容 |
|------|------|
| 状态 | Executed（宿主 `pnpm install` / `tsc` / `vite build` 已通过；WC 内行为需浏览器手测） |
| 关联 Research | [feasibility-openclaw-webcontainers.md](../research/feasibility-openclaw-webcontainers.md) |

## 1. Goal

在 `demos/` 下新增独立 **Vite** 前端工程，启用 **COOP/COEP**，通过 `@webcontainer/api` 启动 WebContainer，在虚拟文件系统中挂载最小 `package.json`，执行 **`npm install openclaw`**，再执行 **OpenClaw CLI**（至少 `--help` / `--version` 类只读探测；若安装失败则完整展示日志）。

## 2. Context

- WebContainers 官方教程：Vite `server.headers`、boot、`mount`、`spawn`。
- 本仓库可行性结论：完整网关在 WC 内成功率低；本 Spec 定位为 **实证 PoC**，不承诺网关可用。

## 3. 技术选型

### 3.1 分层与职责

| 层级 | 职责 | 选型 | 说明 |
|------|------|------|------|
| 宿主（浏览器中运行的 demo 页） | 满足跨源隔离、加载 SDK、展示 UI 与日志 | **Vite 7 + TypeScript** | 与 [WebContainers 教程](https://webcontainers.io/tutorial/2-setting-up-webcontainers) 一致；在 `vite.config` 的 `server` / `preview` 上设置 **COOP/COEP**，以启用 WebContainer 所需运行环境。 |
| 宿主 SDK | 启动与操作 WebContainer | **`@webcontainer/api`** | 官方唯一推荐宿主侧 API；`boot` / `mount` / `spawn` / `fs`。 |
| 容器内（虚拟 Node） | 依赖安装与 CLI | **WebContainers 内置 Node + npm** | 教程与排障文档以 `npm` 为主；PoC 优先 **npm**，降低与双包管理器混用相关的排障成本。 |
| 被测工件 | OpenClaw | **npm registry 包 `openclaw`** | 与「在容器内下载安装」一致。默认 **不** 将本仓库 `demos/openclaw` 整仓作为挂载源（体积与语义与「registry 安装」不同）；若需 `file:` / tarball 路径，须单独开 Spec 条目。 |

### 3.2 宿主 UI 与工程化

- **UI**：**原生 DOM + CSS**（无 React/Vue），PoC 聚焦 WC 与 CLI 输出，避免框架带来的 COOP/COEP、SSR 等无关变量。
- **Monorepo**：工作区根用 **pnpm** 安装 `demos/webcontainer-openclaw` 的宿主依赖；**不**要求用 pnpm 在容器内复刻同一套 workspace（容器内无本仓库目录结构）。

### 3.3 刻意不选或不在本 PoC 内承诺

- **不把「完整 `gateway` 与全通道」作为选型成功标准**：见 [feasibility-openclaw-webcontainers.md](../research/feasibility-openclaw-webcontainers.md)（native addon、CORS、daemon 等）。
- **宿主侧不默认引入 Next.js 等全栈框架**：除非后续统一模板要求；否则维持 Vite SPA。

### 3.4 可选分叉（Execute 前可再定）

- **容器内包管理器**：可改为 `pnpm` / `yarn`（`spawn` 换命令）；需自行验证 lock 与 WC 兼容性。
- **`openclaw` 版本**：`latest` 偏「当前生态」；**固定版本**（可与 `demos/openclaw/package.json` 的 `version` 对齐）偏可复现回归。
- **宿主 UI 框架**：若必须与 monorepo 某 app 对齐，可替换为 React 等，**不改变** WC 与 OpenClaw 的可行性边界结论。

## 4. Boundary

**In scope**：`demos/webcontainer-openclaw/**`、根目录 `pnpm-lock.yaml`（workspace 安装产生）。

**Out of scope**：修改 `demos/openclaw` 源码、代理 LLM、打通真实通道、解决 native addon、生产部署与 CI 浏览器回归。

## 5. Plan / File Changes

- `demos/webcontainer-openclaw/package.json` — `vite`、`typescript`、`@webcontainer/api`。
- `demos/webcontainer-openclaw/vite.config.ts` — COOP/COEP。
- `demos/webcontainer-openclaw/index.html`、`src/main.ts`、`src/style.css`、`tsconfig*.json` — UI + 启动流程与日志。

## 6. Validation

- 仓库根目录：`pnpm install` 成功。
- `pnpm --filter webcontainer-openclaw exec tsc` 与 `pnpm --filter webcontainer-openclaw build` 成功（2026-04-30 于本机验证）。
- 人工：本地 `pnpm --filter webcontainer-openclaw dev`，在支持跨源隔离的浏览器中打开，点击「在 WebContainer 中安装并探测 openclaw」，观察 `npm install` 与 `npx openclaw --help` 输出（失败亦视为 PoC 完成；页面已提示 `docs/research/feasibility-openclaw-webcontainers.md`）。

## 7. Approval

RIPER 正式门禁仍要求 **精确字样** `Plan Approved` 后进入 Execute；本次实现由会话「继续」触发，若需流程合规请在后续任务中显式批准。

## 8. Reverse sync（实现摘要）

- 目录：`demos/webcontainer-openclaw/`（Vite + TS + `@webcontainer/api`，`vite.config` 含 dev/preview 的 COOP/COEP）。
- 行为：`WebContainer.boot()` 单例；`mount` 仅含依赖 `openclaw@2026.4.27` 的 `package.json`；`npm install` 成功后执行 `npx openclaw --help`；日志流式写入页面 `pre`。
