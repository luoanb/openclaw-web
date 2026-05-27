# Lifecycle / 生命周期: Web Claw File Management

```yaml
status: executing
result: pending
created_at: 2026-05-26 12:00
updated_at: 2026-05-27 22:20
owner: user
```

## Current Summary / 当前摘要

- 当前状态：`executing`，已完成 `pod.run` receiver 绑定偏差修复与自动验证。
- 当前核心目标：修复 Files Tab 点击文本文件时 BrowserPod custom terminal virtual quota 被耗尽的问题，将 command runner 从“一次命令一次 terminal”改为“队列调度 + 单 custom terminal 复用”。
- 当前下一步：用户在 dev 页面重测文件打开 happy path 与连续操作场景，确认不再出现 `Cannot read properties of undefined (reading 'cos')` 与 `Virtual terminals are exhausted`。
- 当前卡点：自动验证已覆盖 receiver 绑定与队列复用逻辑；仍需真实 BrowserPod 验证 SDK 行为。
- 下一步唯一动作：用户在 dev 页面重测文件打开 happy path 与连续操作场景。
- 下一轮核心目标：根据真实环境结果进入 review；若复用 terminal 在真实 SDK 下不可行，则按技术方案回退为队列并发 1 并记录 quota 回收风险。

## Approval / 批准状态

- Requirements confirmed: `Approved`
- Technical plan confirmed: `Approved`
- Execution approval: `Approved`
- Approved by: user
- Approved at: 2026-05-27 00:13
- Command queue / custom terminal reuse fix execution approval: `Approved at 2026-05-27 22:13`

## Execution Log / 执行记录

- 2026-05-26 12:00:
  - 动作：新建 web-claw 文件管理需求迭代，编写初版 `requirements.md`。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/requirements.md`
  - 状态变化：无，初始状态为 `draft`（原因：用户要求开始梳理文件管理需求；依据：本轮用户指令；下一步：等待用户确认需求边界）
  - 偏差：无。
- 2026-05-26 23:23:
  - 动作：根据用户决策更新文件管理实现路线需求：目录信息必须命令驱动读取真实结果；文件读写允许使用 SDK API。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/requirements.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `draft`（原因：只确认了实现路线开放问题，MVP 边界仍待确认；依据：用户明确说明“需要用命令驱动来读取真实的目录信息，读写文件允许使用sdk api”；下一步：继续确认默认根路径、编辑能力、二进制/大文件、刷新范围等开放问题）
  - 偏差：无。
- 2026-05-26 23:30:
  - 动作：根据用户澄清修正同步语义：不假设三方更新源或后台实时同步，但用户每次明确交互原则上应读取当前最新信息。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/requirements.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `draft`（原因：同步心智修正，不进入技术方案；依据：用户明确说明点开文件应读取文件内容；下一步：继续确认默认根路径、编辑能力、二进制/大文件、刷新范围等开放问题）
  - 偏差：原文“显式刷新才同步”容易被误读为必须手动刷新后才获取最新数据，已改为“交互触发按需读取最新信息”。
- 2026-05-26 23:47:
  - 动作：根据用户补充决策更新文件管理 MVP 形态：左侧 IDE 风格嵌套目录树、路径栏、目录树缓存与展开状态、右侧多 Tab 文本预览 / 编辑、目录树上下文菜单。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/requirements.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `draft`（原因：需求边界继续收敛但尚未由用户明确批准进入技术方案；依据：用户明确说明目录树缓存、默认用户目录、路径栏、不与 cmd 联动、多 Tab 文本预览编辑、上下文菜单和 VSCode/IDE 排版；下一步：确认剩余开放问题后请求需求批准）
  - 偏差：原文将目录树、编辑器和刷新范围列为开放问题，现已按用户决策收敛。
- 2026-05-26 23:49:
  - 动作：补充文本文件保存入口位置：保存按钮放置在右侧文件预览区 Tab 行右侧，以 icon 形式存在。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/requirements.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `draft`（原因：保存按钮位置属于交互需求补充，不进入技术方案；依据：用户明确说明“文件保存按钮可以放置在文件预览区tab的右侧，以icon形式存在”；下一步：确认剩余开放问题后请求需求批准）
  - 偏差：无。
- 2026-05-26 23:53:
  - 动作：根据用户“开始编写技术方案”的指令，读取现有 `os-core`、`browserpod`、`apps/web-claw` 结构与 Bits UI 设计约束，生成文件管理技术方案。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：`draft -> planned`（原因：用户明确要求开始编写技术方案；依据：本轮用户指令与已收敛的需求边界；下一步：等待用户 review 技术方案并明确是否批准执行）
  - 偏差：少量执行前决策仍以技术方案中的保守默认值列出，执行前需用户确认。
- 2026-05-27 00:04:
  - 动作：根据用户对 custom terminal 探测 case 的追问，修正技术方案：新增 `browserpod` 内部 programmatic command runner，基于 `createCustomTerminal({ onOutput })` 返回 combined output，供 files adapter 执行目录读取等非交互命令；不把该能力放入 interactive terminal 公共契约。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `planned`（原因：技术方案 review 修正；依据：`custom-terminal` demo 已证明输出接管可用、stdin 不可用；下一步：等待用户继续 review 或批准执行）
  - 偏差：原方案在文件命令执行处误写 `node -e`，与探测报告“避免 node -e”的结论冲突；已改为 `sh -lc` + sentinel / heredoc 或临时脚本。
- 2026-05-27 00:13:
  - 动作：按用户指令将编辑器方案从 CodeMirror 调整为第一阶段 Textarea，并进入执行阶段。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：`planned -> executing`（原因：用户明确要求“调整好方案就开始执行”；依据：本轮用户指令；下一步：实现 `os-core` 文件契约）
  - 偏差：原技术方案建议 CodeMirror 6；按用户决策改为 Textarea，语法高亮与语言提醒作为后续增强。
- 2026-05-27 00:22:
  - 动作：完成首轮代码实现：新增 `os-core` files 契约、`browserpod` command runner / file service adapter、`web-claw` Files Tab core state 与 Textarea UI。
  - 涉及文件：`packages/os-core/src/files/**`、`packages/os-core/src/index.ts`、`packages/browserpod/src/command/**`、`packages/browserpod/src/files/**`、`packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`、`packages/browserpod/src/index.ts`、`apps/web-claw/src/lib/core/files/**`、`apps/web-claw/src/lib/features/files/components/FilesPanel.svelte`、`apps/web-claw/src/App.svelte`
  - 状态变化：无，仍为 `executing`（原因：自动验证通过，但真实 BrowserPod happy path 尚未手动验证；依据：本轮执行结果；下一步：真实环境手动验证）
  - 偏差：第一阶段 UI 使用 `window.prompt` / `window.confirm` 承载新增、重命名、删除确认，后续可按 Bits UI Dialog polish；未实现本地上传与 CodeMirror。
- 2026-05-27 00:23:
  - 动作：根据真实 Files Tab 报错修正目录读取方案：`Timed out while reading directory /home/user.` 表明 Node heredoc / stdin 脚本未稳定产出 sentinel，技术方案改为 `sh -lc` + shell/stat/wc 输出 sentinel TSV。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`、`packages/browserpod/src/files/browserpodFileCommand.impl.ts`
  - 状态变化：无，仍为 `executing`（原因：真实环境发现实现偏差，先回写方案再修代码；依据：用户报告的超时错误；下一步：修复目录读取命令并复跑验证）
  - 偏差：原实现仍依赖 Node heredoc，虽然避开了 `node -e`，但真实 BrowserPod 下仍可能不完成；需要改为更保守的 shell 命令输出。
- 2026-05-27 00:37:
  - 动作：按用户 review 简化目录读取：使用 `ls -l | awk` 输出权限列与文件名，逐行解析；权限以 `d` 开头判定目录，否则判定文件。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`、`packages/browserpod/src/files/browserpodFileCommand.impl.ts`
  - 状态变化：无，仍为 `executing`（原因：技术方案 review 修正；依据：用户指出 `ls -l | awk '{print $1, $9}'` 的权限列规则足以识别目录/文件；下一步：复跑类型检查并请用户重测真实 Files Tab）
  - 偏差：上一版 shell/stat/wc 仍过度设计，且采集 size/mtime 超出当前目录树 MVP 必需信息。
- 2026-05-27 01:28:
  - 动作：根据真实 Files Tab 堆栈修正 command runner 假设：`Cannot read properties of undefined (reading 'type')` 发生在 `waitForRunResult` 内部判别对象，而非文件条目类型解析。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`、`packages/browserpod/src/command/browserpodCommand.impl.ts`、`packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`、`packages/browserpod/src/files/browserpodFileCommand.impl.ts`
  - 状态变化：无，仍为 `executing`（原因：真实 BrowserPod `pod.run` 返回值不能被假设为标准 Promise；依据：用户提供的浏览器堆栈；下一步：归一化 run 返回值并补测试）
  - 偏差：原实现把公开类型与 demo happy path 推广为稳定 Promise 契约，导致 `.then(...)` 结果进入 `Promise.race` 后可变为 `undefined`。
- 2026-05-27 01:31:
  - 动作：完成 command runner 修复：允许 `pod.run` 返回 Promise、thenable、process-like `cosProcess` 或同步值；文件命令统一经 `sh -lc` 执行。
  - 涉及文件：`packages/browserpod/src/command/browserpodCommand.impl.ts`、`packages/browserpod/src/command/browserpodCommand.impl.test.ts`、`packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`、`packages/browserpod/src/files/browserpodFileCommand.impl.ts`、`packages/browserpod/src/files/browserpodFileCommand.impl.test.ts`
  - 状态变化：无，仍为 `executing`（原因：自动验证已通过，仍需真实 Files Tab 重测确认 `/home/user` 目录加载；依据：本轮测试与类型检查结果；下一步：用户在 dev 页面重试 Files Tab）
  - 偏差：无新增偏差；修复覆盖了本轮堆栈中的 `result.type` 访问崩溃。
- 2026-05-27 01:32:
  - 动作：使用 Playwright MCP 在当前 dev 页面重载并打开 Files Tab，未再复现 `Cannot read properties of undefined (reading 'type')`；页面显示 `/home/user` 当前为空目录。
  - 涉及文件：无新增代码文件。
  - 状态变化：无，仍为 `executing`（原因：目录读取崩溃已消失，但完整文件创建/打开/保存 happy path 尚待继续验证；依据：浏览器页面与 console 观察）
  - 偏差：console 中存在旧的 `Device already opened in another tab` runtime 启动错误，属于多页面 BrowserPod 设备占用，不是本次 Files 目录读取错误。
- 2026-05-27 20:56:
  - 动作：根据用户反馈进入点击/新建文件不生效排查，在 Files UI 与 BrowserPod file adapter 关键节点补充结构化 debug 日志。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`、`apps/web-claw/src/lib/features/files/components/FilesPanel.svelte`、`packages/browserpod/src/files/browserpodFile.impl.ts`、`packages/browserpod/src/files/browserpodFileCommand.impl.ts`
  - 状态变化：无，仍为 `executing`（原因：真实环境暴露点击打开文本文件仍停留在空态，且新建文件不生效；依据：用户反馈；下一步：通过浏览器 Console 判断事件是否触发、prompt 是否返回、adapter 命令是否成功）
  - 偏差：此前自动测试覆盖 adapter mock，不足以确认真实 UI 点击与 BrowserPod SDK 文件创建链路。
- 2026-05-27 20:59:
  - 动作：根据用户提供的 debug payload 修正 BrowserPod 文件 mode：真实 SDK 对 `openFile(path, "r")` 返回 `Unsupported 'mode' argument`，文本文件读写/创建应使用 `"utf-8"` mode。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`、`packages/browserpod/src/files/browserpodFile.impl.ts`、`packages/browserpod/src/files/browserpodFile.impl.test.ts`
  - 状态变化：无，仍为 `executing`（原因：真实 BrowserPod SDK mode 与 mock 假设不一致；依据：用户提供的 `Unsupported 'mode' argument` 错误）
  - 偏差：原技术方案使用 `"r"` / `"w"` 类 POSIX mode，真实 BrowserPod 文本文件 API 使用 `"utf-8"`。
- 2026-05-27 21:52:
  - 动作：根据用户对 `Virtual terminals are exhausted` 的追问和修正要求，更新技术方案：新增可配置并发的 `AsyncTaskQueue`；`CustomTerminalCommandRunner` 改为单 runner lazy 创建并复用一个 custom terminal；文件命令通过 `concurrency: 1` 队列串行执行；UI 打开文件不得重复 `inspectTextFile`。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：本轮只落地方案文档，未获得新的代码执行批准；依据：用户明确要求“先看你的方案文档落地”；下一步：等待用户 review 方案并批准执行）
  - 偏差：原实现和方案把 custom terminal 当作每次命令可创建、可关闭的一次性资源；真实错误说明 virtual terminal quota 是稀缺资源，必须由队列与复用策略管理。
- 2026-05-27 21:58:
  - 动作：按用户补充约束细化技术方案：`createCustomTerminal` 创建出的 terminal 必须作为 `BrowserPodCommandRunner` 本地资源持有并复用；`run()` 允许用户层并发调用，但内部必须按队列顺序逐个执行并返回各自命令结果。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：仅细化方案约束，未进入代码执行；依据：用户本轮明确补充两条实现约束；下一步：等待用户 review 并批准执行）
  - 偏差：无新增偏差；本次是对 21:52 方案的精确化。
- 2026-05-27 22:17:
  - 动作：按用户“开始吧”批准执行 command queue / custom terminal reuse 修复：新增 `AsyncTaskQueue`；改造 `CustomTerminalCommandRunner` 复用本地 custom terminal 并串行处理并发 `run()`；去除 Files UI 打开文件时的重复 `inspectTextFile`；`readTextFile` 内部改为单次 open 后完成大小检查、文本检测与读取。
  - 涉及文件：`packages/browserpod/src/command/asyncTaskQueue.impl.ts`、`packages/browserpod/src/command/asyncTaskQueue.impl.test.ts`、`packages/browserpod/src/command/browserpodCommand.impl.ts`、`packages/browserpod/src/command/browserpodCommand.impl.test.ts`、`packages/browserpod/src/command/index.ts`、`packages/browserpod/src/files/browserpodFile.impl.ts`、`packages/browserpod/src/files/browserpodFile.impl.test.ts`、`apps/web-claw/src/lib/features/files/components/FilesPanel.svelte`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：自动验证通过但真实 BrowserPod happy path 尚需用户重测；依据：用户执行批准与本轮测试结果；下一步：真实环境重测连续文件打开/刷新）
  - 偏差：无新增偏差；实现按 21:52/21:58 技术方案执行。
- 2026-05-27 22:19:
  - 动作：根据用户提供的真实堆栈修正技术方案与实现约束：`pod.run` 不得解构为裸函数后调用，必须保留 `pod` receiver，否则 BrowserPod SDK 内部 `this.cos` 读取会变成 undefined。
  - 涉及文件：`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/technical-plan.md`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：真实环境暴露实现偏差，先回写方案再修代码；依据：用户提供的 `Cannot read properties of undefined (reading 'cos')` 堆栈；下一步：修复 `CustomTerminalCommandRunner` 调用方式并补测试）
  - 偏差：22:17 实现为解决 TypeScript 收窄将 `pod.run` 存入局部变量并裸调用，破坏真实 SDK receiver 绑定；mock 测试未覆盖这一点。
- 2026-05-27 22:20:
  - 动作：修复 `CustomTerminalCommandRunner` 调用方式，使用 `run.call(pod, ...)` 保留 BrowserPod SDK receiver；新增单测断言 `pod.run` 执行时 `this === pod`。
  - 涉及文件：`packages/browserpod/src/command/browserpodCommand.impl.ts`、`packages/browserpod/src/command/browserpodCommand.impl.test.ts`、`docs/sdd-lab/2026-05-26_12-00_web-claw-file-management/lifecycle.md`
  - 状态变化：无，仍为 `executing`（原因：自动验证通过但真实 BrowserPod 页面尚需用户重测；依据：本轮测试与类型检查结果；下一步：用户重测 Files Tab 打开文件）
  - 偏差：无新增偏差；修复针对 22:19 记录的问题。

## Validation / 验证

- Self-check: 已对照 `requirements.md` 与 `technical-plan.md` 完成首轮实现；未触碰用户已有 demo / reference 变更。
- Static checks:
  - `pnpm --filter os-core check-types`：通过。
  - `pnpm --filter browserpod check-types`：初次失败后修复 `BrowserPodRun` 返回类型和目录 payload type guard；复跑通过。
  - `pnpm --filter browserpod check-types`：2026-05-27 01:30 复跑通过（command runner run 返回值归一化修复后）。
  - `pnpm --filter browserpod check-types`：2026-05-27 22:17 复跑通过（command queue / custom terminal reuse 修复后）。
  - `pnpm --filter browserpod check-types`：2026-05-27 22:20 复跑通过（`pod.run` receiver 绑定修复后）。
  - `pnpm --filter web-claw check`：通过，`svelte-check found 0 errors and 0 warnings`。
  - `pnpm --filter web-claw check`：2026-05-27 01:31 复跑通过，`svelte-check found 0 errors and 0 warnings`。
  - `pnpm --filter web-claw check`：2026-05-27 22:16 复跑通过，`svelte-check found 0 errors and 0 warnings`。
  - `pnpm --filter web-claw check`：2026-05-27 22:20 复跑通过，`svelte-check found 0 errors and 0 warnings`。
  - IDE lints：相关路径无 linter errors。
  - IDE lints：2026-05-27 22:17 相关路径无 linter errors。
  - IDE lints：2026-05-27 22:20 receiver 修复相关路径无 linter errors。
- Runtime / Test:
  - `pnpm --filter os-core test`：通过，2 files / 9 tests。
  - `pnpm --filter browserpod test`：通过，2 files / 13 tests。
  - `pnpm --filter browserpod test`：2026-05-27 01:30 复跑通过，5 files / 18 tests。
  - `pnpm --filter browserpod test`：2026-05-27 22:17 复跑通过，6 files / 30 tests。
  - `pnpm --filter browserpod test`：2026-05-27 22:20 复跑通过，6 files / 31 tests。
  - `pnpm --filter web-claw build`：通过。
- Browser manual check:
  - 2026-05-27 01:32：Playwright 打开 `http://localhost:5174/`，切换 Files Tab；未再出现 `result.type` 报错，Files 面板可渲染空目录态。
- Human confirmation: 用户已批准调整技术方案并开始执行。
- 结果汇总：首轮实现与自动验证已完成；Files Tab 已从占位变为左侧目录树 + 路径栏 + 刷新 + 右侧多 Tab Textarea 编辑/保存。
- 剩余风险：真实 BrowserPod happy path 尚未手动验证；SDK `openFile` / `createFile` mode 和 custom terminal command runner sentinel 完成判据仍需实证；新增/重命名/删除确认 UI 仍是浏览器原生 prompt/confirm；文件大小上限暂按 `1 MiB` 实现；本地上传未纳入第一阶段。

## Review / 复盘

- Requirements fidelity: 待 review。
- Technical-plan fidelity: 不适用。
- Quality: 待 review。
- Risk: 待 review。
- 结论：待 review。
