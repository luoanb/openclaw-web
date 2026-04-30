# SDD Spec: WebContainer OpenClaw — 终端指令管理与 HTTP 预览（PRD 落地）

## RIPER 状态机（热上下文）

| 字段 | 值 |
|------|-----|
| **phase** | `Execute`（M1–M3 已在 `demos/webcontainer-openclaw` 落地；Release 前手测与 §4.5 勾验收） |
| **approval status** | 已执行（用户指令「执行」） |
| **spec path** | `docs/specs/2026-04-30_18-03_WebContainer-OpenClaw-终端与预览.md` |
| **active_project** | `webcontainer-openclaw` |
| **active_workdir** | `demos/webcontainer-openclaw` |
| **change_scope** | `local` |

---

## 0. Open Questions

- [x] Q1–Q5 已在 **§3 Innovate** 给出推荐默认；若产品要改策略，请修订 §3 并同步 §4 checklist。
- [ ] 是否将宿主 UI 从纯 DOM 迁到与 monorepo 某包一致的框架（PoC Spec 列为可选分叉）——**本期默认：维持原生 DOM**，降低 COOP/CEEP 变量。

---

## 1. Requirements (Context)

- **Goal**：在 `demos/webcontainer-openclaw` 上实现 PRD 所述 **可管理终端式交互**（发起命令、流式输出、退出码、尽力中止）与 **容器内 HTTP 服务在宿主页内嵌预览**，不破坏现有「安装 + `npx openclaw --help`」PoC 能力。
- **In-Scope**：同 [docs/prd/prd-webcontainer-openclaw.md](../prd/prd-webcontainer-openclaw.md) §3.1（Must/Should 与里程碑 M1–M3 对齐）。
- **Out-of-Scope**：同 PRD §3.2；完整网关、改 `demos/openclaw`、真 TTY、生产多租户等。

### 1.1 Context Sources

- **Requirement Source**：`docs/prd/prd-webcontainer-openclaw.md`
- **Design Refs**：`docs/specs/demos-webcontainer-openclaw-poc.md`、`docs/research/feasibility-openclaw-webcontainers.md`
- **实现现状**：`demos/webcontainer-openclaw/src/main.ts`（单按钮流水线、`spawnLogged`、`WebContainer.boot` 单例、`mount` 最小 `package.json`）

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
  - 当前无交互式命令行，无 `server-ready` / preview 集成。
- **Open Questions**：见 §0；执行前以 §3 决策为准。

---

## 2. Research Findings

### 2.0 代码与工程事实

- PoC 已封装 `spawn(command, args)` + `proc.output` 流式 drain + `proc.exit` 退出码；可复用为「单进程输出泵」。
- `busy` 标志仅保护按钮点击；扩展为「终端会话」需显式持有 **当前 `WebContainerProcess` 引用** 以支持 `kill`（若 API 暴露）。
- UI 为单栏 `pre` 日志；PRD 要求 **终端区 + 预览区** 布局与独立状态（loading / error / ready）。

### 2.1 约束与风险

- **中止**：依赖 `@webcontainer/api` 对 `WebContainerProcess` 的终止能力；需在 Execute 前读类型定义或官方文档确认方法名（如 `kill`）。
- **预览 URL**：应优先来自 **`server-ready` 事件**（或官方等价 API），避免宿主随意拼接不可信 URL；混合内容 / COEP 按 WebContainers 官方说明处理。
- **日志体积**：长运行 dev server 可能产生大量 stdout；必须截断以防主线程与内存问题（与 PRD §7 NFR 一致）。

### 2.2 终端技术栈（已定案）

- **运行与进程 I/O**：仅使用官方 **`@webcontainer/api`** —— `WebContainer.boot`、**`spawn`**、对 `WebContainerProcess` 的 **stdout / stderr / stdin** 流式读写（以当前 SDK 类型与文档为准）。
- **终端「页面」展示层**：**[xterm.js](https://github.com/xtermjs/xterm.js)** 作为浏览器端终端 UI（VT 解析、颜色、滚屏、选中与常见交互）；与 StackBlitz 官方 starter 及社区 WebContainer IDE 的常规做法一致，**不**自研 ANSI/VT 解析器。
- **数据流（概念）**：
  - 将子进程 **stdout / stderr**（合并策略按实现约定）泵入 **`Terminal.write(...)`**；
  - 用户在 **xterm** 内的按键若 **M1 启用**：须与 §3 **Q2** 对齐 —— **M1 不支持交互式 stdin**，故默认仍由 **输入框 +「执行」** 提交命令，**xterm 主要承担输出渲染**；后续若支持 REPL/TTY，再把 **`onData` → stdin** 接线并单独验收。
- **页面级前提**（与 xterm 无关，但 WebContainer 依赖）：**HTTPS（或 localhost）**、**COOP/COEP 跨源隔离**、**`SharedArrayBuffer`**；与现有 `vite.config.ts` 及 `crossOriginIsolated` 横幅一致。

### 2.3 风险与不确定项

| ID | 说明 |
|----|------|
| R1 | OpenClaw 在 WC 内未必能稳定起 HTTP；预览验收可用 **用户自建 `npx serve` / 静态 server** 演示（PRD R1）。 |
| R2 | `sh -c` 整行执行灵活性高但等同用户态 shell；接受范围为 **内部 demo**，须在界面与文档标明沙箱边界。 |

### 2.4 Next Actions（Research 收口后）

1. 用户确认 §3 **Innovate** 决策或提出修订。
2. 用户发送精确字样 **`Plan Approved`** 后进入 Execute，按 §4 checklist 逐项勾选并同步 **§5 Execute Log**。
3. （可选）补 `docs/codemap/..._webcontainer-openclaw-终端预览功能.md` 便于后续维护。

---

## 3. Innovate (Options & Decision)

对应 PRD §9 开放问题 **Q1–Q5** 的推荐默认（可执行、偏 MVP）。

### Q1：命令解析策略

| Option | 说明 | Pros | Cons |
|--------|------|------|------|
| **A** | `wc.spawn("sh", ["-c", userLine])` | 与「一行 shell」心智一致；实现快 | 等同完整 shell 能力，需在文案中警示 |
| B | 白名单 `spawn(firstToken, restArgs)` | 更安全 | 灵活性差，不符合 PRD「排障试参数」 |

**Decision**：**A**（单行 `sh -c`）；输入框限制最大长度（如 8KiB），禁止空命令；帮助链链到可行性文档。

### Q2：交互式 stdin / REPL

**Decision**：**M1 不支持 stdin**；仅管道 stdout/stderr。若后续需要，单独立项并调研 WC TTY。

### Q3：预览技术路径

| Option | 说明 | Pros | Cons |
|--------|------|------|------|
| **A** | `wc.on("server-ready", (port, url) => …)` + 宿主 `iframe` 加载 `url` | 与官方教程一致、URL 权威 | 受浏览器安全策略约束 |
| B | 官方 `preview` 类 API（若版本导出且文档推荐） | 可能封装更好 | 需对照当前 `@webcontainer/api` 版本实际导出 |

**Decision**：**优先 A**；Execute 第一步读 `node_modules/@webcontainer/api` 类型：若存在一等公民 `preview()` 且文档推荐，可在 **同一 Story** 内改为 B 或 A+B 降级。

### Q4：多进程并发 UI

**Decision**：**M1 单会话**——已存在运行中进程时，新执行要么禁用提交并提示，要么自动「中止再执行」（二选一在 Execute 实现时固定一种并在 UI 说明）；**不**做多标签。

### Q5：日志体积

**Decision**：环形缓冲 **最多 400KB 文本** 或 **约 2000 行**（先实现者取整到常量）；超出时丢弃头部并追加一行 `[… 日志已截断 …]`。

### Skip Innovate（整段是否跳过）

- **Skipped**：`false`（PRD 已列开放问题，必须在 Spec 收口）。

---

## 4. Plan (Contract)

### 4.1 File Changes

| 路径 | 变更说明 |
|------|----------|
| `demos/webcontainer-openclaw/package.json` | 增加 **`xterm`**（及所需 addon，如 `xterm-addon-fit`）依赖；锁版本与 `@webcontainer/api` 一并管理 |
| `demos/webcontainer-openclaw/src/main.ts` | 组装布局：横幅、终端区、预览区、保留/迁移 PoC 一键探测；注册 `server-ready`；接线终端 runner；挂载 **xterm** 容器 DOM |
| `demos/webcontainer-openclaw/src/terminal.ts`（新建） | 命令提交、`spawn`/`sh -c`、输出泵至 **xterm**、退出码、单会话锁、`kill`、日志截断常量；**M1** 不将 xterm 键盘输入接 stdin（与 §3 Q2 一致） |
| `demos/webcontainer-openclaw/src/preview.ts`（新建） | 订阅 `server-ready`、iframe src 绑定、loading/error 占位组件（DOM 工厂或纯函数返回节点） |
| `demos/webcontainer-openclaw/src/style.css` | 分栏布局（终端 / 预览）、可聚焦区域、预览区最小高度 |
| `demos/webcontainer-openclaw/index.html` | 若需根容器 id 调整则最小改动 |

（若倾向单文件以减少文件数，可将 `terminal.ts` / `preview.ts` 合并为 `src/shell-ui.ts`；**Execute 前在 checklist 备注最终路径**。）

### 4.2 Signatures（草案）

- `bootWebContainer(): Promise<WebContainer>` — 保持单例导出或留在 `main.ts`
- `runShellLine(wc: WebContainer, line: string, term: Terminal): Promise<{ code: number }>` — 内部 `sh -c`，chunk 写入 **xterm**（或保留 `sink` 适配层，但 **MVP 以 xterm 为唯一下沉**），可中止
- `abortCurrentShell(): void` — 对当前 `WebContainerProcess` 调用 kill（若存在）
- `attachPreview(wc: WebContainer, iframe: HTMLIFrameElement, status: PreviewStatusSink): () => void` — 返回 detach

### 4.3 Implementation Checklist

**M1 — 终端**

- [x] **M1.1** 在 `crossOriginIsolated` 为 false 时与现有一致：禁止 spawn，提示明确。
- [x] **M1.2** 提供单行或多行输入框 +「执行」按钮；空命令不 spawn。
- [x] **M1.3** 使用 `sh -c` + 单行输入策略；常量 `MAX_CMD_LEN`、`LOG_CAP` 落代码。
- [x] **M1.4** stdout/stderr 合并流式写入 **xterm**（沿用 `drainProcessOutput` 模式，终端为 `Terminal.write`）；**fit** 或等价策略在布局变化时调整尺寸；自动滚底 / 粘底与 xterm 视口一致。
- [x] **M1.5** 进程结束后显示 `[exit N]`；单会话：运行中禁用重复执行或显式排队策略（与 §3 Q4 一致）。
- [x] **M1.6** 「中止」按钮：调用进程 kill（若 API 不支持则按钮 disabled + 文档说明）。
- [x] **M1.7** `aria-live` 保留或增强于终端输出区域。

**M2 — 预览**

- [x] **M2.1** `wc.on("server-ready", …)`（或当前 SDK 等价）更新「预览 URL」状态。
- [x] **M2.2** 页面内 `iframe` 展示；用户可点的「打开预览 / 刷新预览」控件。
- [x] **M2.3** 未启动 / URL 无效 / 加载失败时预览区占位文案（非白屏）。
- [x] **M2.4** 在 UI 或 README 引用 WebContainers 关于 preview / 安全限制的简短说明。

**M3 — PoC 回归与 Should**

- [x] **M3.1** 保留「一键安装并探测 openclaw」为独立按钮或预设命令，行为与现 Spec 一致（`npm install` + `npx openclaw --help`）。
- [x] **M3.2** `pnpm --filter webcontainer-openclaw exec tsc` 与 `pnpm --filter webcontainer-openclaw build` 通过。
- [x] **M3.3**（Should）预设命令快捷：`npx openclaw --help`、可选 `npm run dev` 类占位说明。

### 4.4 Contract Interfaces

- **无跨包契约**；宿主依赖 `@webcontainer/api` 公开事件与 `spawn`，以及 **`xterm` 包** 的 `Terminal` 构造与写屏 API（版本以 demo `package.json` 为准）。

### 4.5 Validation（Execute 完成后填写）

- [ ] PRD §5.1 / §5.2 验收勾选可在 Release 说明或本段逐条对照。
- [ ] 手测：Chromium + 本仓库 Vite dev（COOP/COEP）下：执行 `npx serve -l 3000`（或文档约定最小 HTTP）→ `server-ready` → iframe 可见。
- [ ] 手测：一键 PoC 路径仍可用。

### 4.6 Spec Review Notes（Execute 前可选）

- 待 `review_spec` 或人工走查后再填。

---

## 5. Execute Log

- **2026-04-30**：落地 `@xterm/xterm` + `@xterm/addon-fit`；新增 `src/terminal.ts`（`MAX_CMD_LEN`、`LOG_CAP_BYTES`、`runSpawn` / `runShellLine`、`writeCapped`）、`src/preview.ts`（`server-ready` → iframe）；`main.ts` 分栏（终端 / 预览）、单会话 `busy`、中止 `kill`、快捷填入与 PoC 一键流式输出至 xterm；`pnpm --filter webcontainer-openclaw build` 通过。

---

## 6. Review Verdict

_Execute 完成后使用 `review_execute` 三轴填写。_

---

## 7. Plan-Execution Diff

_待 Execute。_

---

## 8. Change Log（Spec 本体）

| 日期 | 摘要 |
|------|------|
| 2026-04-30 | 首版：由 PRD `sdd_bootstrap` 式汇总；Innovate 收口 Q1–Q5；Plan 按 M1–M3 拆分。 |
| 2026-04-30 | 路径迁移：SDD 产出统一至 `docs/specs/`（原 `mydocs/specs/`）。 |
| 2026-04-30 | 终端层定案：WebContainer API（`spawn` / stdio 流）+ **xterm.js** 展示；补充 §2.2、§4.1/§4.2/§4.4 与 M1.4；明确 M1 无 stdin 时 xterm 以输出为主。 |
| 2026-04-30 | Execute：`demos/webcontainer-openclaw` 实现 M1–M3；依赖 `@xterm/xterm`、`@xterm/addon-fit`；§4.3 清单已勾选。 |
