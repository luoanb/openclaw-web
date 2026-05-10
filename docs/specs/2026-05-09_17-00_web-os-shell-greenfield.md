# Web OS — Shell 终端（绿场重构）规格

## 1. 文档定位

| 项 | 说明 |
|----|------|
| **类型** | 方案 / 行为契约（实现前对齐用）。 |
| **范围** | `packages/web-os` 内 **`shell/`** 模块；原 **`src/terminal/`** 已删除（2026-05-09）。 |
| **真相源** | 本文与 `docs/specs/2026-05-09_12-00_web-os-webcontainer-runtime.md`（`IWebOsRuntime` / 挂载语义）并列：**Shell 只要求「已获得就绪的 `WebContainer`」**，不重新定义运行时挂载策略。 |

---

## 2. 复述：利益相关方约束（Hard Constraints）

以下视为 **不可违背** 的产品/工程约束：

1. **输入语义保真**：不对用户指令做私自改写、补全路径、注入隐藏前缀/后缀或「聪明」规范化；从 Shell 模块边界向 WebContainer 进程写入的字节流 **与用户意图一致**（见 §5.1 精确定义）。
2. **与旧终端解耦**：既有 **`packages/web-os/src/terminal/`** 已 **移除**（2026-05-09）；集成仅使用 **`shell/`**。
3. **物理位置**：新增 **`packages/web-os/src/shell/`**，所有绿场实现与单测默认落在此树。
4. **兼容性**：**不**保证与当前应用侧（demo / claw-container 等）既有接线兼容；对外 API 以本文为准重新导出（集成方可后续单独迁移）。
5. **起点**：以 **`@webcontainer/api`** 提供的 **`WebContainer` 实例** 与 **`spawn`** 能力为唯一执行后端（不从零实现 OS）。

---

## 3. 目标与非目标

### 3.1 目标（What）

1. **进程级 Shell 会话**：在已挂载工作区的 `WebContainer` 内启动交互式 Shell（具体二进制见 §8 待拍板），暴露 **stdin / stdout / stderr**（及官方若支持的 **terminal 模式**），使行为尽可能接近真实终端中的同一 Shell。
2. **透传优先**：用户侧产生的输入（含控制字符、换行、粘贴块）按 §5.1 规则写入子进程；输出与退出状态忠实转发给上层（通常为 UI）。
3. **终端维度**：支持 **列数 / 行数** 变更并下发至子进程（依赖官方 `spawn`/`resize` 能力；若 API 不覆盖则文档标明降级行为）。
4. **可测试的核心**：纯逻辑（缓冲策略、会话状态机、维度计算）以 **单测** 覆盖；与 WebContainer 的集成测试可在规格第二阶段定义。

### 3.2 非目标（What Not）

- **不重写** File Manager、运行时 `mount`、换盘编排（消费 `IWebOsRuntime.start()` 等即可）。
- **不提供** UI 组件（xterm、Canvas 等）；Shell 模块止于「会话 + 流」边界。
- **不承诺** 与 Linux 真机 PTY **100%** 一致：受浏览器与 WebContainer 实现约束，仅在文档与测试中写明 **已知差异**（§7）。
- **不迁移** 旧 `terminal/` 调用方（除非另起任务）。

---

## 4. 模块边界与依赖

```text
调用方（未来 UI / Host）
        │
        ▼
  packages/web-os/src/shell/     ← 本文定义的绿色模块
        │
        │  spawn / write / resize / dispose
        ▼
  WebContainer (@webcontainer/api)
```

- **允许依赖**：`@webcontainer/api` 类型与运行时、`packages/web-os` 内 **非 terminal** 的通用工具（如既有 `staticImplements`）。
- **禁止依赖**：~~`../terminal/**`~~（目录已删除）；勿从其它路径变相拷贝已删实现。
- **建议依赖**：由调用方注入 **`Promise<WebContainer>` 或 `WebContainer`**（实例须在 **`start()` 完成且工作区已挂载** 之后获取，见运行时规格）。

---

## 5. 行为规格

### 5.1 输入完整性（「严格发送」的可执行定义）

| 场景 | 规格 |
|------|------|
| **逐键输入** | 用户产生的每个输入事件（含修饰键组合若上层解码为字节序列）应按顺序写入 **stdin**，不合并、不丢弃，除非用户明确触发「行编辑」由 Shell 自身处理（本模块不二次解释）。 |
| **一行提交** | 上层若以「一行文本 + `\n`/`\r\n`」提交，须 **原样** 写入（编码 UTF-8；若遇无法编码字符，行为见 §8）。 |
| **粘贴** | 大块文本应作为连续字节写入 stdin，**不**自动插入注释、不自动拆命令、不自动 `cd`。 |
| **禁止行为** | 模块内 **禁止**：自动 `cd` 到某路径、自动包裹 `sh -c`、trim 后重写、历史展开、别名解析（除非由子进程 Shell 自身完成）。 |

**边界说明**：若调用方在 **Shell 模块之外**（例如 UI 层）做快捷键（Ctrl+C→`\x03`），须在规格上区分「Host 快捷键」与「送入 Shell 的字节流」；**Shell 模块默认只执行调用方给予的 `write()` 参数**。

### 5.2 输出与错误流

- **stdout / stderr**：按官方 API 提供的可读流消费；模块可提供 **可选行缓冲 / 原始缓冲** 策略，但 **默认** 应偏向 **低延迟转发**（利于 PTY 类交互）。
- **编码**：与 WebContainer 默认一致（通常为 UTF-8）；乱码处理策略 §8 待拍板。

### 5.3 生命周期

1. **创建**：`spawn` Shell；记录 `pid`（若可用）、初始 `cwd`（若 API 暴露）。
2. **运行**：反复 `write` / `resize` / 读流直至 **显式 dispose** 或进程退出。
3. **退出**：向调用方通知 **exit code**（及 signal 若官方提供）；清理订阅与句柄，**不**泄漏监听器。

### 5.4 并发与多会话

- **默认**：规格 **允许** 同一 `WebContainer` 上多个 Shell 会话（多 `spawn`）；是否由调用方串行化属于集成策略。
- **文档须写明**：官方对多进程/多终端的资源限制（若有）。

### 5.5 用户调用终端时的执行流程（以 Shell 能力为边界）

以下描述 **集成方（Host / UI）** 如何组合 **`IWebOsRuntime` + `ShellSession`**，完成「用户眼中的终端」闭环。**Shell 不负责渲染与键盘映射**，只保证 **spawn / 写 stdin / 读聚合输出 / resize / 生命周期** 与 §5.1 一致。

#### A. 前置：容器与工作区就绪

1. 调用方执行 **`IWebOsRuntime.start()`**（或等价路径），得到 **`WebContainer` 实例**，且当前盘工作区已按运行时规格完成 **`mount`**（见 `2026-05-09_12-00_web-os-webcontainer-runtime.md`）。
2. 仅在 **`wc` 可用** 之后创建 Shell 会话；换盘或重新挂载由运行时编排，**不在 Shell 模块内重复实现**。

#### B. 会话建立（一次性）

| 步骤 | 调用方动作 | Shell（`ShellSession`）动作 |
|------|------------|---------------------------|
| B1 | `new ShellSession(wc, options)` | 保存 `wc` 与 `ShellSessionOptions`（默认命令 `jsh`、默认终端 80×24 等见 §11）。 |
| B2 | 注册 **`onOutput`** / **`onExit`**（须在 **`start()` 前或后立即**，以免竞态丢失首包） | 内部后续将输出泵回调到这些监听者。 |
| B3 | **`await session.start()`** | **`wc.spawn(...)`**：附加 **`terminal: { cols, rows }`**；取得 **`input`（WritableStream\<string\>）** 与 **`output`（ReadableStream\<string\>）**；启动输出泵；状态 **`running`**。 |

失败时：`start()` 抛错，状态不进入 `running`，调用方不应再 `write`。

#### C. 交互运行期（重复）

| 用户意图 | 调用方（典型 UI）责任 | Shell 责任 |
|----------|----------------------|------------|
| 按键 / 快捷键（如 Ctrl+C） | 将 DOM 事件译为 **字符串片段**（如 `"\x03"`）或 UTF-8 字节再转 **`writeBytes`** | **`write` / `writeBytes`**：按序写入官方 **`input`**，**不做**命令改写或注入。 |
| 粘贴 | 大块文本原样编码后 **`write`** 或 **`writeBytes`** | 同上，串行写入（内部写队列避免交错）。 |
| 终端尺寸变化 | 读取列/行（如 xterm `cols`/`rows`），调用 **`resize(cols, rows)`** | 委托 **`WebContainerProcess.resize`**。 |
| 屏幕刷新 | 订阅 **`onOutput`**，将片段交给终端前端（xterm 等）解析 ANSI | **低延迟转发** `output` 流上的字符串块（stdout/stderr 已由官方聚合）。 |

数据方向小结：

```text
用户 ─► Host 解码/编码 ─► ShellSession.write / writeBytes ─► WC process.input
                                                                    │
WC process.output ◄── ShellSession（输出泵）◄──┘
      │
      └──► onOutput 监听 ─► Host 渲染（ANSI、滚动条等）
```

#### D. 会话结束（两条路径）

| 路径 | 触发 | Shell 行为 | **`onExit`** |
|------|------|------------|--------------|
| **自然退出** | 子进程自行退出（`exit` / EOF 等） | `#finalizeExit`：状态 **`exited`**，关闭写端，收尾泵 | **会触发**（若注册且非 dispose 抑制）。 |
| **宿主销毁** | 用户关 Tab / 切换会话 / 应用调用 **`dispose()`** | **`kill`**，等待输出泵与 **`proc.exit`**，状态 **`disposed`** | **不触发**（有意关闭，避免与「业务意义上的退出码」混淆）。 |

之后若需新会话：**新建 `ShellSession` 实例**，重复 B–D（**不复用**已 `dispose` 或已 `exited` 的同一会话对象调用 `start()`）。

#### E. 与 §5.1 的对应关系

- **「严格发送」**：发生在 **C 行**：Host 送入什么字符串/字节，Shell 只负责写入 **`input`**；不在 Shell 内增加 `cd`、`source`、trim 或拼 `sh -c`。
- **控制字符与粘贴**：由 Host 决定如何拆包；Shell 仅保证 **顺序与原文**（`writeBytes` 仅做 UTF-8 解码，见 §11）。

---

## 6. 建议目录与契约文件（实现阶段遵循）

```text
packages/web-os/src/shell/
  shellSession.interfaces.ts   # IShellSession、选项、事件
  shellSession.impl.ts       # 基于 WebContainer.spawn 的实现类
  shellSpawnOptions.ts       # shell 路径、env、terminal 旗标等常量/工厂（可选）
  index.ts                   # 对外导出（实现后再定是否 re-export 到包根 index）
```

- **编码风格**：与 `packages` 规则一致——**契约先行**，可复用逻辑优先 **class**。
- **测试**：`*.test.ts` 与实现同目录或并列；Mock `WebContainer` 最小接口以隔离集成。

---

## 7. 「真实终端」的事实边界（诚实清单）

以下需在评审中与你对齐 **接受度**：

| 能力 | 说明 |
|------|------|
| **PTY 完整性** | 真实 Linux PTY 内核特性（某些 ioctl、job control 边角）可能不可用或行为不同；以 **官方 `terminal: true`（若存在）** 为准。 |
| **信号** | Ctrl+C 等通常对应字节或进程信号语义；若浏览器/WebContainer 链路有限制，应在实现注释与本文 **已知差异** 中列出。 |
| **性能** | 超高频输出时的背压与 UI 帧率属于调用方与缓冲策略，Shell 模块提供钩子但不保证帧率。 |

---

## 8. 待拍板（需你对齐后写入「决议」）

1. **默认 Shell 二进制**：`jsh` / `bash` / 其他；是否与最小工作区模板中的 PATH 绑定。
2. **`spawn` 选项**：是否强制 `terminal: true`；初始 `cwd` 是否固定为 `/` 或由调用方传入。
3. **环境变量**：是否透传最小集合（`TERM`、`COLORTERM` 等）或由调用方完整注入。
4. **无效 Unicode / 二进制粘贴**：拒绝写入 vs 替换 vs 原样尝试。
5. **是否 Phase 1 即导出 `packages/web-os` 根 `index.ts`**：或暂时仅 `src/shell/index.ts`，避免与旧 `terminal` 导出混淆。

---

## 9. Done Contract（文档阶段）

| 项 | 标准 |
|----|------|
| **完成** | 你与团队在 §8 决议上达成一致（可批注在本文末尾）；并确认 §5.1–§5.3 无歧义。 |
| **未完成** | §8 仍全部为「待拍板」且无决议分支。 |

**下一阶段（实现）准入**：本文 §8 已全部具备「决议」段落；并实现前按 skill 执行 checkpoint + 明确执行许可。

---

## 10. Change Log

| 日期 | 说明 |
|------|------|
| 2026-05-09 | 初稿：绿场 `shell/`、输入保真、与 `terminal/` 隔离、依赖 WebContainer。 |
| 2026-05-09 | 落地 `src/shell/`：`ShellSession`、`vitest` Mock 覆盖；§11 回填默认决议。 |
| 2026-05-09 | 补充 §5.5：用户侧调用终端的执行流程（Runtime → Shell → WC → onOutput / onExit / dispose）。 |
| 2026-05-09 | **`src/terminal/` 已删除**：对外仅保留 **`shell/`**；破坏性变更——迁移方式见 §11 与 demo。 |

---

## 11. 决议区（评审回填）

<!-- 评审后将 §8 条目迁移至此或逐条写「采用方案 X」 -->

| §8 项 | 决议（2026-05-09 实现阶段） |
|------|---------------------------|
| 默认 Shell | **`jsh`**（`packages/web-os/src/shell/shellSpawnOptions.ts` 常量）。 |
| `spawn` / 终端 | 使用官方 **`SpawnOptions.terminal: { cols, rows }`**；默认 **80×24**；不注入隐藏 `cwd`。 |
| 环境变量 | **仅**传调用方 `options.env`；无默认 `TERM` 注入。 |
| 无效 Unicode | **`writeBytes`**：`TextDecoder('utf-8', { fatal: false })`；**`write`** 直接交给官方 `WritableStream<string>`。 |
| 包导出 | **`packages/web-os/src/index.ts`** 仅 **`export * from "./shell"`**（**已移除** `./terminal`）。 |

**平台事实**：`@webcontainer/api` 的进程 **`input` 为 `WritableStream<string>`**，字节级 PTY 由宿主实现；绿场模块以 **字符串与控制字符原样写入** 达成「语义不透改」。

**破坏性迁移**：若曾从 `web-os` 导入 `WebContainerTerminalSession`、`TerminalLogBuffer`、`TerminalCwdPrompt` 等，请改为 **`ShellSession`** + 应用侧 xterm 缓冲（参考 `demos/webcontainer-openclaw/src/lib/features/terminal/xtermLogBuffer.ts`）。
