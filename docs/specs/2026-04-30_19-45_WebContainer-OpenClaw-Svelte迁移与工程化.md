# SDD Spec: WebContainer OpenClaw — Svelte 宿主迁移与工程化（组件库 / 状态 / 样式）

## RIPER 状态机（热上下文）

| 字段 | 值 |
|------|-----|
| **phase** | `Review`（实现已落地；svelte-check + build 已通过） |
| **approval status** | `Plan Approved`（用户于 2026-04-30 以「开始执行」授权 Execute） |
| **spec path** | `docs/specs/2026-04-30_19-45_WebContainer-OpenClaw-Svelte迁移与工程化.md` |
| **active_project** | `webcontainer-openclaw` |
| **active_workdir** | `demos/webcontainer-openclaw` |
| **change_scope** | `local` |

### 与上级 Spec 的关系

- **产品真相源**：仍以 [docs/prd/prd-webcontainer-openclaw.md](../prd/prd-webcontainer-openclaw.md) 为准；终端 / 预览行为验收对齐 [2026-04-30_18-03_WebContainer-OpenClaw-终端与预览.md](./2026-04-30_18-03_WebContainer-OpenClaw-终端与预览.md) **§7 Plan-Execution Diff**。
- 上级 Spec **§9** 定义了「迁 Svelte 5 + Vite、行为不变、不切 SvelteKit」边界；**本 Spec 在其上收口**：组件库、状态分层、样式与工具链细节，并替换 §9 中「可选实践」为 **必选工程约束**。
- **样式与 IA**：以 PRD 为唯一产品约束；**不要求**与迁移前 `demos/webcontainer-openclaw` 页面视觉（色板、间距、组件长相）一致——详见 **§1.2**。

---

## 0. Open Questions

- [ ] **预览状态区 HTML**：当前 `previewStatus.innerHTML` 注入片段；迁 Svelte 后采用 **`{@html}`**（继续 trusted-demo 假设）或改为结构化组件 —— **默认**：保持 `{@html}` + 已有 escape 辅助，减少范围。
- [ ] **组件库粒度**：首版采用 **bits-ui（Tabs + Button 等 headless）**；若你希望 **shadcn-svelte 全量 CLI 初始化**（更多样板文件），可在批准 Plan 前回复切换 **Innovate Decision**。

---

## 1. Requirements (Context)

## 1.1 Context Sources

| 类型 | 路径 |
|------|------|
| 产品 | `docs/prd/prd-webcontainer-openclaw.md` |
| 行为基线 | `docs/specs/2026-04-30_18-03_WebContainer-OpenClaw-终端与预览.md` |
| 实现参考（行为/结构） | `terminal.ts`、`preview.ts`、`vite.config.ts`、`package.json`；**`main.ts` 仅作逻辑搬迁参考，样式不参考** |

### Goal

- 将 `demos/webcontainer-openclaw` 从 **巨型 `main.ts` + 手写 DOM** 迁移为 **Svelte 5（runes）+ Vite**，并符合当前社区主流分层：
  - **组件库**：引入 **主流 headless + Tailwind 友好** 方案（见 §3），覆盖 Tab、工具栏按钮等；避免继续手写 `createElement`。
  - **状态管理**：以 **Svelte 5 `$state` / `$derived` + 显式 Context** 为主；**命令式对象**（`Terminal`、`WebContainer` Promise）**不**塞入响应式深层 props；跨组件仅传递「句柄 / 回调 / 轻量标志」。
  - **样式方案**：采用 **Tailwind CSS v4 + `@tailwindcss/vite`**（工程惯例）+ **`cn()`（clsx + tailwind-merge）**；**视觉与布局验收仅以 PRD 为准**（§1.2），不照搬当前仓库 demo 的类名与配色。
- **行为不变**：与上级 Spec §7 一致（Tab 挂载策略、xterm 输入、stdin 转发、`terminal.config.json`、`attachPreview`、`pnpm`/PoC 流程、COOP/COEP）。

### 1.2 样式与布局真相源（产品）

以 [docs/prd/prd-webcontainer-openclaw.md](../prd/prd-webcontainer-openclaw.md) 为 **唯一** 产品约束，至少覆盖：

- **§3.1** 宿主布局与信息架构：顶部 **终端 / 预览** Tab、**无品牌/主标题栏**、**全屏工作区**（`100vh` / `100dvh` 语义，扣减 Tab/极简状态高度）、页面精简、Tab 切换 **保持挂载**。
- **§5.0** 单面板全屏草图与 **验收标准**（无大面积占位卡片、工作区为主、根容器铺满窗口等）。
- **§5.1 / §5.2** 终端区与预览区能力描述中隐含的 **空间关系**（xterm / iframe **铺满**主内容区，预览工具条等不挤占 PRD 禁止的「装饰性大块」）。
- **§7** 可访问性：终端与预览有 **可聚焦 / 语义** 区域；关键状态有 **`aria-live` 或等价**（延续 PRD 表述，不要求与旧实现同一 DOM 结构）。

**明确非目标**：当前 `src/main.ts` 中的 **Tailwind 色值、Tab/按钮具体样式、`banner` 配色文案排版** 等均 **不作为** 迁移对标物；可在满足 PRD 前提下任意重做主题 tokens。

### In-Scope

- `demos/webcontainer-openclaw` 内：`package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、`src/**`；新增 `svelte.config.js`（或 `.ts`）。
- 依赖：`svelte`、`@sveltejs/vite-plugin-svelte`、`bits-ui`（及 peer）、`tailwind-merge`、`clsx`；**dev**：`svelte-check`、`@tsconfig/svelte`（推荐）。
- 将 `terminal.ts`、`preview.ts` 保留为 **纯 TS**（路径可调至 `src/lib/server/` 或 `src/lib/wc/` 等，仅重构 import）。

### Out-of-Scope

- **不引入 SvelteKit**（保持 SPA demo；后续单独立项）。
- 不改 PRD 产品语义；**无障碍不低于 PRD §7**（bits-ui / 手写语义均可）；不得以「还原旧 UI」为由删减 PRD Must。
- 不跨仓库修改其他 app/package（`change_scope=local`）。

---

## 1.5 Codemap Used（最小索引）

- **入口（迁移后）**：`index.html` → `src/main.ts` → `mount(App, …)`。
- **命令式核心**：`terminal.ts`（`runShellLine`、`runSpawn`、`createLogRing`…）、`preview.ts`（`attachPreview`）。
- **WC 单例**：由 `main.ts` 内 `bootWebContainer` 迁出至 **`src/lib/webcontainer/boot.ts`**（或等价路径）。

---

## 1.6 Context Bundle Snapshot（Lite）

- **现状**：`main.ts` ~530 行，混合 UI 与业务逻辑；**其 UI 类名与配色对迁移无约束力**。
- **缺口**：无 Svelte；需按 PRD 与 §4 重建壳层与组件样式。

---

## 2. Research Findings

### 2.1 生态与选型结论（2026 主流倾向）

| 维度 | 推荐 | 说明 |
|------|------|------|
| 框架 | **Svelte 5 + Vite** | 与上级 §9 一致；`mount` 入口。 |
| 组件库 | **bits-ui** | Headless、可访问性友好、与 Tailwind 组合常见；体量可控，适合 demo。shadcn-svelte 亦流行但带来更多初始化模板 —— 列为备选（§3）。 |
| 状态 | **Runes + Context** | 界面标志位（`busy`、`activeTab`）用 `$state`；子组件用 `setContext`/`getContext` 传递「终端会话 Facade」（方法 + 只读 getter），避免 `$state.raw` 包裹 xterm。 |
| 样式 | **Tailwind v4 + `cn()`** | 工程手段；**tokens/排版按 PRD §3.1 / §5.0 / §7 重新设计**，与旧 demo 脱钩。 |

### 2.2 技术约束

- **xterm / WebContainer**：必须在 **`onMount` / `onDestroy`**（或专用 action）中 `open`/`dispose`；**FitAddon** + **ResizeObserver** 逻辑迁入 `TerminalPanel.svelte`。
- **Tab 保持挂载**：仅用 CSS `hidden` / `aria-hidden`，不销毁 iframe —— 与现行为一致。
- **构建**：`pnpm --filter webcontainer-openclaw build`（workspace 包名与 `package.json` `name` 一致）。

### 2.3 风险

| ID | 说明 | 缓解 |
|----|------|------|
| R1 | bits-ui Tab 与 PRD「极简顶栏」对齐成本 | 以 PRD §5.0 为准收敛；主题用 Tailwind `data-[state=…]` 等覆盖 |
| R2 | Svelte 5 + Tailwind 4 类型与 vite 插件顺序 | 按官方文档排列 `plugins: [tailwind(), svelte()]`（顺序以本文 Execute 时官方为准） |

---

## 3. Innovate（Options & Decision）

### Q1：组件库路径

| Option | 说明 | Pros | Cons |
|--------|------|------|------|
| **A（推荐）** | **bits-ui**（Tabs、Button 等）+ Tailwind | 轻量、主流 headless、无障碍基线好 | 视觉需自己调 |
| B | **shadcn-svelte** 完整初始化 | 现成视觉与文档 | 样板文件多、升级需跟 CLI |

**Decision**：**A — bits-ui**（若执行前用户明确要求 B，回写本段并调整 §4 依赖与目录）。

### Q2：全局状态是否要 `svelte/store`

| Option | 说明 |
|--------|------|
| **A（推荐）** | 不用全局 store；`App.svelte` 持有 `$state`，`setContext('openclaw-shell', …)` |
| B | `writable` 存储 `busy` / `activeTab` |

**Decision**：**A** —— 符合 Svelte 5 官方倾向；仅在若未来多根挂载时再引入 store。

### Q3：样式辅助与视觉边界

**Decision**：新增 `src/lib/utils/cn.ts`：`export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }`（类型以实际依赖为准）。**xterm** 仅需 **对比度可读、类 VS Code 终端交互**（PRD §5.1）；具体 theme 对象 **不继承** 旧 `main.ts` 硬编码色值，除非碰巧与 PRD 验收一致。

---

## 4. Plan（Contract）

### 4.1 File Changes（预期）

| 路径 | 变更 |
|------|------|
| `package.json` | 增加 `svelte`、`@sveltejs/vite-plugin-svelte`、`bits-ui`、`clsx`、`tailwind-merge`；dev 增加 `svelte-check`、`@tsconfig/svelte`（可选 strict）。 |
| `vite.config.ts` | 引入 `@tailwindcss/vite` + `@sveltejs/vite-plugin-svelte`；保留 COOP/COEP headers。 |
| `svelte.config.js` | 新建；`vitePreprocess` 或默认预处理 + `typescript` 校验路径。 |
| `tsconfig.json` | `extends` 含 Svelte 推荐；`include` 含 `*.svelte`。 |
| `src/main.ts` | 仅 `import './app.css'`、`import App from './App.svelte'`、`mount(App, target)`。 |
| `src/App.svelte` | 根布局；`setContext` 注入 shell API。 |
| `src/lib/components/OpenClawShell.svelte` | Banner + Tab 条 + panel 栈；bits-ui **Tabs**。 |
| `src/lib/components/TerminalPanel.svelte` | 工具栏 + xterm 容器 `bind:this` + 生命周期。 |
| `src/lib/components/PreviewPanel.svelte` | 状态文案 + iframe + 工具钮。 |
| `src/lib/webcontainer/boot.ts` | `bootWebContainer`、`ensureWorkspace`、`tree` 常量迁移。 |
| `src/lib/terminal-session.ts`（或等价） | 封装 `executeShellLine`、`poc` 流程对外异步接口，供 Svelte 调用（内部仍用 `terminal.ts`）。 |
| `src/terminal.ts`、`src/preview.ts` | 逻辑保留；必要时仅改 import 路径。 |
| `src/app.css`（或等价全局样式入口） | `@import "tailwindcss"`；**CSS 变量 / 主题按 PRD 壳层与可读性自定**，无需对齐旧 `style.css`。 |
| `README.md`（demo 内） | 补充：Svelte 5、bits-ui、开发命令。 |

### 4.2 Signatures（示意）

- `cn(...inputs: ClassValue[]): string`
- `bootWebContainer(): Promise<WebContainer>`
- `createTerminalSession(opts: { cfg, isolated, ... }): { ... }` —— **facade 接口在 Execute 前写清字段**（避免过拟合此处）。

### 4.3 Implementation Checklist

- [x] **P1 工具链**：安装依赖；`svelte.config.js`；`vite.config.ts` 插件链；`tsconfig` 支持 `.svelte`。
- [x] **P2 样式**：`app.css` + Tailwind；`cn.ts`；**按 PRD §3.1 / §5.0 / §7 实现布局与 IA**（Tab、banner/COI、全屏面板、工具条位置）；**不**要求复刻旧 demo 的 Tab/按钮/色板。
- [x] **P3 bits-ui**：`OpenClawShell` 使用 Tabs；工具栏为原生 `button` + Tailwind + `cn()`（与 Plan 中「或原生 button」一致）。
- [x] **P4 xterm**：`TerminalPanel` 内 `onMount` 打开终端、返回时 `dispose`；`ResizeObserver`；`term.onData` 接 `terminal.ts`。
- [x] **P5 预览**：`PreviewPanel` 绑定 `attachPreview` 与 `{@html}` 状态区；iframe `sandbox` 不变。
- [x] **P6 PoC / 中止 / 预设**：事件接线至与旧 `main.ts` 等价的 `boot` + `terminal` 流程。
- [x] **P7 验证**：`pnpm --filter webcontainer-openclaw build`；`pnpm exec svelte-check` 0 error；手测留作人工 Review（Tab 保持挂载由 bits-ui `hidden` 实现保证）。

### 4.4 Spec Review Notes（Execute 前可选）

- 建议执行 `review_spec`：`plan_only`，重点 checklist 原子性与验收可对齐 §7。

---

## 5. Execute Log

- [x] 依赖：`svelte`、`@sveltejs/vite-plugin-svelte@6`、`bits-ui`、`@internationalized/date`、`clsx`、`tailwind-merge`、`svelte-check`、`@tsconfig/svelte`。
- [x] 新建 `svelte.config.js`、`vite.config.ts`（`tailwind` + `svelte`，`$lib` alias，COOP/COEP）、`tsconfig.json` paths、`src/vite-env.d.ts`。
- [x] `src/main.ts` → `mount(App)`；`App.svelte`、`OpenClawShell.svelte`、`TerminalPanel.svelte`、`PreviewPanel.svelte`；`src/lib/webcontainer/boot.ts`、`src/lib/utils/cn.ts`。
- [x] 删除旧巨型 `main.ts` 与 `src/style.css`，入口样式改为 `src/app.css`（PRD 导向变量主题）。
- [x] 验证：`pnpm --filter webcontainer-openclaw build` ✓；`pnpm --filter webcontainer-openclaw check` ✓（0 errors / 0 warnings）。
- [ ] 人工烟雾（可选记录）：Tab / xterm / stdin / PoC / 预览 URL。

---

## 6. Review Verdict

| 轴 | Verdict | 证据 |
|----|---------|------|
| Spec 质量与需求达成 | PARTIAL | 代码已按计划迁移；手测未在本环境执行 |
| Spec-代码一致性 | PASS | 组件拆分、`boot.ts`、`terminal.ts` 保留、bits-ui Tabs、`cn()`、PRD 导向样式 |
| 代码内在质量 | PASS | `svelte-check` 净零、`build` 通过 |

- **Overall Verdict**：PARTIAL（待本地浏览器手测后可为 PASS）
- **Blocking Issues**：无（构建侧）

---

## 7. Plan-Execution Diff

| Plan | 实际 |
|------|------|
| `src/lib/terminal-session.ts` facade | **省略**：逻辑直接在 `TerminalPanel.svelte` 内接线，减少间接层 |
| bits-ui **Button** | **省略**：工具栏使用原生 `button` + Tailwind（Plan 已允许「或原生 button」） |
| `App.svelte` `setContext` | **省略**：当前仅靠 props（`wirePreview`）；后续扩展可加 context |

---

## 8. Change Log

| 日期 | 摘要 |
|------|------|
| 2026-04-30 | 首版：`sdd_bootstrap` 式扩充 §9；定 bits-ui + runes/context + Tailwind+cn；Plan 与 checklist 落盘。 |
| 2026-04-30 | 用户澄清：**样式与 IA 仅以 PRD 为准**，不要求参考/对齐现有 demo 视觉；新增 §1.2、修订 Goal/§2/§3 Q3/§4/P2/P7/§9。 |
| 2026-04-30 | **Execute**：Svelte 宿主落地；§5/§6/§7 回填；`phase→Review`。 |

---

## 9. Validation（证据）

| 命令 | 预期 |
|------|------|
| `pnpm --filter webcontainer-openclaw build` | exit 0 |
| `pnpm --filter webcontainer-openclaw exec svelte-check` | 2026-04-30：0 errors, 0 warnings |
| 手工 | PRD §5.x + 上级 §7：须在浏览器 dev/preview 下自测（本环境未跑） |

---

## 10. Recovery / Reverse Sync

- 闭环后：更新 `demos/webcontainer-openclaw/README.md`；在上级 Spec §9.5 标注「已由 `2026-04-30_19-45_...` 取代执行细节」并链到本文件。
