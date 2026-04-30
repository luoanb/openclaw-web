# SDD Spec: WebContainer OpenClaw — 终端指令管理与 HTTP 预览（PRD 落地）

## RIPER 状态机（热上下文）

| 字段 | 值 |
|------|-----|
| **phase** | `Review`（§4.3.1 已在 `demos/webcontainer-openclaw` 落地；待手测与 Review 勾验） |
| **approval status** | `Plan Approved` 已执行（2026-04-30） |
| **spec path** | `docs/specs/2026-04-30_18-03_WebContainer-OpenClaw-终端与预览.md` |
| **active_project** | `webcontainer-openclaw` |
| **active_workdir** | `demos/webcontainer-openclaw` |
| **change_scope** | `local` |

---

## 0. Open Questions

- **产品真相源**：[docs/prd/prd-webcontainer-openclaw.md](../prd/prd-webcontainer-openclaw.md) **§9.1（q1→q8）**；本 Spec **§3 / §4** 已与 PRD 对齐，冲突时以 PRD 为准。
- **技术仍开放（PRD §9.2）**：**T1** 预览 `iframe + server-ready` vs `preview()` API；**T2** 外链/帮助/刷新入口的最终 IA（非阻断）。
- [x] 宿主 UI：`demos/webcontainer-openclaw` **迁移至 Svelte（Svelte 5 + Vite）** —— 决议见 **§9** 与专 Spec **`2026-04-30_19-45_WebContainer-OpenClaw-Svelte迁移与工程化.md`**（2026-04-30 已落地）。

---

## 1. Requirements (Context)

- **Goal**：在 `demos/webcontainer-openclaw` 上实现 PRD 所述 —— **顶部「终端 / 预览」Tab + 全屏工作区、无品牌/主标题栏**；**xterm 内整行 `sh -c` 提交**；**交互式 stdin / REPL（Must，在 WC API 范围内）**；**单会话**；Tab 切换 **保持挂载、不中断** 运行中进程；**日志截断由单一配置文件** 管理；以及 **HTTP 预览** 与 **PoC 回归**，不破坏「安装 + `npx openclaw --help`」能力。
- **In-Scope**：同 [docs/prd/prd-webcontainer-openclaw.md](../prd/prd-webcontainer-openclaw.md) §3.1（含 §9.1 已确认决策）。
- **Out-of-Scope**：同 PRD §3.2（含：**与 OS 级 PTY 完全等价**、**多会话并行 UI** 等）。

### 1.1 Context Sources

- **Requirement Source**：`docs/prd/prd-webcontainer-openclaw.md`
- **体验增强路线图（VS Code 级分层 / Phase A–D）**：[2026-04-30_21-00_WebContainer-OpenClaw-VSCode级终端体验路线图.md](./2026-04-30_21-00_WebContainer-OpenClaw-VSCode级终端体验路线图.md)
- **Design Refs**：`docs/specs/demos-webcontainer-openclaw-poc.md`、`docs/research/feasibility-openclaw-webcontainers.md`
- **实现现状**（截至 Execute 记录 §5）：`demos/webcontainer-openclaw` — **左右分栏**（终端 / 预览并列）、`main.ts` 含 **独立 `textarea` +「执行」**、`createXterm` 使用 **`disableStdin: true`**（输入不经 xterm）；`terminal.ts` 内 **常量** `LOG_CAP_BYTES` / `MAX_CMD_LEN`；无顶部 Tab、无 stdin 泵。与 **当前 PRD** 相比存在缺口，见 **§7**。

### 1.5 Codemap Used (Feature Index)

- **Codemap Mode**：`feature`（本任务未单独落盘 codemap；以下为执行用最小索引）
- **Codemap File**：_未生成_（可选：后续 `create_codemap(feature=webcontainer-openclaw-终端预览)`）
- **Key Index**：
  - **入口**：`demos/webcontainer-openclaw/index.html` → `src/main.ts`
  - **WC 生命周期**：`bootWebContainer()`、`wc.mount(tree)`、`wc.spawn`
  - **输出**：`drainProcessOutput` + `ReadableStream<string>`（`proc.output`）→ 终端区 **xterm.js** 实例
  - **宿主隔离**：`crossOriginIsolated` 横幅；`vite.config.ts` COOP/COEP

### 1.6 Context Bundle Snapshot

- **Bundle Level**：`Lite`（PRD + PoC Spec + 可行性摘要已内嵌本 Spec）
- **Bundle File**：_未生成_
- **Key Facts**：
  - 完整 OpenClaw 网关在 WC 内不可靠（native / CORS / daemon）；本 Spec 仅增强 **教学沙箱式** demo。
  - 已实现：`server-ready` → iframe、xterm 输出、`sh -c` 单行执行；**尚未**：PRD 要求的 Tab 布局、xterm 内输入、stdin 泵、配置化日志。
- **Open Questions**：见 §0；执行前以 §3 决策为准。

---

## 2. Research Findings

### 2.0 代码与工程事实

- PoC 已封装 `spawn(command, args)` + `proc.output` 流式 drain + `proc.exit` 退出码；可复用为「单进程输出泵」。
- `busy` 标志仅保护按钮点击；扩展为「终端会话」需显式持有 **当前 `WebContainerProcess` 引用** 以支持 `kill`（若 API 暴露）。
- UI 已从单栏日志演进为 xterm + 分栏；PRD 现要求 **顶部 Tab + 单面板全屏**（非默认并排分栏）。

### 2.1 约束与风险

- **中止**：依赖 `@webcontainer/api` 对 `WebContainerProcess` 的终止能力；需在 Execute 前读类型定义或官方文档确认方法名（如 `kill`）。
- **预览 URL**：应优先来自 **`server-ready` 事件**（或官方等价 API），避免宿主随意拼接不可信 URL；混合内容 / COEP 按 WebContainers 官方说明处理。
- **日志体积**：长运行 dev server 可能产生大量 stdout；必须截断以防主线程与内存问题（与 PRD §7 NFR 一致）。

### 2.2 终端技术栈（已定案，随 PRD 升级）

- **运行与进程 I/O**：仅使用官方 **`@webcontainer/api`** —— `WebContainer.boot`、**`spawn`**、对 `WebContainerProcess` 的 **stdout / stderr / stdin** 流式读写（以当前 SDK 类型与文档为准）。
- **终端「页面」展示层**：**[xterm.js](https://github.com/xtermjs/xterm.js)** + **`@xterm/addon-fit`**；**不**自研 ANSI/VT 解析器。
- **输入模型（PRD §9.1 q1/q3/q7）**：
  - **主路径**：用户在 **xterm 内** 编辑；**Enter** 提交 **当前逻辑行**（整行）→ `wc.spawn("sh", ["-c", userLine])`（见 §3 Q1）；**禁止** 独立 `textarea` 作为主路径（过渡期可在 Spec Execute 中保留兼容开关，默认关闭）。
  - **单会话**：若已有前台进程运行中，第二次提交须 **拒绝或排队策略一致**（固定一种并在 UI/帮助说明）；PRD 不允许多 shell Tab。
  - **交互式 stdin（PRD Must）**：当存在 **`process.stdin` 可写** 的前台进程时，`terminal.onData` / 等价回调将用户输入 **写入 `WritableStreamDefaultWriter`**（注意二进制安全与 `\r`/`\n` 语义）；进程结束后回到「整行提交 shell」模式。无法实现的全屏 TUI（依赖真 PTY）列入 README「已知限制」（PRD R2）。
- **输出与截断**：stdout/stderr 合并泵入 `Terminal.write`；环形缓冲上限来自 **`terminal.config.json`**（§3 Q5），运行时读取；详见 **§4.1** 路径约定。
- **页面级前提**：**HTTPS（或 localhost）**、**COOP/COEP**、**`crossOriginIsolated`**；与 `vite.config.ts` 一致。

### 2.3 风险与不确定项

| ID | 说明 |
|----|------|
| R1 | OpenClaw 在 WC 内未必能稳定起 HTTP；预览验收可用 **用户自建 `npx serve` / 静态 server** 演示（PRD R1）。 |
| R2 | `sh -c` 整行执行灵活性高但等同用户态 shell；接受范围为 **内部 demo**，须在界面与文档标明沙箱边界。 |

### 2.4 宿主布局（PRD §5.0 / §9.1）

- **DOM 结构（概念）**：`#app` → **Tab 条**（button/`role=tab`：`终端` | `预览`）+ 可选 **inline 状态**（Boot / COI）+ **overflow 菜单**（外链预览、帮助）；下方 **`main` 单面板**，`height: calc(100dvh − tabs)`。
- **终端 Tab**：`.terminal-host`（xterm）铺满；**中止**、**清空**、PoC、预设等进入 **工具条行或溢出菜单**（避免大块 PoC 文案）。
- **预览 Tab**：iframe 铺满；保留刷新 / 新标签打开；**切换 Tab 不 `removeChild(iframe)`、不 kill 进程**（PRD q4）。
- **删除 / 降级**：页面 **无 `h1` 品牌标题**、无大块 `lede`；`banner`（COI）可保留为一行或可折叠。

### 2.5 Next Actions

1. **`Plan Approved`** → 按 **§4.3.1** Execute；每步勾选并写 **§5 Execute Log**。
2. （可选）补 `create_codemap(feature=webcontainer-openclaw-终端预览)`。

---

## 3. Innovate (Options & Decision)

与 [PRD](../prd/prd-webcontainer-openclaw.md) **§9.1 产品决策** 及 **§9.2 技术待决** 对齐。下列为 **工程可执行** 决策；若与 PRD 冲突，以 PRD 为准。

### Q1：命令解析策略（PRD q1）

| Option | 说明 | Pros | Cons |
|--------|------|------|------|
| **A** | `wc.spawn("sh", ["-c", userLine])` | 与「整行 shell」一致 | 等同用户态 shell，需在 UI/文档警示 |
| B | 白名单 `spawn` | 更安全 | 与 PRD「整行试参」冲突 |

**Decision**：**A**；**最大行长**取配置 `maxCmdLen`（默认 `8192`）；空行不 spawn。

### Q2：交互式 stdin / REPL（PRD q2）

**Decision（已反转旧 Spec）**：**Must 支持** —— 在 `WebContainerProcess` 暴露 **`stdin` WritableStream** 时，将 **xterm 用户输入** 泵入 stdin；与「整行 `sh -c`」二态调度：**无前台交互进程时** Enter 提交整行；**有前台且 stdin 打开时** 进入 raw/字符转发模式（具体以 SDK 能力为准，最小可行：**逐块 write**）。无法实现的全屏 TUI 记入帮助「已知限制」。

### Q3：预览技术路径（PRD §9.2 T1）

| Option | 说明 | Pros | Cons |
|--------|------|------|------|
| **A** | `server-ready` + 宿主 `iframe` | 当前已实现、与教程一致 | 受浏览器策略约束 |
| B | 官方 `preview()`（若存在） | 封装可能更完整 | 需版本核对 |

**Decision**：**优先维持 A**（已实现）；若后续换 B，在 **同一 Spec Change Log** 记录并与验收对照。

### Q4：单会话（PRD q7）

**Decision**：**单会话** —— 运行中进程存在时，第二次命令：**默认禁用提交并提示**（实现成本低）；若选「自动 kill 再跑」须在 UI 明确高风险。**禁止** 多 shell 并行标签。

### Q5：日志体积（PRD q8）

**Decision**：单一配置文件 **`demos/webcontainer-openclaw/terminal.config.json`**（构建时可 `import` 或由启动脚本拷贝），**推荐默认**（与旧常量对齐以便迁移）：

```json
{
  "logMaxBytes": 409600,
  "logMaxLines": 2000,
  "maxCmdLen": 8192,
  "truncateStrategy": "drop-head",
  "truncateMarker": "[… 日志已截断 …]"
}
```

- 解析失败时回退上述默认；**禁止** 静默失败无上限。
- `writeCapped` / 等价逻辑改为读配置结构体（见 §4.2 签名补充）。

### Q6：布局 IA（PRD §5.0 / q4/q5）

**Decision**：**顶部双 Tab**（终端 | 预览）+ **单面板全屏**；**无品牌/主标题栏**；Tab 切换 **不卸载 iframe、不 kill** 未中止进程。

### Skip Innovate

- **Skipped**：`false`

---

## 4. Plan (Contract)

### 4.1 File Changes（PRD 升级后目标）

| 路径 | 变更说明 |
|------|----------|
| `demos/webcontainer-openclaw/terminal.config.json` | **新建**：日志/命令上限（§3 Q5）；入库；`terminal.ts` 读取，解析失败回退默认。 |
| `demos/webcontainer-openclaw/src/main.ts` | **顶部 Tab**（终端/预览）+ **全屏单面板**；去掉 **`h1`/大块说明**；**主路径移除 `textarea`+执行**；`createXterm` **`disableStdin: false`**；委托 **行提交 + stdin 泵**（`terminal.ts`）；PoC/预设/中止进工具条或溢出菜单；Tab 仅切换可见性，**持久挂载** iframe、**不 kill** 运行中进程。 |
| `demos/webcontainer-openclaw/src/terminal.ts` | **`loadTerminalConfig()`**；`writeCapped` 用配置；扩展 **xterm `onData` 状态机**（空闲 Enter→`sh -c`；交互→stdin）；单会话与 `abort` 协作。 |
| `demos/webcontainer-openclaw/src/preview.ts` | 维持逻辑；调用方保证 iframe **不随 Tab 销毁**。 |
| `demos/webcontainer-openclaw/src/style.css` | **Tab + 全屏**：`100dvh`、`flex` 列、面板 `min-height:0`。 |
| `demos/webcontainer-openclaw/index.html` | `#app` 全高。 |
| `demos/webcontainer-openclaw/README.md`（若有） | stdin 限制、`terminal.config.json` 说明。 |

### 4.2 Signatures（草案）

- `bootWebContainer(): Promise<WebContainer>`
- `loadTerminalConfig(): TerminalConfig` — 失败 → §3 Q5 默认对象
- `runShellLine` / `runSpawn` — 维持；补充 **`pumpStdin(term, process.stdin)`** 或等价（Execute 定稿）
- `abortCurrentShell(ref: ProcessRef): void`
- `attachPreview(wc, iframe, sink): () => void`

### 4.3 Implementation Checklist（首轮 Execute：已完成，仅历史）

**M1 — 终端**

- [x] **M1.1** `crossOriginIsolated` false 时禁止 spawn。
- [x] **M1.2** ~~输入框 +「执行」~~ — **已被 PRD 否定**，见 **§4.3.1 L3**。
- [x] **M1.3** `sh -c`；常量 — **迁移至配置**，见 **§4.3.1 L5**。
- [x] **M1.4** stdout/stderr → xterm；fit。
- [x] **M1.5** `[exit N]`；单会话 busy。
- [x] **M1.6** 中止 kill。
- [x] **M1.7** `aria-live`。

**M2 — 预览**

- [x] **M2.1–M2.4** 已实现。

**M3 — PoC**

- [x] **M3.1–M3.3** 已实现。

### 4.3.1 PRD 对齐缺口（已 Execute 代码落地）

对照 [PRD §5](../prd/prd-webcontainer-openclaw.md)。

- [x] **L1** 顶部 **终端 / 预览** Tab；**单面板全屏**；无 `h1` 主标题；说明文案压缩为开屏短提示 + 外链 `?`。
- [x] **L2** Tab 仅切换 `hidden` / 样式；**iframe 不销毁**；不主动 kill（仅用户「中止」）。
- [x] **L3** **仅 xterm**；已移除主路径 `textarea` /「执行」。
- [x] **L4** `disableStdin: false`；`stdinForwardRef` 在 `runSpawn` 期间将 `onData` 写入 `proc.input`；[`demos/webcontainer-openclaw/README.md`](../../demos/webcontainer-openclaw/README.md) 非 PTY 说明。
- [x] **L5** 根目录 [`terminal.config.json`](../../demos/webcontainer-openclaw/terminal.config.json) + `loadTerminalConfig()`；`writeCapped` 用配置（字节 + 行数 cap）。
- [x] **L6** 单会话：运行中再输入若 **无** stdin 转发则提示先「中止」；有转发时按键进子进程。
- [x] **L7** `pnpm --filter webcontainer-openclaw build` 通过；PRD 手测见 §4.5。

### 4.4 Contract Interfaces

- **无跨包契约**；依赖 `@webcontainer/api`、`@xterm/xterm`、`terminal.config.json`。

### 4.5 Validation（Execute 完成后填写）

- [x] **§4.3.1 L1–L7** 代码侧已覆盖（手测建议 Release 前补勾）。
- [ ] PRD [§5](../prd/prd-webcontainer-openclaw.md)（布局 / 终端 / 预览）— **待本地 Chromium 手测清单**。
- [ ] 手测：Chromium + Vite dev（COOP/COEP）：`npx serve -l 3000` → `server-ready` → **预览 Tab** iframe 可见；**切换 Tab** 服务不中断。
- [ ] 手测：**stdin** — 例如运行中进程读 stdin 或交互 CLI；若个别场景失败，与 README「非 PTY」一致即可。
- [ ] 手测：一键 PoC 仍可用。

### 4.6 Spec Review Notes（Execute 前可选）

- 待 `review_spec` 或人工走查后再填。

---

## 5. Execute Log

- **2026-04-30（首轮）**：落地 `@xterm/xterm` + `@xterm/addon-fit`；新增 `src/terminal.ts`、`src/preview.ts`；`main.ts` **左右分栏**、`textarea`+执行、`disableStdin: true`；`pnpm --filter webcontainer-openclaw build` 通过。
- **2026-04-30（Spec）**：按 [PRD v2](../prd/prd-webcontainer-openclaw.md)（§9.1 q1→q8）**更新本 Spec** §1–§4、§7；**阶段回退 `Plan`**，待 **`Plan Approved`** 后按 **§4.3.1** 实施代码。
- **2026-04-30（Execute 二轮）**：`Plan Approved` 后落地：Tab 全屏、`terminal.config.json`、xterm 行提交 + `proc.input` 转发、`main.ts` 去 `textarea`/品牌标题、样式与 demo README；`pnpm --filter webcontainer-openclaw build` 通过。

---

## 6. Review Verdict

_Execute 完成后使用 `review_execute` 三轴填写。_

---

## 7. Plan-Execution Diff

| PRD / Spec 项 | 当前代码（`demos/webcontainer-openclaw`） | 状态 |
|---------------|------------------------------------------|------|
| 顶部 Tab + 全屏单面板 | `main.ts`：`tab-bar` + `panel-stack`，`100dvh` 壳层 | 已对齐 |
| 无品牌 `h1` | 已移除；仅 Tab + 紧凑 `banner` | 已对齐 |
| Tab 保持挂载 | 两 `tab-panel` 仅 `hidden`；iframe 不移除 | 已对齐 |
| 仅 xterm 输入 | `disableStdin: false`，`onData` 行缓冲 + Enter → `sh -c` | 已对齐 |
| stdin Must | `runSpawn` 持有 `proc.input.getWriter()` → `stdinForwardRef` | 已对齐 |
| `terminal.config.json` | 根目录 JSON + `loadTerminalConfig()` | 已对齐 |
| 单会话 | `busy` + 运行中提示 / stdin 转发分支 | 已对齐 |

---

## 8. Change Log（Spec 本体）

| 日期 | 摘要 |
|------|------|
| 2026-04-30 | 首版：由 PRD `sdd_bootstrap` 式汇总；Innovate 收口 Q1–Q5；Plan 按 M1–M3 拆分。 |
| 2026-04-30 | 路径迁移：SDD 产出统一至 `docs/specs/`（原 `mydocs/specs/`）。 |
| 2026-04-30 | 终端层定案：WebContainer API（`spawn` / stdio 流）+ **xterm.js** 展示；补充 §2.2、§4.1/§4.2/§4.4 与 M1.4；明确 M1 无 stdin 时 xterm 以输出为主。 |
| 2026-04-30 | Execute：`demos/webcontainer-openclaw` 实现 M1–M3；依赖 `@xterm/xterm`、`@xterm/addon-fit`；§4.3 清单已勾选。 |
| 2026-04-30 | **PRD v2 对齐**：重写 §1 Goal、§2.2/2.4/2.5、§3（stdin Must、配置、`terminal.config.json`、Tab IA）、§4（4.3 历史 + **4.3.1** 缺口清单）、§7 Diff 表；**phase→Plan**，**approval→待 Plan Approved**；RIPER 热上下文更新。 |
| 2026-04-30 | **Execute 二轮**：§4.3.1 勾选；§7 Diff 闭合；§5 追加执行记录；**phase→Review**。 |
| 2026-04-30 | **§9**：宿主 UI 迁 Svelte —— **已执行**，详见专 Spec `2026-04-30_19-45_WebContainer-OpenClaw-Svelte迁移与工程化.md`。 |
| 2026-04-30 | **交叉引用**：新增 VS Code 级终端体验路线图专规 `2026-04-30_21-00_WebContainer-OpenClaw-VSCode级终端体验路线图.md`（§1.1 Context Sources）。 |

---

## 9. Pending: Svelte 宿主迁移（micro-spec）

**触发**：用户要求按 `sdd-riper-one-light` 将 `webcontainer-openclaw` 切换为 Svelte，并符合主流实践。

### 9.1 Goal

- 将 `demos/webcontainer-openclaw` 从「单文件巨型 `main.ts` + 原生 DOM」改为 **Svelte 5（runes）+ `@sveltejs/vite-plugin-svelte` + TypeScript**。
- **行为不变**：PRD/§7 已对齐项（Tab、xterm 行提交、stdin 转发、预览 `server-ready`、PoC、`terminal.config.json`、COOP/COEP）保持等价。
- **结构**：符合常见 Svelte+Vite 布局 —— `src/main.ts` 仅 `mount(App, …)`；UI 拆为 `.svelte` 组件；WebContainer/xterm **命令式生命周期**放在 `onMount`/`onDestroy` 或 `lib/*.ts`，避免把终端实例塞进深层 `$state` 树。

### 9.2 Boundary

- **In**：`demos/webcontainer-openclaw` 内 `package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、`src/**`；可新增 `svelte.config.js`。
- **Out**：不改 PRD 语义；不引入 SvelteKit（除非后续单独决议）；不动 monorepo 其他 app。
- **保留**：`src/terminal.ts`、`src/preview.ts` 以 **纯 TS 模块** 保留（路径可迁至 `src/lib/` 并修正 import）；JSON 配置仍从仓库内 `terminal.config.json` 读取。

### 9.3 主流实践要点（实施清单）

1. **依赖**：`svelte`、`@sveltejs/vite-plugin-svelte`；**可选** `svelte-check`、`@tsconfig/svelte` 收紧类型。
2. **入口**：`main.ts` → `import App from './App.svelte'` + Svelte 5 **`mount`**。
3. **组件拆分建议**：根 `App.svelte`；子组件如 `OpenClawShell.svelte`（Tab + banner + panel）；`TerminalPanel.svelte`（toolbar + xterm 挂载点）；`PreviewPanel.svelte`（status + iframe + 工具栏）。Tab 状态用 **`$state`**；无障碍属性保留。
4. **xterm**：在挂载容器 `div` 上使用 **`bind:this`**，`onMount` 内 `Terminal.open` + `FitAddon` + `ResizeObserver`，`onDestroy` 里 `dispose()`，避免泄漏。
5. **WebContainer 单例**：抽至 `lib/webcontainer/boot.ts`（或等价），与 UI 框架解耦。
6. **样式**：全局布局保留现有 `style.css`（或改名为 `app.css` 并在 `App.svelte` / `main.ts` 引入）；尽量少用 `:global`。
7. **验证**：`pnpm --filter webcontainer-openclaw build`；可选 `pnpm --filter webcontainer-openclaw check`（若启用 `svelte-check`）。

### 9.4 Done Contract

- **完成**：demo 可 `dev`/`build`；交互与 §7 表一致（手工烟雾：Tab 切换、命令行、中止、PoC、预览 iframe）。
- **证明**：`pnpm --filter webcontainer-openclaw build` 退出码 0；必要时补充一次本地 `dev` 手测记录于 §5 Execute Log。
- **未完成**：仅文档或未跑通 build / 行为回归缺口未记录。

### 9.5 Approval / Resume

- **执行细则**：专 Spec **[2026-04-30_19-45_WebContainer-OpenClaw-Svelte迁移与工程化.md](./2026-04-30_19-45_WebContainer-OpenClaw-Svelte迁移与工程化.md)**。
- **状态**：**`implementation completed`**（2026-04-30）；构建验证：`pnpm --filter webcontainer-openclaw build` + `check` 已通过；浏览器手测以专 Spec §5/§9 为准。
- **本节 §9 micro-spec**：保留为历史摘要；以后变更以专 Spec 为真相源。
