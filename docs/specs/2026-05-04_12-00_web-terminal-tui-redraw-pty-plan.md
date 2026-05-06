# Web 终端支持「局部重绘 / TUI」— 能力对照与实施方案

**状态：已定稿并已实施（三阶段一并落地）。** 对用户的**能力承诺与「非真 PTY」边界说明**以本文档为准；**不**写入面向终端用户的产品文案或 `demos/webcontainer-openclaw/README.md`（按项目约定：说明留在 Spec / 库 README 技术段落）。

## 0. 背景与结论先导

- **现象**：非编码问题下的**排版错位**；本机 PTY 上依赖**光标寻址、清区、滚屏区、备用屏幕**等机制的界面正常，在 **xterm.js + WebContainer** 中曾异常或易被 `clear()` 破坏。
- **先前误区的纠正**：仅在 **ResizeObserver / `fit()` 调用频率** 上做文章，**不能替代**「真终端重绘」所需的语义；本方案**未**把 RO 去重作为主修复。
- **本方案的核心主张**：先把**真正终端里重绘依赖什么**说清楚，再逐层对照 **xterm.js / `@webcontainer/api` / 本仓库 `web-os`**，标出 **缺口与可落地 API**；实施以 **「尺寸与伪终端语义对齐」**（阶段 A）、**「日志截断不破坏前台 TUI」**（阶段 B）、**「能力边界仅落 Spec」**（阶段 C）为序。

---

## 1. 「真正的终端」里重绘在做什么（概念模型）

终端 UI（含「只重画列表区域」）**不是**浏览器式 DOM 局部 diff，而是：

1. **字符矩阵**：逻辑上是一个 `cols × rows` 的格子；显示内容由 **顺序写入的字节/UTF-8** 与 **转义序列** 共同决定。
2. **控制序列（ANSI / VT / xterm 扩展）**：移动光标（CUP、CHA、VPA…）、擦除（ED、EL）、插入/删除行（IL/DL）、**滚屏区域**（DECSTBM）、**备用屏幕**（alternate screen）等。
3. **进程对「终端尺寸」的认知**：类 Unix 上 **`ioctl(TIOCGWINSZ)`**、**`SIGWINCH`**；浏览器栈由 **xterm `cols`/`rows` + WebContainer `resize`** 近似。
4. **真 PTY**：内核 master/slave、完整信号与 ioctl 面；**WebContainer 不能等价于 Linux 真 PTY**（见阶段 C）。

**因此**：工程上 = **（A）序列送达 xterm** + **（B）子进程认为的 `cols`/`rows` 与 xterm 一致** + **（C）前台输出期间避免无谓 `term.clear()`**。

---

## 2. 能力对照表（Capability → 本机 PTY → xterm.js → WebContainer → web-os **现状**）

| 能力 | 本机 PTY / Linux | xterm.js | WebContainer（`@webcontainer/api`） | web-os（已实施） |
|------|------------------|----------|----------------------------------------|---------------------|
| 初始终端尺寸 | `TIOCSWINSZ` 等 | `fit()` 后 `cols`/`rows` | `spawn(..., { terminal: { cols, rows } })` | `termDims(term)` 在 spawn 时传入 ✅ |
| **运行中改尺寸** | `TIOCSWINSZ` + `SIGWINCH` | `onResize` | **`WebContainerProcess.resize({ cols, rows })`** | 构造时订阅 **`term.onResize`**，`requestAnimationFrame` 合并后对 **`_processRef.current`** 调用 **`resize`** ✅；spawn 后 **`proc.resize(termDims(term))`** 再对齐一次 ✅ |
| 控制序列解析 | 内核 tty + 终端 | xterm 内置 | 字符串流至浏览器 | `term.write` 原样 ✅ |
| stdin | pty slave | `onData` → `input` | `WritableStream` | 已有 ✅ |
| 整屏清缓冲 | 应用/驱动 | `Terminal.clear()` | — | 前台流式输出：`writeCapped(..., { streamingForeground: true })` **推迟** `clear`+全量重同步；超 **硬上限**（`logMaxBytes * logForegroundHardMaxFactor`）仍可能强制同步；进程结束后 **`compactToCap`** 按正常上限压回 ✅ |

---

## 3. 分阶段实施与代码锚点

### 阶段 A — 尺寸同步（已实施）

- **`packages/web-os/src/terminal/terminalSession.ts`**：`WebContainerTerminalSession` 构造函数中 **`this._term.onResize`** → 下一帧 **`this._processRef.current?.resize({ cols, rows })`**（与 `termDims` 一致的下限）；**`runSpawnCore`** 在 **`spawn` 成功后** 立即 **`proc.resize(termDims(term))`**。
- **释放**：**`dispose()`** 取消订阅与 rAF；**`demos/.../TerminalPane.svelte`** 在 `t.dispose()` 前调用 **`shellSession.dispose()`**。

### 阶段 B — 不破坏 TUI 的日志策略（已实施）

- **`packages/web-os/src/terminal/logBuffer.ts`**：`writeCapped(..., { streamingForeground: true })` 在硬上限内**不因**行/字节软上限执行 `clear`+全量重写，仅 **`term.write(chunk)`**；超过硬上限仍 **`clear`+`write`**（极端超长单命令输出，TUI 仍可能被破坏，属有文档的兜底）。
- **`runSpawnCore`**：`drainProcessOutput` 的回调使用 **`streamingForeground: true`**；泵结束后 **`ring.compactToCap(term, cfg)`** 再写 **`[exit …]`**。
- **配置**：**`TerminalConfig.logForegroundHardMaxFactor`**（默认 `4`），见 **`config.contracts.ts`**、**`config.ts`**、可选 **`terminal.config.json`** 覆盖。

### 阶段 C — 承诺与边界（仅本文档 + 库技术 README）

- **不承诺**：与 **Linux 真 PTY** 逐信号、逐 ioctl 等价；部分全屏 TUI 仍可能失败。
- **已承诺（实现层）**：**`onResize` → `process.resize`**；**spawn 后补一次 `resize`**；**前台流式输出推迟破坏性截断** + **退出后 `compactToCap`**。
- **刻意不写入「产品」**：**`demos/webcontainer-openclaw/README.md`** 等面向使用者的说明**不**加入上述承诺长文；**`packages/web-os/README.md`** 仅保留 API 级短句（`dispose`、`onResize`/`resize`、log buffer 行为），便于库消费方对接。

---

## 4. 与「先前 RO 方案」的关系

| 手段 | 作用 |
|------|------|
| **`onResize` → `WebContainerProcess.resize`** | 对齐子进程与 xterm 的 **行列**，服务局部重绘与换行 |
| **ResizeObserver 仅去重** | **未**作为本需求的主方案；若日后为减少重复 `resize` 调用可再议 |

---

## 5. Done Contract（已满足）

- **必须**：前台进程存在时，xterm **`cols`/`rows` 变化** 经 **`WebContainerProcess.resize`** 同步（含 rAF 合并）；spawn 后与当前 `termDims` 对齐。
- **应当**：前台 stdout 泵送期间**默认不**因软日志上限 `clear` 全屏；进程结束后 **`compactToCap`**。
- **文档**：能力边界与「非真 PTY」声明在 **本文档 §3C**；**不**强改 demo 产品 README。

---

## 6. 风险与依赖

- **`resize` 频率**：已用 **rAF** 合并；同一帧多次 `onResize` 只调一次底层 `resize`。
- **硬上限强制 `clear`**：单进程输出超过 `logMaxBytes * logForegroundHardMaxFactor` 时仍会整屏同步，TUI 可能断裂——可调大因子或 `logMaxBytes`（内存权衡）。
- **版本**：以 **`@webcontainer/api@^1.6.1`** 类型中的 **`WebContainerProcess.resize`** 为准。

---

## 7. 决策记录

- **已采纳**：三阶段（A/B/C）一并实现；**阶段 C** 的「承诺与边界」**仅落在 Spec（及库 README 技术条）**，**不**落入 demo 产品说明。

---

## 8. 参考（类型级）

- `spawn(..., { terminal?: { cols; rows } })`
- `WebContainerProcess.resize(dimensions: { cols: number; rows: number }): void`

---

## Change Log

- 2026-05-04：初稿，待人工审核；确立 **resize** 为主方案。
- 2026-05-04：三阶段实现落地；更新对照表、Done Contract、决策记录；明确 **产品 README 不写长承诺**。
