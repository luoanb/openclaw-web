# SDD Spec：`web-os` 终端 — 会话类（Facade）对外 API 重构

## 执行摘要

**目标**：将终端域从「无状态静态对象 + 每次调用传入大量句柄」改为 **对外暴露单一会话类实例**；使用方在页面/面板生命周期内 `new` 一次，构造阶段注入稳定上下文（`WebContainer`、`xterm.Terminal`、配置等），后续方法以**命令字符串或极简选项**驱动执行，**不在调用点重复传递** `processRef` / `stdinForwardRef` / `ring` / `cfg` / `wc` / `term` 等。

**与既有 spec 关系**：`docs/specs/2026-05-03_12-00_web-os-refactor-packages-lib.md` 已完成「契约分文件、目录域化」等 P0–P1；本 spec 专注 **Terminal 行为封装与对外人体工学**，属其后续增量，**不替代** packages-lib 规则，而是在其之上收敛调用面。

---

## 元数据

| 字段 | 值 |
|------|-----|
| **phase** | Execute（会话类已实现；demo 已迁移） |
| **spec path** | `docs/specs/2026-05-03_18-00_web-os-terminal-session-class.md` |
| **规则依据** | `.cursor/rules/packages-lib.mdc`（有状态逻辑用 **class**）；`AGENTS.md` Spec is Truth |
| **active_project** | `packages/web-os`（终端域）；消费方可含 `demos/webcontainer-openclaw`、`apps/claw-container` |
| **change_scope** | 以包内为主；应用层按需迁移 |

---

## 1. 现状事实（Research）

### 1.1 当前对外形态

- **`WebContainerTerminalSession`**（`terminalSession.ts`）：会话类封装 `TerminalLogBuffer`、`*Ref`、`cwdRel`；`bindWebContainer` 后 `runLine` / `runSpawn` / `abort`。底层 **`termDims`、输出泵、`sh -c` 与 abort** 以模块内函数 **`runSpawnCore` / `runShellLineCore` / `abortCurrentShell`** 形式与类同文件实现（原独立 `shellRunner.ts` 已删除）。
- `terminalCwdPrompt` / `TerminalCwdPrompt`：纯函数式对象，无状态。
- `TerminalConfigLoader`：已是 class；`TerminalLogBuffer`、`WebContainerProcessRef` 等由会话类在内部实例化并对外暴露只读引用。

### 1.2 消费方实际负担（以 `TerminalPane.svelte` 为例）

每次 `runSpawn` / `runShellLine` / `abortCurrentShell` 需显式串联：

- `wc`、`term`、`logBuffer`、`processRef`、`cfg`、`stdinForwardRef`、`outputReaderRef`
- 以及业务侧的 `onProcessStarted`（如同步 `hasForegroundProcess`）、`RunShellLineOptions` 等。

同一面板内这些引用**长期不变**，重复传参属于噪声，且易在复制粘贴时漏传或顺序错误。

### 1.3 与「页面进入时 new」相关的真实约束

在 demo 中，`WebContainer` 往往**晚于** xterm `Terminal` 创建（首次执行命令时才 `bootWebContainer()`）。因此「构造时必有 `wc`」在部分产品形态下**不成立**，方案必须支持下列之一（见 §3.2）：

- 延迟注入 `WebContainer`；或  
- 注入 `() => Promise<WebContainer>` / 既有 `boot` 抽象；或  
- 会话类在 `term` 就绪时创建，`bindWebContainer(wc)` 在 boot 完成后调用。

---

## 2. 需求与边界

### 2.1 Goal（目标）

1. **对外主入口**为 **一个 class**（命名待定，见 §4.1），封装：
   - 前台进程与 stdin/stdout pump 相关句柄（原 `refs` + `shellRunner` 协作）；
   - `TerminalLogBuffer` 与 `TerminalConfig`（或 `TerminalConfigLoader` 的加载结果）；
   - 与「会话 cwd / prompt」相关的可变状态（若产品需要与当前 `TerminalCwdPrompt` + `cwdRel` 行为一致，则应迁入或由该类统一编排）。
2. **调用阶段**：对外方法以 **`runLine(line: string)`**、**`runSpawn(command, args, options?)`**、**`abort()`** 等为主；**禁止**在每次调用时要求传入 `wc`、`term`、`ring`、各类 `Ref`（测试注入除外，见 §5）。
3. **实现阶段**：spawn / `sh -c` / abort 的算法在 **`terminalSession.ts`** 内以模块级函数（`runSpawnCore`、`runShellLineCore`、`abortCurrentShell` 等）与会话类方法协作实现；**不再**单独导出无状态 runner。

### 2.2 In-Scope

- `packages/web-os/src/terminal/` 内新增会话类与必要类型；契约文件可增 **`terminalSession.contracts.ts`**（或与本文件词干一致的 `*.contracts.ts`），描述 `ITerminalSession` / 构造选项 / 公开方法。
- `packages/web-os/README.md` 增补「推荐用法：会话类」；旧 API 的迁移说明（若保留别名）。
- 至少一处**仓库内消费方**迁移为推荐用法（建议 `demos/webcontainer-openclaw` 的 `TerminalPane.svelte`），以证明调用面确实简化。

### 2.3 Out-of-Scope（本轮默认不做）

- 改变 `sh -c`、Ctrl-C + kill、输出泵、`TerminalLogBuffer` 截断策略等**可观察行为**（除非为修 bug 且 spec 先改）。
- 把 xterm 的 **DOM 挂载、FitAddon、ResizeObserver** 强行迁入包内（属 UI 层；可由会话类提供可选 helper，但非 P0）。
- 修改 `@webcontainer/api` / `@xterm/xterm` 版本范围。

---

## 3. 方案设计

### 3.1 职责划分

| 层级 | 职责 |
|------|------|
| **会话类（新）** | 持有 `wc`、`term`、`cfg`、`ring`、`*Ref`；提供 `runLine` / `runSpawn` / `abort`；在 `cd`-only 成功时更新会话 `cwdRel`（若启用）；触发 `onProcessStateChange` 等窄回调。 |
| **Shell 算法** | `runSpawnCore` / `runShellLineCore` / `abortCurrentShell` 等与 `WebContainerTerminalSession` **同文件**（`terminalSession.ts`），不单独成包导出。 |
| **Cwd / Prompt（现有）** | 纯逻辑可继续用 `terminalCwdPrompt`；会话类只负责**何时调用**与**状态存哪**。 |
| **UI（Svelte 等）** | 创建 xterm、处理 `onData` 行编辑、toast、`busy` 门闩、`bootWebContainer` 与 `ensureWorkspace` 等产品流程；**可选**逐步下沉「行缓冲」到会话类（P1/P2）。 |

### 3.2 构造上下文（Constructor / Factory Options）

**必选（强建议）**

- `term: Terminal` — 输出与尺寸来源。
- `config: TerminalConfig` — 或由 `TerminalConfigLoader.load()` 在调用方传入，避免会话类隐式读 JSON 造成测试困难（若希望零配置，可提供默认合并工厂重载）。

**WebContainer 注入（三选一，评审锁定其一为默认）**

| 方案 | 描述 | 适用 |
|------|------|------|
| **A. 延迟绑定** | 构造时不传 `wc`，提供 `setWebContainer(wc: WebContainer): void` 或 `bindWebContainer(wc)`，在首次执行前必须调用。 | 与当前 demo「后 boot」一致。 |
| **B. 异步供应** | `getWebContainer: () => Promise<WebContainer>`，会话类在每次 `runLine` 前 `await`（内部可缓存实例）。 | boot 逻辑集中在会话内，但可能隐藏副作用，需文档说明。 |
| **C. 仅全就绪后构造** | 应用先 `await boot()` 再 `new Session({ wc, term, ... })`。 | 生命周期最简单，但要求应用重构 boot 顺序。 |

**推荐默认**：**A（延迟绑定）+ 构造时必填 `term` 与 `config`**，与现有 `TerminalPane` 兼容性最好；若产品统一「先 boot 再渲染终端」，可选用 C。

**可选**

- `onForegroundChange?: (running: boolean) => void` — 替代每次传入 `onProcessStarted`。
- `onError?: (err: unknown) => void` — 统一错误出口（应用决定是否 toast）。
- `initialCwdRel?: string` — 会话相对 workdir 的初始路径。

### 3.3 对外方法（草案）

以下名称可在实现前经一次命名评审微调，但**语义**应稳定：

- `runLine(line: string, options?: { noCommandEcho?: boolean })` — 封装原 `runShellLine` + 内部 `cwd`（来自会话状态）；返回 `Promise<{ code: number }>`。
- `runSpawn(command: string, args: string[], opts?: { intro?: string; cwd?: string })` — 封装原 `runSpawn`，`intro` 默认可生成类似 `\r\n$ command...\r\n`。
- `abort()` — 封装 `abortCurrentShell`。
- `get hasForegroundProcess(): boolean`（或 `isForegroundBusy`）— 便于 UI 禁用按钮。
- `get cwdRel` / `set cwdRel` 或 `getPromptLine(workdir: string)` — 若 prompt 仍由 UI 拼，可只暴露 `formatPromptLine` 委托到 `TerminalCwdPrompt`。

**刻意不收窄**：不把 `bootWebContainer`、`ensureWorkspace` 塞进会话类（属应用编排）；若未来要提供 `WebOsTerminalFacade` 高层封装，另开 spec。

### 3.4 与「摒弃调用阶段复杂参数」的对照

| 现在 | 目标 |
|------|------|
| `runShellLine(wc, line, term, ring, processRef, cfg, stdinForwardRef, onProcessStarted, options, outputReaderRef)` | `session.runLine(line, options?)` |
| `runSpawn(wc, term, ring, processRef, cmd, args, logIntro, cfg, stdinForwardRef, ...)` | `session.runSpawn(cmd, args, { intro, cwd })` |
| `abortCurrentShell(processRef, { stdinRef, outputReaderRef })` | `session.abort()` |

### 3.5 单 `WebContainer`、多终端会话（拓扑）

**初版文档未单独写清，此处显式锁定模型**（与「一个面板 `new` 一个会话对象」一致）：

| 概念 | 约定 |
|------|------|
| **容器** | 一个页面/应用通常只有 **一个** `WebContainer` 实例（`boot` 一次），负责内核侧资源与 `workdir`。 |
| **会话** | **每个 xterm 面板 / 交互终端**对应 **一个** 会话类实例：`term`、`TerminalLogBuffer`、`*Ref`（`processRef` / `stdinForwardRef` / `outputReaderRef`）、以及（若启用）**独立的** `cwdRel` 均 **per-session**，互不共享。 |
| **绑定** | 多个会话 **共享同一个** `WebContainer` 引用：方案 A 下对每个会话调用 **同一** `wc` 的 `bindWebContainer(wc)`；方案 C 下构造参数传入 **同一** `wc`。 |
| **禁止** | 多个 UI 终端 **不得** 共用 **同一组** `WebContainerProcessRef` / `StdinForwardRef` / `OutputReaderRef`（否则 stdin 转发与 `abort` 会串台）。 |

**与旧形态的对应关系**：原先无状态 runner + 调用方自管 refs 的模型，已由 **`WebContainerTerminalSession`** 内聚；**N 个面板 = N 次 `new Session` + 1 个 `wc`**。

**并发**：WebContainer 允许多个 `spawn` 并存；各会话可有各自前台进程。若产品需要「全局限流 / 单写者」等策略，由 **应用层** 协调，本会话类 **不** 默认串行化所有终端。

---

## 4. 命名与导出

### 4.1 类名候选

- `WebContainerTerminalSession` — 明示 WebContainer 与「会话」边界。
- `WebOsShellSession` — 较短，但「Shell」可能与真 PTY 混淆。

**默认推荐**：`WebContainerTerminalSession`（与包内 `WebContainer*` 前缀习惯一致）。

### 4.2 导出策略

- `packages/web-os/src/terminal/index.ts` 导出 **`WebContainerTerminalSession`**、**`IWebContainerTerminalSession`**、**`RunShellLineOptions`**、**`SpawnExtraOptions`** 等（类型定义在 **`terminalSession.contracts.ts`**）。
- **已移除**独立 `webContainerShellRunner` / `WebContainerShellRunner` 导出；历史调用方应迁移至会话类。

---

## 5. 兼容、测试与迁移

### 5.1 测试替身

- 契约接口 **`IWebContainerTerminalSession`** 便于单测 mock `runLine` / `abort`。

### 5.2 迁移顺序（建议）

1. 包内实现 `WebContainerTerminalSession` + 契约 + 单测（若有现成 harness）。
2. 迁移 `demos/webcontainer-openclaw` `TerminalPane.svelte`。
3. `apps/claw-container` 及其他引用方按排期迁移。
4. 文档与 deprecated 周期结束后，再评估是否移除旧导出（Breaking Change 需版本说明）。

---

## 6. Done Contract（完成定义）

| 维度 | 完成标准 |
|------|----------|
| **API** | 从 `"web-os"` 可导入会话类；公开方法满足 §3.3，且调用方**不再**在每次执行时传递 `wc`/`term`/`ring`/`*Ref`/`cfg`。 |
| **行为** | 与重构前相比，终端执行、中止、日志截断、`cd`-only 会话路径（若启用）行为一致；`pnpm exec tsc -p packages/web-os` 通过。 |
| **文档** | `packages/web-os/README.md` 描述推荐构造方式（含 WebContainer 延迟绑定）；本 spec 的 Open Questions 已关闭或显式延期。 |
| **证据** | 至少一处 demo/app 已迁移；如存在终端相关单测则全部绿。 |

---

## 7. Open Questions（执行前需锁定）

1. **WebContainer 注入模式**：**A** — `bindWebContainer(wc)`（已实现为 `WebContainerTerminalSession.bindWebContainer`）。
2. **会话 cwd**：由会话类持有 `cwdRel`，`runLine` 在 `cd`-only 成功时更新；可选 `onCwdRelChange` 同步到 UI 状态。
3. **stdin 转发**：**保持 UI 判断** `stdinForwardRef.current`（会话暴露只读 `stdinForwardRef`）。
4. **Breaking**：**已移除** `webContainerShellRunner` 导出；外部须使用 **`WebContainerTerminalSession`**。

---

## 8. Change Log（文档修订）

| 日期 | 修订 |
|------|------|
| 2026-05-03 | 初版：终端会话类 Facade 方案、构造上下文、方法草案、兼容与 Done Contract。 |
| 2026-05-03 | 实现：`WebContainerTerminalSession`、`bindWebContainer`；`webContainerShellRunner` 标记 deprecated；`TerminalPane` 迁移；README 更新。 |
| 2026-05-03 | 删除 `shellRunner.ts`：逻辑并入 `terminalSession.ts`；`RunShellLineOptions` / `SpawnExtraOptions` 在 `terminalSession.contracts.ts`。 |

---

## 9. Resume / Handoff

- **下一轮 Execute 入场**：读 `packages/web-os/src/terminal/terminalSession.ts` 与消费方 `TerminalPane` 调用链。
- **核心锚点**：对外只推荐 **一个会话 class**；调用点只传 **命令与少量选项**。
