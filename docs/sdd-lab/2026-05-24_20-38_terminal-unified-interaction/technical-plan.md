# Technical Plan / 技术方案: Terminal Unified Interaction

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/requirements.md`
- 需求确认状态：`Approved for technical planning`
- 本方案覆盖范围：
  - 统一终端对外契约。
  - BrowserPod adapter 的本期职责边界。
  - WebContainer 作为参考基线，不纳入本期 adapter 实现。
  - 终端交互状态机、运行中输入策略、能力提示和多终端行为。
  - 终端区域页面结构与交互状态。
  - 后续实现步骤与验证计划。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `docs/specs/2026-05-24_18-00_web-claw-core-contract.md`
  - `docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md`
  - `packages/web-os/src/shell/shellSession.interfaces.ts`
  - `packages/web-os/src/shell/shellSession.impl.ts`
  - `packages/web-os/src/webcontainer/runtime/runtime.interfaces.ts`
  - `packages/web-os/src/webcontainer/runtime/webOsRuntime.impl.ts`
  - `demos/browserpod-demo/src/cases/interactiveTerminal.case.js`
- 当前实现事实：
  - 现有源码里有 `packages/web-os`，其 `ShellSession` 已基于 WebContainer `spawn` 实现长期进程输入、输出、resize、dispose。
  - `container-runtime-management` 前置迭代已完成首轮实现并进入 review：`packages/os-core` 已固化 runtime manager/session/capability/error/event 契约，`packages/browserpod` 已提供 BrowserPod runtime adapter。
  - 旧 `docs/specs/2026-05-24_18-00_web-claw-core-contract.md` 与 `docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md` 已标记 Deprecated，不再作为本迭代执行真相源。
  - BrowserPod demo 已验证默认 terminal 可承载 `pod.run` 输出，并支持同 Pod 多默认终端。
  - BrowserPod `interactive-terminal` case 初测显示：默认 terminal 可在运行中向 `read` 提供 stdin；`sh -i` 有部分交互证据；`bash -i` 未形成稳定长驻；custom terminal 只能确认输出接管，不能确认 stdin 接管。
- 相关接口/数据结构：
  - 旧 `TerminalSession.write(input)` 同时可能表示“提交命令”和“写入运行中 stdin”，语义过载。
  - 旧 `TerminalStatus` 使用 `busy`，与需求中的 `running` 语义接近，但缺少 `blocked` / `unsupported` 的交互结果表达。
  - 旧 `RuntimeCapabilities.interactiveTerminal` 粒度过粗，容易让 app 误以为需要关心底层是长期 shell 还是命令运行器。
- 约束与风险：
  - app 不应直接依赖 BrowserPod SDK 类型或 `pod.run` 调用形态。
  - UI 不应把 `interactive-shell` / `command-runner` 作为主要用户可见模式。
  - BrowserPod 未验证能力不得通过 capability 声明为稳定支持。
  - 终端依赖已启动且可用的容器/runtime；容器启动、认证、隔离环境检查、恢复和全局 runtime 生命周期不在本终端方案内完整展开。

## Proposed Solution / 拟定方案

- 方案摘要：
  - 在 `os-core` 中定义统一 `TerminalSession` 契约。
  - `TerminalSession` 对外暴露用户语义操作：`submitCommand`、`writeStdin`、`resize`、`interrupt`、`close`、`onEvent`。
  - `interactive-shell` 与 `command-runner` 只作为 adapter 内部策略，不进入 app 侧分支判断。
  - 终端状态拆成两层：生命周期状态与交互状态。生命周期描述创建/关闭/失败，交互状态描述是否可输入、是否运行中、是否等待输入或能力受限。
  - capability 不暴露“底层模式名”，而暴露可驱动 UI 的行为能力，如运行中 stdin、前台任务中止、resize、多终端、cwd 维护。
- 为什么选择该方案：
  - 用户看到的是统一终端，调用方也应面对统一 API。
  - WebContainer 与 BrowserPod 差异由 adapter 消化，避免 app 以后同时维护两套终端调用模型。
  - `submitCommand` 与 `writeStdin` 拆分后，能明确区分“执行新命令”和“给当前运行中进程输入内容”。
- 不采用的方案：
  - 不采用按 runtime 暴露两套 API：`InteractiveShellSession` / `CommandRunnerSession`。这会把 adapter 细节泄漏给 app。
  - 不采用单一 `write(input)` 覆盖所有输入。该接口无法表达当前输入应作为新命令、运行中 stdin、排队命令还是不支持。
  - 不采用把 `ready/running/blocked/unsupported/failed` 直接作为强制 UI 文案。它们是状态机语义，UI 文案应面向用户体感。

## Contract Shape / 契约形态

- 建议状态模型：
  - `TerminalLifecycleStatus`: `creating`、`open`、`closing`、`closed`、`failed`。
  - `TerminalInteractionStatus`: `ready`、`running`、`blocked`、`unsupported`、`failed`。
  - `ready` 表示可提交新命令。
  - `running` 表示有前台任务，输入策略由 adapter 能力和当前进程需求决定。
  - `blocked` 表示当前任务等待用户输入，但 adapter 无法满足或需要用户改用别的操作。
  - `unsupported` 表示用户触发了当前 runtime 不支持的能力。
  - `failed` 表示终端或当前任务异常，需展示错误和恢复入口。
- 建议核心方法：
  - `submitCommand(command, options?)`: 提交一条新命令。adapter 决定内部是写入长期 shell，还是通过 `pod.run` / `sh -c` 启动一次运行。
  - `writeStdin(input)`: 向当前运行中前台任务写入 stdin。若不支持，返回结构化失败并触发 notice。
  - `interrupt(target?)`: 中止当前前台任务或终端会话。若底层不支持，返回 `unsupported` 结果。
  - `resize(cols, rows)`: 调整终端尺寸；不支持时可 no-op 并发 notice。
  - `close()`: 关闭终端会话，释放 adapter 内部引用。
  - `onEvent(listener)`: 输出、状态、notice、错误和进程结束统一通过事件上报。
- 建议结果类型：
  - `TerminalActionResult` 使用 `{ ok: true } | { ok: false; reason: "blocked" | "unsupported" | "failed"; message: string }`。
  - app 根据 `reason` 决定禁用输入、展示提示、恢复 prompt 或提供重试。
- 建议事件：
  - `terminal-output`: 输出追加到终端历史区域。
  - `terminal-interaction-status`: 驱动 prompt 可用态、运行中状态和能力提示。
  - `terminal-notice`: 展示“当前 runtime 不支持运行中输入”等短提示。
  - `process-started` / `process-ended`: 驱动命令历史和前台任务状态。
  - `terminal-error`: 结构化错误。

## Adapter Strategy / Adapter 策略

- WebContainer reference：
  - WebContainer 作为真交互 shell 的行为参考和后续兼容基线。
  - 本期不实现 WebContainer adapter，不把 `packages/web-os/src/shell/ShellSession` 纳入执行范围。
  - 旧 `ShellSession` 可用于校验契约是否能覆盖长期 shell 场景：`submitCommand` 可映射为写入命令加换行，`writeStdin` 可映射为原样写入进程 input。
  - 若后续进入 WebContainer adapter 迭代，再单独处理 interrupt、resize、dispose 与长期 shell 生命周期。
- BrowserPod adapter：
  - 外部仍实现同一 `TerminalSession` 契约。
  - 第一阶段内部默认按命令运行策略实现 `submitCommand`：维护 `cwd`、处理 `clear`、必要时用 `sh -c` 包装组合命令。
  - 运行中 stdin 不作为默认稳定能力声明；仅在 default terminal + 已验证场景下可选择性支持。
  - 若当前命令需要 stdin 且 adapter 无法稳定写入，`writeStdin` 返回 `blocked` 或 `unsupported`，并通过 `terminal-notice` 给出用户可理解提示。
  - `createCustomTerminal` 只可作为输出接管候选，不能在未验证前作为完整输入输出终端实现基础。
- adapter 接入要求：
  - 任一 runtime 要接入统一终端，必须实现 `TerminalSession` 要求的接口与事件。
  - app 只依赖 `os-core` 类型，不 import BrowserPod 或 WebContainer SDK 类型。
  - adapter 内部可有 `InteractiveShellAdapter`、`CommandRunnerAdapter` 等类名，但不进入公开 API。

## Container Dependency / 容器前置依赖

- 结论：
  - 需要单开一个前置需求迭代处理“容器启动与管理”。
  - 本终端方案不应把 boot、鉴权、COOP/COEP、API Key、storageKey、恢复、stop/dispose、runtime 切换等逻辑塞进终端模块。
- 原因：
  - 终端只是容器能力的一个消费者；后续文件系统、服务预览、workspace 快照也会依赖同一个容器生命周期。
  - 如果终端内部自行 boot BrowserPod，会导致多个功能重复处理认证、隔离检查、错误恢复和资源释放。
  - 容器未就绪时，终端页面需要展示依赖状态，但不应该拥有完整容器状态机。
- 本方案对容器管理的最小依赖：
  - app 或上层 runtime provider 提供 `RuntimeSession` / `ContainerSession`。
  - session 至少暴露：`status`、`capabilities`、`createTerminal()`、`run()`、`onEvent()`。
  - 终端只处理 `ready/running/blocked/unsupported/failed` 等终端交互状态；容器的 `idle/booting/running/failed/stopped` 由容器管理需求定义。
  - 容器状态为 `idle` / `booting` 时，终端区域显示启动中或等待启动，不允许提交命令。
  - 容器状态为 `failed` / `unsupported` 时，终端区域显示错误说明和重试入口；重试动作调用容器管理层，不在终端内部 boot。
- 建议新迭代：
  - 名称：`container-runtime-management`
  - 目标：定义 BrowserPod 容器启动、状态、鉴权、隔离检查、storageKey、stop/dispose、错误恢复和能力声明。
  - 与本迭代关系：终端迭代依赖该前置能力；若当前要先做终端 demo，可用临时 runtime provider 注入已启动的 BrowserPod，但需标记为过渡实现。

## Page Design / 页面设计

- 设计基准：
  - 这是 product UI，优先清晰、稳定、熟悉，不做装饰性终端拟物。
  - 参考 `docs/design/BitsUI.md` 中的 Tabs、Button、Tooltip、Dropdown、Progress、Label 等组件语义；终端输出区域可自定义，但控制区应沿用 Bits UI 的交互词汇。
  - 色彩采用 restrained 策略：中性面板 + 少量状态色。状态色只用于当前 tab、焦点、错误、警告、成功和运行中提示。
- 页面入口/路由：
  - 沿用 web-claw 工作区内的终端区域，技术方案不新增路由。
  - 终端区域依赖上层容器状态；容器未就绪时显示容器状态面板，而不是渲染可输入 prompt。
- 信息架构：
  - 顶部为终端 tab strip：终端名称、短状态标记、关闭按钮、新建按钮。
  - 中部为终端 viewport：命令历史、输出流、系统 notice、错误块都在同一滚动上下文中连续出现。
  - 底部为 prompt row：当前 cwd、输入区域、运行中/禁用说明、可选的中止按钮。
  - 右上或 tab 附近可放轻量 overflow menu，用于重命名、清空输出、关闭其他终端等低频操作。
- 状态呈现：
  - 容器 `booting`：viewport 显示 skeleton 或 progress 文案，prompt 禁用，主操作为“等待启动”。
  - 容器 `failed`：viewport 显示错误摘要、原因、重试按钮；错误详情折叠展示。
  - 终端 `ready`：prompt 聚焦，Enter 提交命令；tab 状态可不展示文字，只保留正常态。
  - 终端 `running`：tab 显示紧凑运行指示；prompt 根据 capability 切换为 stdin 输入或禁用说明；提供中止按钮但需标明可能不支持。
  - 终端 `blocked`：在输出流底部插入 notice，说明“当前程序需要交互输入，但此 runtime 暂不支持”，提供停止/返回 prompt 的操作。
  - 终端 `unsupported`：用 inline notice 展示不支持原因，不弹 modal。
  - 终端 `failed`：输出区显示错误块，prompt 恢复或禁用取决于 terminal lifecycle。
- Prompt 行为：
  - `ready` 时输入被解释为新命令，调用 `submitCommand`。
  - `running` 且支持 stdin 时，输入被解释为当前进程输入，调用 `writeStdin`。
  - `running` 且不支持 stdin 时，输入框禁用或进入只读提示态，不静默吞输入。
  - `clear` 在 UI 层清理当前终端输出；`cd` 在 adapter 内部维护 cwd 并同步到底部 prompt。
- 多终端：
  - 新建终端时继承当前容器 session，不重复 boot。
  - 每个 tab 独立维护输出、cwd、前台任务和 interaction status。
  - 关闭运行中终端时优先使用非 modal inline confirmation 或 popover 确认；不把 modal 作为第一方案。
- 空态与错误态：
  - 首次打开且容器未启动：说明“启动容器后可创建终端”，主按钮由容器管理层提供。
  - 已启动但无终端：展示“新建终端”主操作和一行能力说明。
  - 能力降级：说明具体影响，例如“当前运行时不支持稳定的运行中 stdin，交互式程序可能无法继续”。
- 响应式/可访问性：
  - tab strip 横向溢出时可滚动或折叠到 dropdown。
  - prompt、tab、新建、关闭、中止都需要键盘可达。
  - 禁用态必须有文本原因，不只依赖颜色。
  - 输出区域应保留可复制文本，不把终端输出渲染成不可选内容。

## Impacted Areas / 影响范围

- 文件/模块：
  - 新增或调整 `packages/os-core/src/terminal/*.interfaces.ts`。
  - 新增 BrowserPod adapter 包或模块时，按 `packages/browserpod/src/terminal/*.impl.ts` 组织。
  - WebContainer 侧本期只作为参考，不进入实现文件清单。
  - app 终端 UI 只消费 `os-core` 契约。
  - 容器管理相关文件不在本迭代内新增；如需实现，应先创建独立需求迭代。
- 接口/类型：
  - 拆分旧 `TerminalSession.write(input)`。
  - 调整 capability 粒度，避免只用 `interactiveTerminal: boolean` 表达复杂能力。
  - 增加 notice / action result / interaction status 事件。
- 数据/状态：
  - 命令运行策略下需要维护每个终端的 `cwd`、历史、前台任务、运行中输入策略。
  - 多终端状态彼此隔离。
- UI/交互：
  - 终端底部 prompt 始终保留。
  - 运行中输入行为由 session 当前状态和 capability 决定。
- 测试：
  - `os-core` 状态机单测。
  - BrowserPod demo/manual case 验证。

## Execution Steps / 执行步骤

1. 以当前 SDD 文档与已落地 runtime 契约为真相源：
   - 不再维护已废弃旧 specs。
   - 终端能力接收 `RuntimeSession` 作为前置依赖，不自行 boot BrowserPod。
   - app 与 UI 仍只依赖 `os-core` 契约，不 import BrowserPod SDK。
2. 设计并实现 `os-core` 终端契约：
   - 先写 `*.interfaces.ts`，再写状态机或工具类。
   - 用类封装可复用状态管理。
3. 实现 BrowserPod terminal adapter：
   - 基于 `pod.run` 和 default terminal 实现 `submitCommand`。
   - 维护 `cwd`、`clear`、前台任务状态和 notice。
   - 未验证能力返回结构化 `unsupported` / `blocked`。
4. 接入 app 终端 UI：
   - UI 只基于统一 session 和事件渲染。
   - prompt 根据 interaction status 和 action result 调整行为。
5. 补齐验证：
   - 单测覆盖状态机和接口语义。
   - BrowserPod demo 覆盖多终端、stdin、阻塞和不支持提示。
   - 手动验证用户体感：输入在终端底部，输出连续，降级可理解。

## Risk And Mitigation / 风险与缓解

- 风险：BrowserPod 运行中 stdin 在部分场景可用，但不足以稳定抽象为完整能力。
  - 缓解方式：capability 拆细；默认不承诺长期交互 shell；用 demo case 验证后再提升能力声明。
- 风险：`submitCommand` 在长期 shell 与命令运行策略下行为差异过大。
  - 缓解方式：由 adapter 统一处理 echo、cwd、clear、命令结束事件；app 只消费事件结果。
- 风险：运行中用户输入策略不清会造成“看起来能输入但没有效果”。
  - 缓解方式：interaction status 必须明确 prompt 行为；不支持 stdin 时禁用或提示，不静默丢弃。
- 风险：旧 specs 与新需求冲突。
  - 缓解方式：执行阶段先更新 specs，再写代码；以本迭代 `requirements.md` 和 `technical-plan.md` 为真相源。
- 风险：UI 过早暴露底层模式名。
  - 缓解方式：UI 只展示用户行为状态和 notice，不展示 adapter 策略名。
- 风险：终端实现绕过容器管理，直接负责 BrowserPod boot。
  - 缓解方式：单开容器管理需求；本迭代只依赖已启动 runtime/session，不内聚 boot、认证和 stop/dispose。

## Validation Plan / 验证计划

- 静态检查：
  - TypeScript 类型检查。
  - package lint 或 repo 现有 lint 命令。
- 单元/集成测试：
  - `TerminalSession` 状态机：ready、running、blocked、unsupported、failed。
  - `submitCommand` 与 `writeStdin` 语义拆分。
  - BrowserPod adapter 的 `cwd`、`clear`、组合命令包装和不支持结果。
- 手动验证：
  - BrowserPod：底部 prompt 提交命令、输出连续展示、`cd` 持久、`clear` 清屏、多终端、运行中 stdin 降级提示。
  - 容器未就绪/启动失败：终端区域能正确展示依赖状态，且不会允许提交命令。
  - BrowserPod demo：继续维护 `interactive-terminal` case，所有能力提升都先在 case 中有证据。
- 验收证据：
  - 需求验收项逐项勾选。
  - 运行截图或手动验证记录。
  - 测试命令输出。

## Execute Checkpoint / 执行检查点

- 当前理解：
  - 终端对用户是一套统一体验；`interactive-shell` / `command-runner` 是 adapter 内部实现策略。
- 核心目标：
  - 先修订旧 specs 和契约，再实现统一 `TerminalSession` 与 BrowserPod adapter。
- 下一步动作：
  - 已收到用户“开始执行”批准；先落地 `os-core` 终端契约，再实现 BrowserPod terminal adapter。
- 风险：
  - BrowserPod stdin 和进程控制能力仍需保守处理，不能过度承诺；容器管理若未先定义，终端实现容易越界。
- 验证方式：
  - 文档对齐、类型检查、单元测试、BrowserPod demo/manual 验证。
- Execution Approval: `Approved`
