# Requirements / 需求文档: Container Runtime Management

## Restated Understanding / 需求复述

- 我理解当前需求是：为 web-claw 定义统一容器/runtime 管理能力，使终端、文件、服务预览等能力都依赖同一个可解释、可恢复、可扩展的容器会话。
- 当前核心目标是：把 BrowserPod 启动、环境检查、认证、storageKey、状态、能力声明、错误恢复和停止语义从终端模块中拆出来，作为终端统一交互的前置能力。
- 当前边界是：只定义需求和验收标准；不进入具体 TypeScript 接口、adapter 实现、页面视觉稿或代码实现。
- 暂不处理：终端输入输出细节、文件管理、Portal 预览、未来容器内部工作区能力、WebContainer adapter 实现。

## Context / 背景与事实

- 终端统一交互方案已确认：终端依赖已启动且可用的容器/runtime，不应在终端模块内部自行承担完整 boot、认证和恢复逻辑。
- BrowserPod 需要满足 COOP/COEP 隔离环境，并依赖 API Key 启动。
- BrowserPod demo 已验证固定 `storageKey` 可影响本地盘持久化，多终端和运行命令依赖同一个已启动 Pod。
- 当前 specs 中已有 runtime 状态草案：`idle`、`booting`、`running`、`stopping`、`stopped`、`failed`。
- BrowserPod stop/dispose、进程中止、返回值、错误形态仍需技术方案阶段核对 SDK 能力。

## Scope / 范围

- In:
  - 定义容器/runtime 的用户可理解启动流程。
  - 定义容器状态：未启动、启动中、可用、停止中、已停止、失败、不支持。
  - 定义环境检查：COOP/COEP、浏览器能力、API Key 缺失或失效。
  - 定义 `storageKey` 与当前容器会话之间的第一阶段关系。
  - 定义容器能力声明，供终端、文件、预览等上层功能判断可用性。
  - 定义错误反馈、用户发起重试入口、恢复、停止、重新启动的产品行为。
  - 定义容器 session 与多个终端之间的关系。
- Out:
  - 不定义终端 prompt、输出、stdin、命令历史等交互细节。
  - 不设计完整文件管理、Portal 预览或未来容器内部工作区流程。
  - 不实现 BrowserPod SDK 适配。
  - 不承诺底层 runtime 一定能真正 dispose 或释放所有资源。
  - 不实现 WebContainer adapter。

## User Interaction / 用户交互

- 触发入口：
  - 用户进入 web-claw 页面时，系统需要判断容器是否可用。
  - 用户可通过页面入口或终端区域触发容器启动。
  - 终端、文件、预览等功能在容器未就绪时应显示依赖状态，而不是各自重复启动。
- 用户操作路径：
  - 用户打开 web-claw 页面。
  - 系统检查隔离环境、浏览器能力和 API Key。
  - 条件满足时启动 BrowserPod 或复用已有 runtime session。
  - 启动成功后，上层功能可通过统一 session 创建终端或运行任务。
  - 启动失败时，runtime 报错，系统展示原因和可恢复操作；是否提供重试入口由 UI 决定。
- 系统反馈：
  - 容器 `idle`：说明尚未启动，并提供启动入口。
  - 容器 `booting`：展示启动中状态，不允许上层提交命令或任务。
  - 容器 `running`：上层功能可用，显示必要的轻量状态。
  - 容器 `failed`：展示错误摘要、原因和必要的修复说明；UI 可提供用户手动重试入口。
  - 容器 `unsupported`：说明当前浏览器或隔离环境不支持，并给出下一步建议。
  - 容器 `stopping` / `stopped`：展示容器正在关机或已关机；底层资源释放细节由适配层处理，不暴露为用户概念。
- 面向用户的功能：
  - 查看当前容器状态：未启动、检查中、启动中、运行中、失败、不支持、停止中、已停止。
  - 启动容器：从页面入口或依赖容器的功能阻塞态触发。
  - 手动重试：仅在失败态由 UI 提供，不由 runtime 自动重试。
  - 停止容器：关闭当前容器会话及运行中进程；面向用户只有“容器关机”这一种语义。
  - 查看失败原因与修复建议：区分 API Key 缺失、跨源隔离缺失、认证失败、通用启动失败。
  - 查看能力摘要：以用户可理解方式说明终端、文件持久化、服务预览等能力是否可用或受限。
  - 查看当前会话摘要：runtime 类型、session 标识、storageKey 对应关系的非敏感说明；不显示 API Key。
  - 从终端、文件、预览等功能的“容器未就绪”提示跳转或聚焦到同一个容器状态面板。
- 异常/边界交互：
  - 缺 API Key 时，不应进入无限启动循环，应明确提示配置缺失。
  - 缺 COOP/COEP 时，应明确说明需要跨源隔离，而不是泛化为启动失败。
  - storageKey 变化时，系统应明确这是不同容器磁盘/容器会话，不表达为外层工作区切换。
  - 若 stop/dispose 不受底层支持，UI 文案不得承诺“已完全释放容器”。
  - 多个终端共享同一个容器 session，创建终端不应重复 boot。
- 不应发生的交互：
  - 不应让每个功能模块各自 boot BrowserPod。
  - 不应在终端模块里硬编码 API Key、storageKey 或环境检查。
  - 不应让容器启动失败时只在控制台报错。
  - 不应把 runtime 失败伪装成终端失败。

## Runtime Capability Model / 运行时能力模型

- 容器状态：
  - `idle`：尚未启动，可尝试启动。
  - `checking`：正在检查浏览器、隔离环境、认证配置等前置条件。
  - `booting`：正在启动 BrowserPod 或等价 runtime。
  - `running`：容器可用，上层终端、文件、预览等能力可把该 session 作为前置依赖使用。
  - `stopping`：容器正在关机。
  - `stopped`：容器已关机，可重新启动。
  - `failed`：启动或运行阶段失败，runtime 报错；UI 可展示错误并提供用户手动重试入口。
  - `unsupported`：当前环境不支持启动，需用户或部署侧修复。
- 能力声明：
  - 多终端能力。
  - 命令运行能力。
  - 运行中 stdin 能力。
  - 进程中止能力。
  - 服务预览/Portal 能力。
  - 文件持久化能力。
  - stop/dispose 能力。
- session 关系：
  - web-claw 第一阶段默认只有一个当前容器 session。
  - 多个终端共享该 session。
  - 文件、预览和运行任务后续也应共享该 session。
  - app 不应直接暴露 BrowserPod SDK 实例给业务组件。
  - 容器 session 不反向调用终端、文件、预览等上层能力；上层能力只能主动依赖和调用容器 session。

## Acceptance Criteria / 验收标准

- [ ] 需求文档明确容器管理是终端、文件、预览等能力的前置依赖。
- [ ] 需求文档定义容器启动前检查：浏览器能力、COOP/COEP、API Key。
- [ ] 需求文档定义容器状态及用户可理解反馈。
- [ ] 需求文档定义启动失败、环境不支持、认证缺失、认证失败的差异化提示。
- [ ] 需求文档定义 storageKey 与当前容器会话的第一阶段语义。
- [ ] 需求文档定义多个终端共享同一容器 session，不重复 boot。
- [ ] 需求文档明确终端模块不负责完整容器生命周期管理。
- [ ] 需求文档定义底层 stop/dispose 不确定时的适配层处理口径，且不拆成多个用户可见停止概念。
- [ ] 需求文档定义容器管理面向用户的功能：启动、状态查看、失败说明、手动重试、容器关机、能力摘要和会话摘要。
- [x] 后续技术方案必须核对 BrowserPod SDK 的 boot、stop/dispose、error、capability、storageKey 精确 API。
  - 已在 `technical-plan.md` 中将 boot、check、stop/dispose、storageKey、错误映射和 capability 作为 BrowserPod adapter 的实现核对项。

## Constraints / 约束

- 业务约束：
  - 用户需要知道当前容器为什么不能使用终端或预览。
  - 启动失败必须有可操作反馈，不能只记录日志。
  - 容器状态应统一驱动上层功能可用性。
- 技术约束：
  - BrowserPod 依赖跨源隔离与 API Key。
  - API Key 不应在 UI 明文暴露，也不得提交 `.env`。
  - stop/dispose 能力未确认前，文案和能力声明必须保守。
  - app 不应直接 import BrowserPod SDK 类型。
- 时间/兼容性约束：
  - 第一阶段优先支持 BrowserPod。
  - Chromium 系浏览器作为验证基线。
  - WebContainer 可作为参考，但本迭代不实现其 adapter。

## Open Questions / 开放问题

- [x] BrowserPod 是否提供明确 stop/dispose API？
  - 结论：官方 BrowserPod reference 当前列出 `boot`、`run`、`onPortal`、`createDirectory`、`createFile`、`openFile`、`createDefaultTerminal`，未列出 stop/dispose。适配层仍需对用户提供统一的“容器关机”语义，但不得承诺底层一定执行了官方 dispose。
- [x] BrowserPod 启动失败的错误类型是否可稳定区分 API Key、隔离环境、网络和未知错误？
  - 结论：启动失败直接报错即可；错误细分在适配层尽量映射，不能稳定识别时使用通用 `boot-failed`。
- [x] API Key 应由环境变量、上层配置还是用户设置注入？
  - 结论：通过环境变量注入，并由 BrowserPod 适配层使用；不进入通用 `os-core` 契约，也不要求 UI 明文输入。
- [x] `storageKey` 第一阶段是固定应用级 key、容器 key，还是用户可切换 key？
  - 结论：`storageKey` 应与启动的 BrowserPod 容器一对一绑定，作为 `boot` 的适配层参数；通用 `os-core` 只保留可选 `sessionKey`。
- [x] 容器失败后是否允许自动重试？如果允许，重试次数和退避策略是什么？
  - 结论：容器启动失败时报错即可；重试属于用户交互行为，由 UI 决定是否提供重试入口，不进入 runtime manager 的自动策略。
- [x] 容器 `stopped` 是否仅表示产品态停止，还是可承诺底层资源释放？
  - 结论：面向用户只有一个停止语义，即容器关机。`stopped` 表示容器已关机，进程/会话不可继续使用；存储应尽量持久化。底层是否有真实 dispose 由适配层处理，不拆成用户可见概念。
- [x] 上层功能读取 runtime capabilities 的时机是在 boot 前、boot 后，还是两者都需要？
  - 结论：runtime capabilities 不是运行状态，而是能力声明。它分为 adapter 静态能力和 session 实际能力：adapter 在实现时可声明静态能力，check/boot 后可根据环境和实际 session 修正；上层执行具体能力时应以 running session 上的 capabilities 为准。

## Requirement Decisions / 需求决策

- 2026-05-24 21:16:
  - 决策：容器管理作为终端统一交互的独立前置需求处理。
  - 原因：容器生命周期会被终端、文件、预览等能力共同依赖，不应内聚在终端模块里。
- 2026-05-24 21:16:
  - 决策：第一阶段以 BrowserPod 为主要 runtime，WebContainer 只作为参考基线。
  - 原因：当前终端方案的风险集中在 BrowserPod 能力边界；WebContainer 已有参考实现，不应扩大本轮范围。
- 2026-05-24 21:33:
  - 决策：容器管理先在 `os-core` 约定 API，再由 BrowserPod adapter 实现。
  - 原因：容器启动、能力、错误和 session 是跨终端、文件、预览的共享基础设施，不能由单个 feature 自行决定。
- 2026-05-24 21:51:
  - 决策：通用 `os-core` 启动契约不得包含 `apiKey`、`storageKey`、`env` 等 BrowserPod 或产品层参数。
  - 原因：并非所有 runtime adapter 都需要这些参数；它们应由具体 adapter 配置或产品装配层映射。
- 2026-05-24 21:51:
  - 决策：容器 session 不定义 `createTerminal()`、`run()` 等上层能力方法。
  - 原因：容器是上层能力的前置依赖，可以被上层能力调用，但不应反向认识或调用上层能力。
- 2026-05-24 22:07:
  - 决策：`RuntimeManager.check()` 是可选能力；未实现时默认视为无需检查且检查通过。
  - 原因：不是所有 runtime adapter 都存在显式前置检查；BrowserPod 需要检查隔离环境和认证配置，但通用契约不应强迫所有 adapter 实现空检查。
- 2026-05-24 23:25:
  - 决策：BrowserPod adapter 使用环境变量注入 API Key，`storageKey` 与 boot 出来的容器一对一绑定。
  - 原因：这些都是 BrowserPod adapter 的启动配置，不属于所有 runtime adapter 都必须支持的通用 `os-core` 参数。
- 2026-05-24 23:25:
  - 决策：容器启动失败只负责报错，不内置自动重试；重试属于用户交互行为。
  - 原因：重试按钮、重试时机和提示文案应由 UI 基于错误态决定，不应写入底层 runtime 生命周期策略。
- 2026-05-24 23:28:
  - 决策：runtime capabilities 不是运行状态，而是能力声明；能力可分为 adapter 静态能力与 session 实际能力。
  - 原因：某些能力由 adapter 类型天然决定，某些能力受浏览器环境、启动结果、SDK 实测和当前 session 影响。
- 2026-05-24 23:32:
  - 决策：容器管理页面面向用户提供基础设施状态与恢复入口，而不是暴露 SDK 控制台。
  - 原因：用户需要知道容器为什么不可用、如何启动/重试/停止，以及哪些上层能力受限，但不需要理解 BrowserPod 内部 API。
- 2026-05-24 23:39:
  - 决策：面向用户只有一个停止语义：容器关机。
  - 原因：底层是否支持官方 dispose 是适配层实现细节，不应拆成多个用户可见停止概念。
