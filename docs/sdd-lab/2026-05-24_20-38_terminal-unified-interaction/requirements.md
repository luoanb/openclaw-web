# Requirements / 需求文档: Terminal Unified Interaction

## Restated Understanding / 需求复述

- 我理解当前需求是：为 OpenClaw Web 重新梳理一份终端能力与交互需求文档，使终端组件在不同 runtime 下对用户呈现一致、可解释、可降级的交互行为。
- 当前核心目标是：统一终端组件的产品体验，不强行要求所有 runtime 都具备 WebContainer 级别的真交互 shell；BrowserPod 能力不足时，应以命令运行终端方式降级，但外层 UI 仍保持“在终端底部输入命令”的一致体验。
- 当前边界是：只定义需求和验收标准；不进入具体接口、组件、adapter、样式或代码实现。
- 暂不处理：完整技术方案、代码实现、BrowserPod 新 case 编写、WebContainer adapter 实现、最终 UI 视觉稿。

## Context / 背景与事实

- WebContainer 已知支持真交互终端：可通过 process `input` / `output` stream 将 xterm 输入输出与 `jsh` 或其他进程连接。
- BrowserPod 已验证支持同一 Pod 下多个 `createDefaultTerminal`，并可将不同 `pod.run` 输出绑定到不同 terminal。
- BrowserPod 当前公开类型中 `Terminal` 与 `Process` 基本是不透明对象；未公开类似 WebContainer 的 `process.input.getWriter()`、`process.output.pipeTo()`、`exit`、`kill` 等稳定接口。
- BrowserPod 文档说明 `pod.run` 更接近 `execve` / `spawn`，不是 shell；`&&`、管道、内建命令等 shell 行为需通过 `sh -c` 包装。
- BrowserPod demo 已新增 `interactive-terminal` case 并完成一轮 Chromium 实测：默认 terminal 可把运行中键盘输入送入 `read`；`sh -i` 在 `timeout` 包裹下可接收命令并用 `exit` 结束；`bash -i` 启动后未保持长驻等待输入；`createCustomTerminal` 的 `onOutput` 可接管输出，但其 `write` 未能在 guarded write 测试中喂给运行中 `read`，因此不能声明完整输入输出接管。
- 现有 `docs/specs/2026-05-24_18-00_web-claw-core-contract.md` 中的 `TerminalSession.write(input)` 表述可能过于偏向真交互 shell，需要在后续方案阶段重新审视。

## Scope / 范围

- In:
  - 定义终端组件对用户的一致交互行为。
  - 定义终端对用户呈现的输入、输出、运行、等待输入和异常反馈行为。
  - 要求外层终端 API 保持一致，不把具体 runtime 的运行策略暴露给调用方。
  - 定义 BrowserPod 能力不足时的降级体验。
  - 定义终端底部输入区、历史命令、输出区、运行状态、能力提示的产品要求。
  - 定义多终端 tab 的一致行为。
  - 定义运行中需要用户输入时的能力判定和降级口径。
  - 定义后续必须验证的 BrowserPod 能力问题。
- Out:
  - 不设计 TypeScript 接口细节。
  - 不选择具体终端渲染库或自研程度。
  - 不定义完整视觉规范。
  - 不实现代码。
  - 不承诺 BrowserPod 支持完整交互 shell。
  - 不定义完整容器启动、认证、隔离环境、storageKey、stop/dispose 与恢复流程；该部分建议单独作为前置需求处理。

## User Interaction / 用户交互

- 触发入口：
  - 用户打开 web-claw 工作区后，可进入终端区域。
  - 用户可创建、切换、关闭多个终端 tab。
  - 用户可在终端底部输入命令并按 Enter 执行。
- 用户操作路径：
  - 用户在底部 prompt 输入命令。
  - 系统将命令追加到终端历史区域。
  - 系统通过统一终端 API 提交命令，由 adapter 根据当前 runtime 能力选择内部执行策略。
  - 命令输出持续显示在同一终端区域中。
  - 命令结束后，底部 prompt 恢复可输入状态。
- 系统反馈：
  - 终端需要维护可驱动交互行为的内部状态，如 `ready`、`running`、`blocked`、`unsupported`、`failed`。
  - 用户体感上的主要状态应是：是否可输入新命令、是否有前台任务运行、运行中输入会被送入当前进程还是被禁用/提示。
  - 终端不应把 `interactive-shell` / `command-runner` 作为主要用户可见标签；这些更适合作为 adapter 内部运行策略。
  - 当能力降级时，系统应在终端内或终端附近给出短提示。
  - 对 BrowserPod adapter 内部命令运行策略，应让用户感知为“在终端底部输入命令”，而不是终端外的独立表单。
- 状态变化：
  - 创建终端后进入 `ready`。
  - 执行命令时进入 `running`。
  - 命令完成后回到 `ready`。
  - 运行中需要用户输入但 runtime 不支持 stdin 时，进入 `blocked` 或给出明确错误提示。
  - runtime 明确不支持某能力时，进入 `unsupported` 或展示能力提示。
- 异常/边界交互：
  - 用户输入 `cd <path>` 时，若 adapter 内部采用命令运行策略，系统需要维护当前工作目录语义，而不是让一次性 `sh -c cd` 执行后丢失状态。
  - 用户输入 `clear` 时，应清理当前终端 UI 输出，而不是依赖底层 shell。
  - 用户在命令运行中继续输入时，系统应根据能力决定：写入运行中进程、排队下一条命令、禁用输入或提示不支持。
  - 用户运行交互式程序时，如果 BrowserPod 不支持 stdin，系统必须提示该 runtime 不支持当前交互方式。
- 不应发生的交互：
  - 不应让 BrowserPod 模式看起来像完整 VS Code shell，却无法响应用户输入。
  - 不应将命令输入框放在终端区域外，造成“终端不是终端”的割裂体验。
  - 不应在能力未验证前声明 `interactiveShell: true`。
  - 不应在命令运行中卸载 BrowserPod terminal DOM。

## Runtime Capability Model / 运行时能力模型

- 外层终端 API：
  - 调用方应只面对统一的 `TerminalSession` 语义：提交命令、写入运行中 stdin、调整尺寸、关闭终端、订阅输出和状态事件。
  - 调用方不应依赖 runtime 是 `interactive-shell` 还是 `command-runner`。
  - 具体 runtime 需要通过 adapter 实现终端契约；adapter 内部可选择长期 shell、单命令运行、shell 包装或其他策略。
- 内部运行策略：
  - `interactive-shell` 表示 adapter 内部使用长期运行 shell，用户输入可直接进入 shell。
  - `command-runner` 表示 adapter 内部每次提交命令触发一次运行，adapter 或上层终端状态机需要维护 `cwd`、`clear`、历史和运行中输入策略。
  - WebContainer 是长期交互 shell 的参考基线。
  - BrowserPod 第一阶段默认作为 adapter 内部的命令运行策略处理，除非后续验证证明可稳定实现长期交互 shell。

## Acceptance Criteria / 验收标准

- [ ] 终端需求文档明确：`interactive-shell` 与 `command-runner` 是 adapter 内部策略，不是外层 API 分裂点。
- [ ] 终端组件对用户保持一致外观：历史输出区域 + 底部 prompt 输入区域。
- [ ] BrowserPod 模式下，命令输入仍位于终端底部，而不是终端外部表单。
- [ ] BrowserPod 模式下，系统不承诺完整交互 shell；如需降级，应显示可理解提示。
- [ ] WebContainer 模式可作为真交互 shell 基线，但终端上层需求不得依赖 WebContainer 专属 API。
- [ ] 多终端行为在不同 runtime adapter 下保持一致：创建、命名、切换、关闭、状态展示。
- [ ] adapter 内部命令运行策略需覆盖 `cd`、`clear`、命令历史、当前 `cwd`、运行中输入处理策略。
- [ ] 对运行中需要用户输入的程序，需求中必须定义 `supported`、`blocked`、`unsupported` 三类结果展示。
- [ ] 外层终端 API 在 WebContainer 与 BrowserPod 下保持一致；runtime 差异由 adapter 契约和 capability/notice 事件表达。
- [x] BrowserPod 的 `interactiveShell`、`processStdin`、`createCustomTerminal` 能力必须作为后续技术验证项，而不是需求阶段直接确认。
  - 已通过 `demos/browserpod-demo` 的 `interactive-terminal` case 初测；结论为默认 terminal stdin 支持、`sh -i` 部分可交互、`bash -i` 未长驻、custom terminal 仅输出接管可确认。
- [x] 后续技术方案必须回看 `docs/specs/2026-05-24_18-00_web-claw-core-contract.md`，判断 `TerminalSession.write(input)` 是否需要拆分或改名。
  - 结论：技术方案建议拆分为 `submitCommand(command)` 与 `writeStdin(input)`，避免单一 `write(input)` 语义过载。

## Constraints / 约束

- 业务约束：
  - 用户看到的是一个统一终端组件，而不是按 runtime 分裂的两套体验。
  - 能力不足时必须可解释，不得假装支持。
  - 终端输入必须在终端底部，符合用户对 terminal 的基本认知。
- 技术约束：
  - BrowserPod 当前公开 `Terminal` / `Process` 类型能力有限，不应依赖未文档化方法。
  - BrowserPod default terminal DOM 在命令运行中不能卸载。
  - WebContainer 与 BrowserPod 的 adapter 能力差异必须通过 capability model 暴露给上层。
  - `createCustomTerminal` 只公开 `onOutput`，是否足以支撑统一 UI 需要验证。
  - 终端依赖已启动且可用的容器/runtime；终端模块不应自行承担完整容器管理职责。
- 时间/兼容性约束：
  - 第一阶段以最小可用终端体验为目标。
  - BrowserPod 第一阶段优先保证命令运行体验，不阻塞整体产品验证。
  - Chromium 系浏览器是 BrowserPod 验证基线。

## Open Questions / 开放问题

- [x] BrowserPod `pod.run("sh", [])` 是否能保持长期 shell，并响应用户键盘输入？
  - 结论：用 `timeout 10s sh -i` 验证到可接收终端输入并可通过 `exit` 结束；未直接留下无超时保护的裸 `pod.run("sh", [])`。
- [x] BrowserPod `pod.run("bash", [])` 是否可用？如果可用，是否稳定？
  - 结论：`bash` 可启动，但 `timeout 10s bash -i` 在本次 demo 中很快退出，没有形成可用长驻交互 shell。
- [x] BrowserPod 运行中进程是否能接收 default terminal 的用户 stdin？
  - 结论：支持。`sh -c read -t 8` 运行期间聚焦默认 terminal 输入文本，输出 `stdin-exit:0` 与对应 `stdin-value`。
- [x] BrowserPod `createCustomTerminal({ onOutput })` 是否有隐藏或可组合的输入通道？
  - 结论：`onOutput` 可接收输出；custom terminal 对象暴露 `write`，但 guarded write 未让运行中 `read` 收到输入，不能作为完整 stdin 接管能力使用。
- [x] BrowserPod `Process` 运行时对象是否存在未声明的 `kill`、`exit`、`input`、`output` 等属性？
  - 结论：本次探测中 `pod.run` 返回值表现为 `Promise`，未发现可用 `input` writer 或进程控制句柄。
- [ ] adapter 内部命令运行策略中，运行期间用户输入应排队、禁用，还是在支持 stdin 时写入当前进程？
- [x] `TerminalSession.write(input)` 在 `os-core` 契约中是否应拆为 `submitCommand(command)` 与 `writeStdin(input)`？
  - 结论：应拆分。`submitCommand(command)` 表示提交新命令，`writeStdin(input)` 表示写入当前运行中前台任务。
- [x] 是否需要在 UI 中显式展示当前终端运行模式？
  - 结论：不应把 `interactive-shell` / `command-runner` 作为主要用户可见标签；UI 应展示“可输入新命令”“运行中”“等待输入/不支持运行中输入”等用户能理解的交互状态。
- [x] 容器启动与管理是否应纳入本终端需求？
  - 结论：不纳入本终端需求的完整范围；建议单开 `container-runtime-management` 前置需求，定义 BrowserPod boot、鉴权、隔离检查、storageKey、stop/dispose、错误恢复和能力声明。

## Requirement Decisions / 需求决策

- 2026-05-24 20:38:
  - 决策：统一终端组件的用户体验以“终端底部 prompt”为核心，不采用终端外命令输入框。
  - 原因：用户对终端的预期是输入、历史和输出在同一终端区域内连续发生；外置输入框会割裂体验。
- 2026-05-24 20:38:
  - 决策：将 `interactive-shell` 与 `command-runner` 作为两类能力，而不是强行要求所有 runtime 提供完整 shell。
  - 原因：WebContainer 与 BrowserPod 公开 API 能力不同；BrowserPod 当前不能稳定承诺 WebContainer 式交互 shell。
  - 修订：2026-05-24 20:59 已将二者调整为 adapter 内部策略，不再作为外层 API 分裂点。
- 2026-05-24 20:38:
  - 决策：BrowserPod 第一阶段默认按 `command-runner` 设计，除非后续 case 验证证明可支持长期交互 shell 或运行中 stdin。
  - 原因：BrowserPod 已验证输出绑定和多终端，但 stdin、长期 shell、进程控制仍待验证。
  - 修订：2026-05-24 20:59 已调整为“BrowserPod adapter 内部默认采用命令运行策略”，不影响外层统一终端 API。
- 2026-05-24 20:59:
  - 决策：`ready`、`running`、`blocked`、`unsupported`、`failed` 是终端交互状态机语义，不要求按这些英文状态直接展示给用户。
  - 原因：用户主要关心终端是否可输入新命令、是否正在运行、运行中输入会如何处理，以及能力不足时如何恢复。
- 2026-05-24 20:59:
  - 决策：`interactive-shell` / `command-runner` 归入 adapter 内部策略；外层只消费统一终端 API。
  - 原因：WebContainer 与 BrowserPod 的实现方式不同，但 app 和 UI 不应按底层策略分裂调用模型。
- 2026-05-24 21:16:
  - 决策：WebContainer 本期只作为参考基线，不实现其 adapter；终端实现优先围绕 BrowserPod adapter 和统一契约推进。
  - 原因：本期目标是先验证 BrowserPod 最小终端体验，WebContainer 已有参考实现，不应扩大本轮实现范围。
- 2026-05-24 21:16:
  - 决策：容器启动与管理建议拆为独立前置需求，不并入终端统一交互迭代。
  - 原因：容器生命周期会被终端、文件、预览和 workspace 能力共同依赖，若放进终端模块会造成职责越界和重复实现。
