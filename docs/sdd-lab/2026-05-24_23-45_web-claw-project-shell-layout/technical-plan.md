# Technical Plan / 技术方案: Web Claw Project Shell And Layout

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`
- 需求确认状态：`Approved for technical planning`
- 本方案覆盖范围：
  - 正式 `apps/web-claw` 项目搭建方案。
  - web-claw 系统页面布局、状态入口、Tab 区域、容器抽屉和占位区。
  - 应用层如何消费 `os-core` runtime manager、runtime session 与终端能力。
  - 与 BrowserPod demo、WebContainer demo、已确认 SDD 方案和旧 specs 的关系。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `docs/sdd-lab/2026-05-24_23-45_web-claw-project-shell-layout/requirements.md`
  - `docs/sdd-lab/2026-05-24_20-38_terminal-unified-interaction/technical-plan.md`
  - `docs/sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md`
  - `docs/prd/prd-web-claw-light.md`
  - `docs/prd/prd-web-claw-feature-split-light.md`
  - `docs/specs/2026-05-24_18-00_web-claw-core-contract.md`
  - `docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md`
  - `docs/design/BitsUI.md`
  - `PRODUCT.md`、`DESIGN.md`
  - `package.json`、`pnpm-workspace.yaml`、`turbo.json`
  - `apps/web/package.json`、`apps/web/app/page.tsx`
  - `demos/webcontainer-openclaw/package.json`
  - `demos/webcontainer-openclaw/src/lib/features/shell/components/OpenClawShell.svelte`
  - `demos/webcontainer-openclaw/src/lib/features/terminal/components/TerminalPanel.svelte`
  - `demos/webcontainer-openclaw/src/app.css`
  - `demos/browserpod-demo/package.json`
  - `demos/browserpod-demo/src/main.js`
  - `demos/browserpod-demo/src/caseRegistry.js`
  - `demos/browserpod-demo/src/cases/interactiveTerminal.case.js`
  - `demos/browserpod-demo/src/cases/multipleTerminals.case.js`
  - `demos/browserpod-demo/src/cases/expressPortal.case.js`
- 当前实现事实：
  - 根 workspace 已覆盖 `apps/*`、`packages/*`、`demos/*`，可新增正式 `apps/web-claw`。
  - 当前只有 `apps/web`，它是 Next 16 + React 19 的占位应用，页面仅显示 `Web`，不承载 web-claw 产品壳层。
  - `demos/webcontainer-openclaw` 已有 Svelte 5 + Vite + Tailwind v4 + Bits/shadcn-svelte 风格组件，可作为 UI 组织参考，但其 runtime 是 WebContainer，且 `packages/web-os` 已标注为废案。
  - `demos/browserpod-demo` 是 BrowserPod 能力验证台，已验证 `BrowserPod.boot({ apiKey, storageKey })`、`onPortal`、多默认终端、`pod.run` 输出、固定 `storageKey` 和部分 stdin 能力。
  - `packages/os-core` 与 `packages/browserpod` 源码包尚未落地；已有 SDD 技术方案把它们作为后续包边界。
  - 旧 `docs/specs` 与最新 SDD 方案存在冲突：旧 specs 仍把 `storageKey` 放入通用 boot options、在 runtime session 上放上层能力方法、使用过粗 capability。它们只能作为禁用参考。
- 设计事实：
  - 产品注册为 product UI，目标是可靠、可检查、低装饰的浏览器工作台。
  - `DESIGN.md` 指向 restrained neutrals、Inter Variable、OKLCH tokens、紧凑控制、ring/tonal layering。
  - `docs/design/BitsUI.md` 中与本方案直接相关的节点包括 Button、Dropdown、Progress、Dialog/Drawer 等价结构、Popover、Tabs、Tooltip、Label。
- 约束与风险：
  - 第一阶段没有独立 workspace 产品概念；web-claw 的容器按“一台计算机”理解。
  - 进入页面即启动唯一当前容器，不做多容器和容器切换。
  - app 不直接 import BrowserPod SDK，不读取或展示 API Key 明文。
  - 终端、文件、预览只能消费同一个 runtime session，不允许各自 boot。
  - 旧 `packages/web-os` 只作为废案参考，不进入新 app 依赖。

## Proposed Solution / 拟定方案

- 方案摘要：
  - 新增正式 `apps/web-claw`，采用 Svelte 5 + Vite，与 `demos/webcontainer-openclaw` 的技术栈和 `$lib` 组织方式保持一致。
  - `apps/web-claw` 只承担产品壳层、状态展示、页面布局、组件编排和用户操作分发。
  - 运行时能力通过 `packages/os-core` 契约注入，BrowserPod 细节由 `packages/browserpod` adapter 封装。
  - 页面进入后由 app shell 自动触发唯一当前容器启动；容器准备期间主区域展示终端加载态。
  - 主视图采用 Tab 区域：`Terminal` 为默认主 Tab，`Files`、`Preview` 第一阶段可以占位。
  - Tab 右侧更多菜单承载容器关机、打开容器面板等系统操作。
  - 容器状态详情通过右侧抽屉承载，抽屉展示状态、检查结果、能力摘要、错误详情和非敏感 session 摘要。
- 为什么选择该方案：
  - Svelte/Vite 是现有 webcontainer demo 的实际工作台技术栈，能复用仓库内 Bits/shadcn-svelte 组件与 Tailwind v4 配置经验。
  - Next 占位 `apps/web` 与当前 Svelte/Bits 体系不一致，直接改造成本和设计系统迁移成本更高。
  - app shell 先行能给 runtime、终端、文件、预览提供稳定承载框架，避免继续堆 demo。
  - 单容器自动启动符合当前产品口径，避免提前引入工作区和多容器管理复杂度。
- 不采用的方案：
  - 不把 `demos/browserpod-demo` 改造成正式应用；它继续作为 SDK 能力验证台。
  - 不复用 `packages/web-os` 作为新 app runtime 依赖；它已标注为废案。
  - 不在 `apps/web-claw` 直接 import `@leaningtech/browserpod`。
  - 不把容器状态面板做成主页面常驻大面板；默认通过抽屉按需查看。
  - 不在第一阶段实现独立 workspace 列表、创建、切换或多容器。

## App Setup / 项目搭建

### 应用位置

```text
apps/web-claw/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  svelte.config.js
  components.json
  src/
    app.css
    main.ts
    App.svelte
    lib/
      components/
        ui/
      ui/
        components/
        toast/
        utils/
      core/
        app/
        runtime/
      features/
        app-frame/
        runtime/
        terminal/
        files/
        preview/
```

- `apps/web-claw/package.json`：
  - 采用 Svelte 5 + Vite。
  - 复用 `demos/webcontainer-openclaw` 中已验证的依赖族：`svelte`、`@sveltejs/vite-plugin-svelte`、`vite`、`tailwindcss`、`@tailwindcss/vite`、`bits-ui`、`shadcn-svelte`、`@fontsource-variable/inter`、`clsx`、`tailwind-merge`、`typescript`、`svelte-check`。
  - 后续执行阶段根据实际组件需要决定是否引入图标包；不要为了占位页面过早扩大依赖。
  - 只依赖 `os-core` 与后续装配层需要的 `browserpod` 包，不直接依赖 `@leaningtech/browserpod`。
- `vite.config.ts`：
  - 配置 `$lib` 指向 `src/lib`。
  - dev / preview 必须设置 COOP/COEP headers：
    - `Cross-Origin-Opener-Policy: same-origin`
    - `Cross-Origin-Embedder-Policy: require-corp`
  - 该配置服务 BrowserPod 跨源隔离要求。
- `src/app.css`：
  - 以 `demos/webcontainer-openclaw/src/app.css` 的 semantic tokens 为参考。
  - 保持 product UI restrained 风格，不引入 marketing violet 作为主 CTA。
  - 终端区域可保留深色 terminal surface token，但 app shell 默认使用 semantic token。

### 模块边界

- `src/lib/components/ui/*`：
  - Bits/shadcn-svelte 公共控件封装，如 Button、Tabs、Dropdown、Dialog/Drawer、Tooltip、Progress、Label。
  - 不引用业务 feature。
- `src/lib/ui/*`：
  - app 级纯展示组件和工具，如 `PanelFrame`、`StatusBanner`、`ToastRegion`、`cn`。
  - 可从 `demos/webcontainer-openclaw` 迁移并清理命名，不能迁移 WebContainer 专属逻辑。
- `src/lib/core/app/*`：
  - app 壳层的纯逻辑，例如 tab model、drawer state、boot intent、menu action model。
  - 可复用逻辑优先用 class 封装。
- `src/lib/core/runtime/*`：
  - 容器生命周期的纯 TS 编排层。
  - 推荐核心类：`WebClawRuntimeOrchestrator`、`RuntimeStateReducer`、`RuntimeActionDispatcher`。
  - 只依赖 `os-core` runtime 契约和纯 TS 类型，不引用 Svelte 组件、Svelte `$state` 或 BrowserPod SDK。
  - 负责 check/boot/stop/retry、runtime event wiring、snapshot 合并、action result 映射和幂等保护。
- `src/lib/core/app/appContainer.ts`：
  - app 组合根，创建并导出项目级单例。
  - 单例负责持有 `WebClawRuntimeOrchestrator`、runtime manager 注入和必要的 app 级服务。
  - 页面组件不得自行 new runtime manager 或 orchestrator。
- `src/lib/features/app-frame/*`：
  - `WebClawFrame.svelte`、`WorkbenchTabs.svelte`、`WorkbenchMoreMenu.svelte` 等应用框架组件。
  - 负责组合 runtime、terminal、files、preview 的展示组件，不直接编排容器生命周期，不直接调用 BrowserPod SDK。
- `src/lib/features/runtime/*`：
  - runtime store、view model adapter 和展示组件。
  - `runtimeStore.ts` 持有可订阅状态，并订阅纯 TS orchestrator 的状态输出。
  - `RuntimeStatusDrawer.svelte`、`RuntimeStatusBadge.svelte`、`RuntimeBlockingState.svelte`。
  - 组件只消费 store 派生状态和派发用户意图，例如 retry、open drawer、shutdown。
- `src/lib/features/terminal/*`：
  - 第一阶段默认主功能；最终接入终端统一交互方案。
  - 在 `os-core` / `browserpod` 终端契约尚未落地前，技术方案允许保留组件骨架和阻塞态，但不得临时直接 boot BrowserPod。
- `src/lib/features/files/*`：
  - 第一阶段只提供 Tab 占位态，说明文件能力后续接入。
- `src/lib/features/preview/*`：
  - 第一阶段只提供 Tab 占位态或 Portal 等待态，不实现多服务预览。

## Runtime Integration / Runtime 接入

### 启动流程

```text
App.svelte
  -> WebClawFrame.svelte
    -> 使用 appContainer 中的单例 runtimeOrchestrator
    -> runtimeStore 订阅 orchestrator 状态
    -> getSnapshot() / store 初始值渲染首帧
    -> onMount 只触发用户意图：appOpened()
    -> orchestrator 内部触发 boot({ reason: "app-open" 或等价启动意图 })
    -> store 更新 running 后允许 Terminal tab 创建/加载终端
```

- 页面进入即自动启动唯一当前容器。
- 自动启动由纯 TS `WebClawRuntimeOrchestrator` 编排，Svelte 组件只触发 `appOpened()` 意图。
- 若 manager 已处于 `running`，重复进入或组件重挂载应复用当前 session，不重复 boot。
- 若 manager 已处于 `supported`，说明前置检查已通过但尚未启动，应继续触发 boot 或展示可启动入口。
- 若处于 `checking` / `booting`，主区域展示终端加载态。
- 若处于 `failed`，主区域展示终端阻塞态，并提供“重试启动”和“打开容器面板”。
- 若处于 `unsupported`，主区域展示不可恢复说明，不展示无效重试。
- 若用户从更多菜单触发“容器关机”，调用 runtime manager `stop()`，UI 进入统一容器关机语义。
- 用户操作不直接调用 runtime manager；组件派发 action 到 orchestrator，由 orchestrator 调用 manager 并更新 store。

### 三层架构

```text
纯 TS 编排层
  WebClawRuntimeOrchestrator
  - check / boot / stop / retry / event wiring
  - 幂等保护与错误映射
  - 不引用 Svelte 组件、$state、BrowserPod SDK

store 状态层
  runtimeStore
  - 持有 RuntimeViewState
  - 订阅 orchestrator 状态输出
  - 提供组件可订阅状态与派生 view model

展示组件层
  WebClawFrame / WorkbenchTabs / RuntimeStatusDrawer / TerminalTab
  - 订阅 store
  - 展示状态
  - 把用户操作转成 action，不编排容器生命周期
```

- 编排层：
  - 使用 class 组织，作为项目级单例创建。
  - 它可以持有私有状态快照、unsubscribe 列表和 boot promise，但该私有状态不是 UI 真相源。
  - 它对外暴露 `startOnAppOpen()`、`retryBoot()`、`shutdown()`、`openRuntimePanelIntent()` 等用户语义方法，具体命名在实现阶段固化。
- store 层：
  - 使用 store 持有页面可观察状态，例如 runtime status、capabilities、drawer data、blocking state、last error。
  - store 可以是 Svelte store，但只作为状态桥接，不承载容器业务编排。
  - store 的更新来源应是 orchestrator 输出的 snapshot/event，不应由多个组件直接随意写入。
- 展示组件层：
  - 不使用 Svelte `$state` 保存 runtime 核心状态。
  - 可以使用局部 UI 状态，例如菜单开关、当前 Tab、抽屉开关；这些状态不代表容器事实。
  - 不直接订阅 runtime manager event；事件订阅集中在 orchestrator。

### 与现有 runtime 技术方案的关系

- 本方案继承 `container-runtime-management`：
  - `RuntimeStatus`: `idle`、`checking`、`supported`、`booting`、`running`、`stopping`、`stopped`、`failed`、`unsupported`。
  - `RuntimeManager`: `check?()`、`boot()`、`stop()`、`getSnapshot()`、`onEvent()`。
  - `RuntimeSession` 不暴露 `createTerminal()`、`run()`、`createPreview()` 等上层方法。
  - capabilities 是能力声明，不是运行状态。
- 本方案修正旧 PRD/旧 specs 中“用户点击启动”的口径：
  - 第一阶段 web-claw 页面进入后自动启动容器。
  - 用户仍可在失败或停止后通过 UI 重试/重新启动，但初始 happy path 不需要点击启动。
- 本方案修正旧 specs 中 `workspaceId` / `storageKey` 的口径：
  - 第一阶段没有外层 workspace 产品概念。
  - BrowserPod `storageKey` 是 adapter 启动配置，与当前容器一对一绑定。
  - app 只需要稳定注入默认容器 key 或通过 adapter 配置解析，不把它展示为 workspace。

## Page Design / 页面设计

### 设计定位

- 这是 product UI：熟悉、克制、稳定，比视觉炫技更重要。
- 物理场景：产品工程师在浏览器里长时间看终端输出、等待容器启动、切换文件和预览；界面需要降低认知噪音。
- 色彩策略：restrained neutrals + 状态色。状态色只用于运行、警告、错误、成功、焦点和当前选中。
- 禁止：营销渐变、玻璃拟态、侧边彩条、gradient text、弹窗优先、无意义动效。

### 页面结构

```text
┌──────────────────────────────────────────────────────────────┐
│ Tabs: Terminal | Files | Preview        Status      More ...  │
├──────────────────────────────────────────────────────────────┤
│ Main area                                                     │
│   Terminal loading / Terminal panel / Placeholder / Blocking  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                                  ┌─────────────────────────────┐
                                  │ Runtime drawer              │
                                  │ status / checks / caps      │
                                  │ errors / session summary    │
                                  └─────────────────────────────┘
```

- 本阶段不设置单独 Header：
  - Tabs 顶部区域就是页面首要 chrome。
  - 产品名如需出现，使用紧凑文本或图标放在 Tabs 左侧，不单独占一行。
  - 当前容器状态 badge 放在 Tabs 右侧或 More 菜单触发器附近。
  - 全局操作收敛到 More 菜单和容器抽屉。
- Tabs：
  - 默认选中 `Terminal`。
  - `Files` 和 `Preview` 第一阶段存在但可占位。
  - Tab 右侧 More 菜单放低频系统操作：`打开容器面板`、`容器关机`、后续可扩展 `复制诊断信息`。
- Main area：
  - `checking` / `booting`：显示终端加载态，文案围绕“正在准备这台浏览器内计算机”。
  - `supported`：显示可启动状态；若自动启动策略仍启用，通常只会短暂出现。
  - `running`：显示终端面板。
  - `failed`：显示错误摘要、重试入口、打开容器面板入口。
  - `unsupported`：显示环境不支持原因与修复建议。
  - `stopping` / `stopped`：显示关机中或已关机状态，禁用终端输入。
- Runtime drawer：
  - 右侧抽屉，不占主任务区域。
  - 内容区：状态摘要、依赖检查、能力摘要、错误详情、session 摘要。
  - API Key 只显示“已配置/未配置/认证失败”，不显示明文或部分明文。

### 关键组件

- `WebClawFrame.svelte`：
  - 页面骨架，组合 Tabs 顶部区域、Main、Drawer；只订阅 store 和转发用户意图。
- `WorkbenchTabs.svelte`：
  - Tab 展示和 tab actions；采用 Bits UI Tabs。
- `WorkbenchMoreMenu.svelte`：
  - Tab 右侧更多菜单；采用 Dropdown/Menu 语义；菜单项只派发 action。
- `RuntimeStatusBadge.svelte`：
  - 将 `RuntimeStatus` 映射为短状态。
- `RuntimeStatusDrawer.svelte`：
  - 右侧详情抽屉；实现上可先用 Dialog/Drawer 组件结构，后续按 Bits UI/Figma 细化。
- `TerminalTab.svelte`：
  - 容器准备期间显示 terminal loading；running 后挂载终端组件。
- `FeaturePlaceholder.svelte`：
  - Files / Preview 占位态，说明“后续接入”，不使用空白。
- `RuntimeBlockingState.svelte`：
  - failed / unsupported / stopped 等阻塞态。

### 状态映射

- `idle`：
  - 理论上首帧可能短暂出现；立即触发 boot。
  - UI 可显示“准备启动容器”。
- `checking`：
  - 主区域显示检查中 skeleton/progress。
  - 抽屉展示 COOP/COEP、API Key、storageKey resolver 等检查项。
- `supported`：
  - 主区域显示可启动状态或继续进入自动启动流程。
  - 抽屉展示最近一次检查通过。
- `booting`：
  - 主区域显示终端加载态。
  - Tabs 保持可见，Files/Preview 仍可切换到占位，但不可触发 runtime 能力。
- `running`：
  - 主区域显示终端。
  - 状态 badge 轻量化，不干扰任务。
- `failed`：
  - 主区域展示错误摘要、重试和打开容器面板。
  - 抽屉展示错误 code、建议操作、可折叠技术详情。
- `unsupported`：
  - 主区域展示不可恢复说明，例如缺跨源隔离或浏览器不支持。
  - 不展示无效重试按钮。
- `stopping`：
  - 禁用终端输入和更多菜单里的重复关机操作。
- `stopped`：
  - 主区域显示已关机，提供重新启动入口。

### 响应式与可访问性

- 第一阶段以桌面浏览器为验证基线。
- 窄屏时保留 Tabs 顶部区域和主区域，抽屉全宽覆盖。
- Tabs 可横向滚动或收敛进 More，不压缩到不可点击。
- More 菜单、抽屉、重试、关机、Tab 切换必须键盘可达。
- loading、failed、unsupported 不只依赖颜色，需要文本说明。
- motion 控制在 150-250ms，用于抽屉和菜单显隐；遵守 `prefers-reduced-motion`。

## Impacted Areas / 影响范围

- 文件/模块：
  - 新增 `apps/web-claw/**`。
  - 后续执行阶段可能复用或迁移 `demos/webcontainer-openclaw/src/lib/components/ui/**` 的公共 UI 封装。
  - 后续执行阶段依赖 `packages/os-core` 与 `packages/browserpod` 的契约和实现。
  - 不修改 `apps/web`，除非用户后续明确要求废弃或重命名它。
  - 不修改旧 `docs/specs`，除非进入反写清理任务；旧 specs 在本迭代中只作为禁用参考。
- 接口/类型：
  - 需要纯 TS `WebClawRuntimeOrchestrator` 对外 action 契约。
  - app shell 需要 runtime snapshot view model。
  - runtime store 需要 `RuntimeViewState` / `RuntimeDrawerViewModel` / `RuntimeBlockingViewModel`。
  - More menu 需要系统操作 model：打开容器面板、容器关机、重试启动。
  - Tabs 需要 feature availability model：terminal enabled、files placeholder、preview placeholder。
- 数据/状态：
  - orchestrator 读取 `RuntimeSnapshot` 驱动首帧。
  - orchestrator 订阅 runtime events 并将变化写入 store。
  - app 内部只维护 UI 状态：active tab、drawer open、last selected placeholder、menu open。
  - 容器核心状态的 UI 真相源是 store，不是 Svelte `$state`。
- UI/交互：
  - 页面进入即启动容器。
  - 主区域默认终端。
  - Files / Preview 是占位 Tab。
  - 容器状态在抽屉展示。
- 测试：
  - app 构建与 Svelte 类型检查。
  - UI 状态映射单测或组件测试。
  - 手动验证 COOP/COEP header、生效加载态、失败态、抽屉与菜单。

## Execution Steps / 执行步骤

1. 创建 `apps/web-claw` 项目骨架：
   - 添加 Svelte/Vite 配置、Tailwind v4、Bits/shadcn-svelte 基础配置。
   - 配置 `$lib` alias。
   - 配置 COOP/COEP dev 和 preview headers。
2. 迁移最小公共 UI 基础：
   - 从 `demos/webcontainer-openclaw` 迁移 Button、Tabs、Dropdown/Menu、Dialog/Drawer 所需封装。
   - 迁移 `cn`、基础 status banner / toast 结构时去除 demo 专属命名。
3. 建立 app shell：
   - `App.svelte` 挂载 `WebClawFrame`。
   - `WebClawFrame` 组合 Tabs 顶部区域、Main、RuntimeDrawer。
   - `WorkbenchTabs` 默认选中 Terminal，Files / Preview 占位。
4. 建立纯 TS 容器编排单例：
   - 在 `core/runtime` 中定义 `WebClawRuntimeOrchestrator`。
   - 在 `core/app/appContainer.ts` 中创建并导出项目级单例。
   - orchestrator 接收 runtime manager 注入，负责 app open、retry、shutdown 和 runtime events。
5. 建立 runtime store：
   - 在 `features/runtime/runtimeStore.ts` 中持有 `RuntimeViewState`。
   - store 订阅 orchestrator 输出，并向组件提供可订阅状态。
   - 组件不得直接写入 runtime 核心状态。
6. 接入 runtime view model：
   - 在 `features/runtime` 中定义 app 侧 view model adapter。
   - 先基于 `os-core` 技术方案定义的 snapshot/status 形态编写接口适配层。
   - 若 `packages/os-core` 尚未实现，执行阶段应先完成或同步完成 `os-core` runtime 契约，不能在 app 内自造 BrowserPod 分支。
7. 实现自动启动流程：
   - 页面 mount 后只触发 `appOpened()` intent。
   - orchestrator 负责将该 intent 转成 runtime boot。
   - 处理重复 mount、已 running、booting、failed、unsupported。
   - 启动失败不自动重试，只展示用户重试入口。
8. 实现容器抽屉和 More 菜单：
   - More 菜单提供打开容器面板、容器关机。
   - 抽屉展示状态、检查项、能力、错误、session 摘要。
9. 接入终端主区域：
   - running 前显示终端加载/阻塞态。
   - running 后接入终端统一交互方案的组件和 service。
   - Files / Preview 保持占位，不误触发未实现能力。
10. 验证与回写：

- 运行 `pnpm --filter web-claw check` 或同等 Svelte check。
- 运行 `pnpm --filter web-claw build`。
- 手动验证页面进入自动启动、loading、failed/unsupported、More 菜单、抽屉。
- 发现需求或方案偏差时先回写 SDD 文档，再继续实现。

## Risk And Mitigation / 风险与缓解

- 风险：`packages/os-core` 与 `packages/browserpod` 尚未落地，app 容易为了可跑而直接依赖 BrowserPod。
  - 缓解方式：执行阶段先落地最小 runtime 契约或使用明确的临时接口适配层；临时层仍不得暴露 BrowserPod SDK 到 UI 组件。
- 风险：容器生命周期编排散落在 Svelte 组件中，后续难以测试和复用。
  - 缓解方式：容器编排只能进入纯 TS orchestrator；组件只订阅 store 并派发 action。
- 风险：Svelte `$state` 被用作 runtime 真相源，造成状态来源不一致。
  - 缓解方式：runtime 核心状态由 store 持有；Svelte `$state` 仅可用于菜单开关、active tab 等局部 UI 状态。
- 风险：旧 specs 与当前 SDD 方案冲突。
  - 缓解方式：本方案明确旧 specs 为禁用参考；实现以 SDD 需求与技术方案为准。
- 风险：从 WebContainer demo 迁移 UI 时带入 WebContainer/web-os 依赖。
  - 缓解方式：只迁移纯 UI 和样式工具，不迁移 runtime 逻辑；迁移后检查 imports。
- 风险：自动启动容器导致失败态更早暴露，用户误以为终端坏了。
  - 缓解方式：loading/failed/unsupported 文案明确说明是容器准备状态，不归因到终端。
- 风险：容器关机没有真实 SDK dispose 能力。
  - 缓解方式：沿用 runtime 管理方案的统一“容器关机”语义，不承诺底层资源完全释放。
- 风险：Files/Preview 占位被误解为已实现功能。
  - 缓解方式：占位态明确写“未接入”，并说明依赖后续文件/预览迭代。
- 风险：设计偏离 Bits UI。
  - 缓解方式：控件状态、按钮、Tabs、Dropdown、Drawer/Dialog、Progress 对照 `docs/design/BitsUI.md`，不自行发明样式。

## Validation Plan / 验证计划

- 静态检查：
  - `pnpm --filter web-claw check`
  - `pnpm --filter web-claw build`
  - 如配置 lint，再运行 `pnpm --filter web-claw lint`
- 单元/组件测试：
  - `WebClawRuntimeOrchestrator`：app open 自动启动、重复启动幂等、失败后重试、关机 action。
  - `runtimeStore`：snapshot/event 到 view state 的映射。
  - Runtime status 到 UI state 的映射。
  - More menu action 到 runtime action intent 的映射。
  - Drawer view model 不展示 API Key 明文。
  - Files / Preview 占位状态不会调用 runtime feature API。
- 手动验证：
  - 打开页面后自动触发容器启动。
  - `checking` / `booting` 时主区域展示终端加载态。
  - `running` 后默认展示终端。
  - `failed` 时可重试并打开容器抽屉。
  - `unsupported` 时展示修复建议，不展示无效重试。
  - More 菜单可打开容器面板、触发容器关机。
  - Files / Preview Tab 展示占位态。
  - dev/preview 响应带 COOP/COEP headers。
- 验收证据：
  - `apps/web-claw` 存在并属于 pnpm workspace。
  - `apps/web-claw` 不直接 import `@leaningtech/browserpod`。
  - `apps/web-claw` 不依赖 `web-os`。
  - 主页面结构与本方案页面结构一致。
  - 验证命令输出和必要截图/录屏。

## Execute Checkpoint / 执行检查点

- 当前理解：
  - web-claw 第一阶段是“一台浏览器内计算机”的正式 app 壳层，进入页面即启动唯一当前容器，默认任务是终端。
- 核心目标：
  - 创建正式 `apps/web-claw`，用 Svelte/Vite + Bits UI 风格承载 runtime、终端、文件占位和预览占位。
- 下一步动作：
  - 等用户确认本技术方案，并明确是否批准进入执行阶段。
- 风险：
  - `os-core` / `browserpod` 未落地时，app 接入需要严格避免绕过契约；旧 specs 不能反向污染实现。
- 验证方式：
  - 文档对齐、Svelte check、build、COOP/COEP 手动验证、页面状态流手动验证。
- Execution Approval: `Pending`
