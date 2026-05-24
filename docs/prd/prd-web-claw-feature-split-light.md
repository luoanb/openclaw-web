# web-claw 功能拆分队列 — PRD（Light）

| 属性 | 内容 |
|------|------|
| 状态 | 草稿 |
| 完整版 PRD | 暂无 |
| 技术契约 | 待补：`docs/specs/2026-05-24_18-00_web-claw-core-contract.md` |

## 范围（极简）

**包含**：将 web-claw 产品能力拆成可独立评审的功能文档队列，并明确每个功能属于 `apps/web-claw`、`packages/os-core`、`packages/browserpod` 中的哪一层。

**不包含**：新增 `file-manager`、`service-manager`、`runtime-core`、`runtime-browserpod` 等额外 package；不在本文定义 API schema；不进入代码实现。

---

## 功能与交互

### 1. 阶段 1：运行与终端 MVP

| 项目 | 说明 |
|------|------|
| **产品文档** | [`prd-web-claw-light.md`](./prd-web-claw-light.md) |
| **用户入口** | `apps/web-claw` 主页面默认运行视图。 |
| **核心能力** | BrowserPod 启动/停止、运行状态、API Key / 隔离环境提示、单终端输入输出、多终端创建/切换/关闭、当前任务中止。 |
| **app 职责** | 页面布局、状态展示、按钮、终端列表、错误提示。 |
| **os-core 职责** | 定义 runtime、process、terminal、事件、错误与状态契约。 |
| **browserpod 职责** | 基于 BrowserPod SDK 落实 boot、terminal、run、中止和能力降级。 |
| **完成条件** | 用户可在 web-claw 中启动 BrowserPod，并至少使用一个终端完成输入输出；多终端基础管理可评审。 |

**验收**

- [ ] 运行与终端 MVP 的入口、状态、异常、验收标准已在 Light PRD 中明确。
- [ ] 后续 `os-core` 契约只覆盖运行、进程、终端、错误和事件，不扩散到文件/服务实现。
- [ ] `browserpod` 实现 spec 能从本阶段文档直接追溯到产品验收项。

---

### 2. 阶段 2：命令驱动文件管理

| 项目 | 说明 |
|------|------|
| **产品文档** | 待补：`docs/prd/prd-web-claw-files-light.md` |
| **用户入口** | 运行视图中的文件面板、侧栏或 Dialog，具体形态待定。 |
| **核心能力** | 从容器内执行命令获取文件列表、读取文本、写入文本、创建目录、删除、重命名。 |
| **关键约束** | 文件事实源来自容器内命令执行结果；不假设外部能实时监听容器内文件变化。 |
| **app 职责** | 文件树/列表展示、刷新入口、操作确认、错误提示。 |
| **os-core 职责** | 定义文件命令、结果解析、刷新状态、错误类型。 |
| **browserpod 职责** | 使用 BrowserPod 进程或文件 API 实现命令与结果采集，并说明与“终端命令事实源”的关系。 |

**验收**

- [ ] 文件管理 PRD 明确“刷新才同步”的用户心智。
- [ ] 删除、覆盖、重命名等破坏性操作在产品文档中有确认策略。
- [ ] 技术契约不把 BrowserPod 私有文件对象泄漏到 app。

---

### 3. 阶段 3：服务预览多 tab

| 项目 | 说明 |
|------|------|
| **产品文档** | 待补：`docs/prd/prd-web-claw-services-preview-light.md` |
| **用户入口** | 运行视图中的预览区域或独立服务 tab 区域。 |
| **核心能力** | 接收 BrowserPod Portal 事件，展示服务端口、URL、状态；支持多个服务 tab 切换、刷新、新标签打开、关闭。 |
| **app 职责** | iframe/新标签交互、服务列表、当前预览状态、错误提示。 |
| **os-core 职责** | 定义 service endpoint、preview event、tab 状态。 |
| **browserpod 职责** | 将 `onPortal` 映射为 `os-core` 服务事件。 |

**验收**

- [ ] 多服务出现时，用户能选择当前预览服务。
- [ ] Portal URL、端口和加载状态可见。
- [ ] iframe 不可用时有新标签打开的降级入口。

---

### 4. 阶段 4：workspace 持久化与快照

| 项目 | 说明 |
|------|------|
| **产品文档** | 待补：`docs/prd/prd-web-claw-workspace-light.md` |
| **用户入口** | 文件或运行面板中的 workspace 管理入口。 |
| **核心能力** | 基于 BrowserPod `storageKey` 的本地持久化说明；按需补充用户可见快照列表、导入、导出。 |
| **关键约束** | 不沿用 WebContainer `FileSystemTree` / `mount` 假设；需要重新定义 BrowserPod 语义。 |
| **app 职责** | workspace 选择、保存、恢复、覆盖确认。 |
| **os-core 职责** | 定义 workspace 标识、状态、快照元数据。 |
| **browserpod 职责** | 说明 `storageKey`、BrowserPod 文件系统和快照能力之间的实现关系。 |

**验收**

- [ ] 用户能理解持久化是自动盘级、手动快照，还是两者并存。
- [ ] 覆盖当前 workspace 前有明确确认策略。
- [ ] 快照实现不依赖废案 `web-os` 的 IDB schema。

---

## 数据与展示约定

- 所有功能文档必须能回链到 `os-core` 契约或说明暂不需要技术契约。
- 所有 BrowserPod 细节只能出现在 `packages/browserpod` 实现文档或实现代码中，app 文档只描述用户行为。
- `packages/os-core` 与 `packages/browserpod` 是本阶段唯二 package 边界；功能扩展只能在这两个包内分域，不新增 package。

---

## 待定

| 项 | 说明 |
|----|------|
| app 技术栈 | `apps/web-claw` 是否使用 Svelte 5 + Vite 作为正式产品壳。 |
| 文件管理首版入口 | 文件面板、Dialog、侧栏三者选型。 |
| 服务预览入口 | 是否与运行终端同屏，还是独立顶部 tab。 |
| workspace 快照 | 是否进入 MVP 2，还是等文件管理完成后再定。 |

---

## 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-05-24 | 初稿；将功能队列按运行终端、文件管理、服务预览、workspace 拆分，并固定 os-core/browserpod 两包边界。 |
