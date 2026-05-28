# Technical Plan / 技术方案: Container Script Injection

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-05-29_00-07_container-script-injection/requirements.md`
- 需求确认状态：`Approved`（用户指令：开始落地技术方案；后续纠偏：契约必须公用，实现才针对具体平台；2026-05-29 02:33 重新收敛为当前阶段只使用 alias 注入指令）
- 本方案覆盖范围：
  - 在 `os-core` 定义平台无关的容器脚本注入契约。
  - 在 `packages/browserpod` 实现该契约，作为首个具体平台实现。
  - 保证容器启动完成后，注入指令可运行。
  - 支持注入脚本、meta、shell alias 配置片段、幂等注入和显式 `force` 覆盖。
  - 当前阶段只通过 alias 暴露注入指令，不实现 PATH/bin wrapper、默认 env 注入或命令层兜底。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `packages/os-core/src/index.ts`
  - `packages/os-core/src/runtime/runtime.interfaces.ts`
  - `packages/os-core/src/files/file.interfaces.ts`
  - `packages/os-core/src/terminal/terminal.interfaces.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.impl.ts`
  - `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`
  - `packages/browserpod/src/runtime/browserpodBooter.impl.ts`
  - `packages/browserpod/src/files/browserpodFile.impl.ts`
  - `packages/browserpod/src/files/browserpodFileCommand.impl.ts`
  - `packages/browserpod/src/command/browserpodCommand.impl.ts`
  - `packages/browserpod/src/command/browserpodCommand.interfaces.ts`
  - `packages/browserpod/src/terminal/browserpodTerminal.impl.ts`
  - `demos/browserpod-demo/src/main.js`
- 当前实现事实：
  - `os-core` 已承载 runtime、terminal、files、preview 等公共契约，并通过 `packages/os-core/src/index.ts` 统一导出。
  - `RuntimeBootOptions` 目前只有 `reason` 和 `sessionKey`，尚无注入相关公共选项。
  - `RuntimeManager.boot()` 只返回 `RuntimeSession`，尚无“启动后能力准备”契约。
  - BrowserPod 官方 `boot` 选项只暴露 `apiKey`、`nodeVersion?`、`storageKey?`；当前 `DefaultBrowserPodBooter` 只传 `apiKey` 和 `storageKey`。
  - 当前 `BrowserPodRuntimeManager.boot()` 在 `pod` 返回后创建 `RuntimeSession`，BrowserPod 实现层最稳注入点是 `pod` 可用之后、`RuntimeSession` 返回之前。
  - `BrowserPodLike` 已建模 `createDirectory`、`createFile`、`openFile`、`run`、`createDefaultTerminal`、`createCustomTerminal`。
  - `BrowserPodRunOptions` 当前缺少官方 `env?: string[]` 字段，但官方 `pod.run` 文档支持 `env`。
  - `BrowserPodTerminalService.submitCommand()` 需要默认通过 `pod.run("sh", ["-lc", command])` 执行命令，尽量按 login shell 加载 profile；`sh -lc` 的实际加载行为依赖容器内 shell 实现。
  - `BrowserPodFileCommandRunner.listDirectory()` 当前依赖 `ls -l` 文本解析；已知 BrowserPod 内 `ls` 对中文文件名显示不可靠，后续文件能力不宜继续扩大对 `ls` 输出的依赖。
- 相关接口/数据结构：
  - 公共契约应新增在 `os-core`，例如 `packages/os-core/src/injection/`。
  - BrowserPod 实现应新增在 `packages/browserpod/src/injection/`，实现并适配公共契约。
  - BrowserPod 专属 API、路径、Node runner、profile 选择和 PATH wrapper 不进入公共契约。
- 约束与风险：
  - 公共契约只描述“注入能力是什么”，不描述 BrowserPod 怎么写文件、怎么 boot、怎么跑 Node。
  - 平台实现负责解释脚本如何落地、如何暴露命令、如何持久化、如何处理 shell 差异。
  - 当前用户约束要求只使用 alias 注入指令；BrowserPod terminal submitCommand 先默认使用 `sh -lc` 贴近终端环境，但 PATH/bin wrapper 保底不进入本轮方案。

## Proposed Solution / 拟定方案

- 方案摘要：
  - 在 `packages/os-core/src/injection/` 新增公共注入契约：
    - `InjectionService`
    - `InjectionScript`
    - `InjectionScriptAsset`
    - `InjectionManifest`
    - `InjectionOptions`
    - `InjectionResult`
    - `InjectionStatus`
  - 公共契约只表达：
    - 有哪些脚本/命令要注入。
    - 脚本资产来自哪个开发态文件。
    - 注入是否幂等。
    - 是否允许 `force` 覆盖。
    - 注入后提供哪些 alias 指令入口。
    - 注入结果是 `created`、`unchanged`、`updated`、`repaired` 还是 `failed`。
  - 在 `packages/browserpod/src/injection/` 新增 `BrowserPodInjectionService`，作为 `InjectionService` 的 BrowserPod 实现。
  - BrowserPod 实现采用启动后注入：`BrowserPodRuntimeManager.boot()` 拿到 `pod` 后调用注入服务，成功或可恢复失败后再返回 session。
  - BrowserPod 容器态建议目录为 `/home/user/.container-tools`，但这是 BrowserPod 实现细节，不写入公共契约。
  - BrowserPod 实现只写入：
    - 脚本文件。
    - meta/manifest 文件。
    - shell 受管片段，其中只包含 alias 指令。
  - BrowserPod terminal submitCommand 默认使用 `sh -lc` 执行用户 shell 命令，以便 login shell 尽量加载 profile 中的 alias source 片段；不通过默认 PATH/env 让其他 run 入口自动获得注入指令。
- 为什么选择该方案：
  - 符合“契约公用、实现平台化”的分层要求。
  - `os-core` 已是跨 runtime 契约包，新增 injection 域符合现有包职责。
  - BrowserPod 的 API 限制、shell 行为、Node 可用性都是实现事实，不应该污染公共契约。
  - 后续 WebContainer 或其他 runtime 可以复用公共契约并提供自己的实现。
- 不采用的方案：
  - 不在 `packages/browserpod` 内定义唯一注入契约：这会让公共能力被首个平台绑死。
  - 不把 BrowserPod 路径、Node、profile 文件选择写入 `os-core` 类型：这些属于实现策略。
  - 不实现 PATH/bin wrapper 或默认 env 注入：当前阶段用户明确只能使用 alias 注入指令；terminal submitCommand 先通过 `sh -lc` 尝试获得 profile 加载行为，其他 run 入口不做默认包装。
  - 不直接替换 BrowserPod 系统工具：风险高，且不符合“不修改底层运行时”的边界。

## Public Contract Draft / 公共契约草案

- `InjectionScript`
  - `id`：稳定脚本 ID。
  - `command`：注入后期望暴露的 alias 指令名。
  - `asset`：脚本资产引用，不直接内联大段脚本内容。
  - `runner`：脚本运行器标识，例如 `node`、`shell`、`runtime-default`。
  - `version`：脚本版本。
  - `description?`：说明。
- `InjectionScriptAsset`
  - `sourcePath`：开发态脚本文件路径，用于审查、测试和定位来源。
  - `filename`：注入到容器后的脚本文件名。
  - `checksum?`：脚本内容校验值，由实现或构建过程生成。
  - `load()` 或等价实现字段：由具体包负责读取/打包脚本文件内容，公共契约不要求内容以内联字符串维护。
- `InjectionOptions`
  - `force?: boolean`：是否允许覆盖既有受管内容。
  - `reason?: "boot" | "manual" | "repair"`：触发原因。
  - `scripts?: readonly InjectionScript[]`：指定本次注入脚本；缺省使用实现默认脚本集。
- `InjectionResult`
  - `ok`：是否成功。
  - `status`：`created | unchanged | updated | repaired | failed`。
  - `commands`：注入后可用 alias 指令摘要。
  - `warnings?`：可恢复风险。
  - `error?`：失败信息。
- `InjectionService`
  - `inject(runtimeSession, options?)`：对运行中容器执行注入。
  - `getSnapshot?(runtimeSession)`：可选，读取注入状态。

最终类型命名和字段可在实现前微调，但原则是：不出现 `BrowserPod`、`pod`、`/home/user/.container-tools`、`node` 这类平台绑定字段；脚本资产以文件为主，不以大段 `content` 字符串为主。

## BrowserPod Implementation Plan / BrowserPod 实现方案

- 实现位置：
  - `packages/browserpod/src/injection/browserpodInjection.impl.ts`
  - `packages/browserpod/src/injection/browserpodScriptRegistry.impl.ts`
  - `packages/browserpod/src/injection/index.ts`
- 开发态脚本目录：
  - `packages/browserpod/src/injection/scripts/`
  - 每个注入脚本以正常 `.js` 文件存在，例如 `uls.js`。
  - 注册表只保存脚本 id、命令名、runner、版本、文件路径和加载方式，不维护大段脚本文本。
- 受管目录：
  - `/home/user/.container-tools/scripts/`
  - `/home/user/.container-tools/meta/`
  - `/home/user/.container-tools/shell/container-tools.sh`
- 暴露方式：
  - 仅写入 alias 到 shell 片段。
  - 不探测默认 `PATH`，不安装 bin wrapper，不修改 `BrowserPodTerminalService` 或 `CustomTerminalCommandRunner` 的默认 PATH/env。
  - alias 可用性以目标 shell 加载对应配置后的终端行为为准；非交互式 `sh -c` 不作为本轮可用性保障范围。
- 幂等策略：
  - 使用 marker block 管理 profile/bashrc 中的 source 片段。
  - 使用 manifest 记录脚本 id、command、version、checksum、updatedAt。
  - 默认不覆盖疑似用户修改；`force` 为 true 时可重写受管内容。
- 注入时机：
  - `BrowserPodRuntimeManager.boot()` 在 `pod` 创建后调用 BrowserPod 注入服务。
  - 公共契约不要求提前注入；BrowserPod 当前实现采用启动后注入。

## Page Design / 页面设计

- 页面入口/路由：本阶段不新增页面。
- 布局结构：不涉及。
- 核心组件：不涉及。
- 交互状态：后续可在已有 runtime/terminal 调试界面或日志中展示注入结果。
- 视觉约束：不涉及。
- 响应式/可访问性：不涉及。

## Impacted Areas / 影响范围

- 公共契约：
  - 新增 `packages/os-core/src/injection/injection.interfaces.ts`
  - 新增 `packages/os-core/src/injection/index.ts`
  - 更新 `packages/os-core/src/index.ts`
- BrowserPod 实现：
  - 新增 `packages/browserpod/src/injection/browserpodInjection.impl.ts`
  - 新增 `packages/browserpod/src/injection/browserpodScriptRegistry.impl.ts`
  - 新增 `packages/browserpod/src/injection/scripts/*.js`
  - 新增 `packages/browserpod/src/injection/index.ts`
  - 更新 `packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts`
  - 更新 `packages/browserpod/src/runtime/browserpodRuntime.impl.ts`
  - 更新 `packages/browserpod/src/command/browserpodCommand.interfaces.ts`
  - 更新 `packages/browserpod/src/command/browserpodCommand.impl.ts`
  - 更新 `packages/browserpod/src/terminal/browserpodTerminal.impl.ts`
  - 更新 `packages/browserpod/src/index.ts`
- 测试：
  - `packages/os-core` 新增契约类型编译覆盖。
  - `packages/browserpod` 新增注入服务单元测试、runtime boot 接入测试、alias 片段写入与幂等测试。

## Execution Steps / 执行步骤

1. 在 `os-core` 定义公共注入契约。
   - 新增 `injection` 目录和导出。
   - 类型保持平台无关，只表达注入能力、脚本描述、选项和结果。
2. 在 BrowserPod 包实现公共契约。
   - 新增 `BrowserPodInjectionService`。
   - 实现目录创建、脚本写入、manifest 写入、profile marker block 管理。
3. 将 BrowserPod 注入接入 runtime boot。
   - `BrowserPodRuntimeConfig` 增加可选注入配置或服务注入点。
   - `BrowserPodRuntimeManager.boot()` 在 `pod` 可用后调用注入服务。
4. 保持 BrowserPod command/terminal 层不参与 alias 激活。
   - 不为注入指令默认追加 PATH/env。
   - 若保留 `env?: readonly string[]` 类型，也只作为 `pod.run` 能力建模，不作为注入方案依赖。
5. 增加脚本注册表。
   - 开发态脚本以正常 JS 文件保存，可版本化、可测试、可直接审查。
   - 注册表引用脚本文件资产，不把脚本内容写成大段字符串。
   - 首个脚本可承载 UTF-8 友好的 `ls` 替代命令，但不把具体脚本绑定为注入契约。
6. 增加测试和手动验证。
  - 覆盖公共契约导出、BrowserPod 幂等注入、force 覆盖、profile 不重复、alias 片段可识别。

## Risk And Mitigation / 风险与缓解

- 风险：公共契约仍意外泄漏 BrowserPod 细节。
  - 缓解方式：类型命名和字段审查，禁止出现平台名、具体路径、具体 shell 文件名或具体 runner 作为必填语义。
- 风险：脚本以字符串资产维护导致难以审查和测试。
  - 缓解方式：脚本必须以正常 JS 文件存在，注册表仅引用文件资产；测试直接覆盖脚本文件行为。
- 风险：BrowserPod `openFile` 对已有文件写入是否截断不明确。
  - 缓解方式：实现前用 fake pod 测试和最小 probe 确认；必要时临时文件 + rename 或受控重建。
- 风险：alias 在 BrowserPod 当前 `sh -c` 执行模型下不稳定。
  - 缓解方式：本轮明确不把非交互式 `sh -c` 作为验收入口；只验证目标 shell 加载 profile 后 alias 可用，并在结果中暴露该限制。
- 风险：写入多个 shell 配置文件可能影响用户配置。
  - 缓解方式：只写 marker block，不碰 marker 外内容；默认不覆盖疑似用户修改。
- 风险：注入失败影响容器启动体验。
  - 缓解方式：注入结果结构化；实现阶段明确 required/optional 策略，默认先按可恢复错误处理并暴露状态。
- 风险：真实容器里只写入 alias / `uls` 入口，但受管脚本与 manifest 没有成功落地，导致命令入口存在却指向缺失资源。
  - 缓解方式：将 BrowserPod 注入实现拆成可观测阶段：目录准备、资产加载、脚本写入、shell/profile alias 写入、manifest 写入；每个阶段独立收集 outcome/warning，失败时暴露明确阶段与路径。
  - 修正要求：`inject()` 不再承载全部细节；抽出阶段方法，测试必须覆盖“alias 入口写入不代表脚本和 meta 已写入”的场景。
- 风险：开发态脚本通过 `new URL(...)+fetch()` 从 Vite/开发服务器加载时被当作 JS 模块资源处理，写入容器的脚本末尾可能追加 inline sourcemap，例如 `//# sourceMappingURL=data:application/json;base64,...`，导致注入内容不等于原始脚本。
  - 缓解方式：脚本注册表必须通过 raw asset 机制获取开发态脚本原始文本，例如 `./scripts/uls.js?raw`；注入 manifest checksum 基于 raw 原始文本计算。
  - 修正要求：补充注册表测试，覆盖默认脚本加载内容与 raw asset 完全一致，避免对已加工产物做事后清洗。
- 风险：此前方案和实现引入 PATH/bin wrapper，可能偏离当前 alias-only 约束。
  - 缓解方式：回到 `planned` 状态，重新确认技术方案；进入执行时移除或停用 wrapper 相关实现与测试期望，保留脚本、manifest、profile alias 注入主线。

## Validation Plan / 验证计划

- 静态检查：
  - `pnpm --filter os-core check-types`
  - `pnpm --filter browserpod check-types`
- 单元/集成测试：
  - `pnpm --filter browserpod test`
  - 新增 `os-core` injection 类型导出检查。
  - 新增 BrowserPod injector fake pod 测试：目录创建、文件写入、manifest、profile alias marker、重复注入、force 覆盖。
  - 新增 BrowserPod injector 偏差测试：当脚本或 manifest 写入失败时，注入结果必须失败或包含明确错误，不能只因 alias 写入成功而误报完成。
  - 新增 BrowserPod script registry 测试：默认脚本加载内容必须等于 raw asset 原文，避免把开发服务器加工产物写入容器。
  - 新增脚本文件测试：直接执行开发态 JS 脚本，验证核心行为。
  - 新增 BrowserPod command/terminal 测试：若保留 `env` 类型，仅验证调用方显式传入；不验证默认 PATH 注入。
- 手动验证：
  - 启动 BrowserPod demo 或 web-claw runtime。
  - 容器启动后确认受管目录存在。
  - 重复调用注入，确认 profile 不出现重复 block。
  - 打开会加载目标 profile 的 shell，执行被注入 alias 指令。
  - 明确记录非交互式 `sh -c`、未加载 profile 的终端或文件命令层不属于本轮验收入口。
  - 手动修改受管块后，默认注入不覆盖；带 `force` 时覆盖。

## Execute Checkpoint / 执行检查点

- 当前理解：契约必须在 `os-core` 作为公共注入能力定义；BrowserPod 只实现该契约；当前阶段只能通过 alias 注入指令暴露能力。
- 核心目标：新增可扩展、可控、幂等的容器脚本注入能力，并提供 alias-only 的 BrowserPod 首个实现方案。
- 下一步动作：等待用户确认 alias-only 技术方案，并明确是否批准进入执行阶段。
- 风险：公共契约边界、脚本文件资产打包方式、BrowserPod `openFile` 写入语义、shell 配置加载行为和 alias 可用性需在实现中验证；非交互式命令入口暂不覆盖。
- 验证方式：`pnpm --filter os-core check-types`、`pnpm --filter browserpod check-types`、`pnpm --filter browserpod test`、BrowserPod 容器 alias 手动验证。
- Execution Approval: `Pending for alias-only adjusted plan`
