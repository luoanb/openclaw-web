# Visual Design / 视觉设计文档: quick-notes zentao git worklog

## Source / 来源

- 设计来源：无外部 Figma 页面稿；本设计由当前需求文档、`quick-notes-dayu` 现有应用壳、`PRODUCT.md`、`DESIGN.md` 与 `docs/design/BitsUI.md` 约束生成。
- 对应需求文档：`docs/sdd-lab/2026-07-16_17-33_quick-notes-zentao-git-worklog/requirements.md`
- 当前应用事实：
  - `quick-notes-dayu` 采用顶部 Header Tab：任务、速记。
  - Header 右侧已有当前 Tab 搜索输入与设置菜单。
  - 主体区域为满屏工作台，背景 `bg-background`，内容使用 `bg-card`、`border`、`text-muted-foreground` 等语义 token。
- 组件参考：
  - Button：`docs/design/BitsUI.md` 中 Buttons / Button with icon。
  - Select：`docs/design/BitsUI.md` 中 Select。
  - Switch：`docs/design/BitsUI.md` 中 Switch。
  - Date field / Calendar：`docs/design/BitsUI.md` 中 Date field / Calendar。
  - Tabs：`docs/design/BitsUI.md` 中 Tabs。
  - Collapsible：`docs/design/BitsUI.md` 中 Collapsible。
  - Tooltip / Popover：`docs/design/BitsUI.md` 中 Tooltip / Popover。

## Page Design / 页面设计

### Design Intent / 设计意图

本 Tab 是一个本地工作流工具，不做营销式视觉。界面要让用户快速确认三件事：仓库从哪里来、今天抓到了什么、是否已经安全完成禅道打卡。

视觉气质采用 restrained product UI：浅色工作台、低饱和中性色、少量语义状态色。主操作使用 `primary`，成功、警告、失败只用于状态反馈，不作为装饰。

### Information Architecture / 信息架构

- Header：
  - 新增一级 Tab：`禅道打卡`，与 `任务`、`速记` 同级。
  - Header 搜索在该 Tab 中建议改为提交记录过滤，placeholder 为 `搜索仓库、提交信息或作者`。
  - Header Menu 保持原有入口，不承载本 Tab 的主配置。
- 主体：
  - Tab 内分为两个 view：初始化配置 view 与打卡 view。
  - 首次或配置缺失时：展示初始化配置 view，完成禅道连接验证后进入打卡 view。
  - 初始化完成后：用户可以在初始化配置 view 与打卡 view 之间任意切换。
  - 日常工作台顶部：打卡控制条，包含日期、项目、迭代、任务类型、工时和定时触发。
  - 日常工作台左侧：已登记仓库与本次参与仓库多选。
  - 日常工作台中间：打开预览后的提交记录和待创建任务。
  - 日常工作台右侧：打卡确认、最近运行结果和配置状态。
- 底部或局部反馈：
  - 复用现有保存失败横条模式。
  - 本 Tab 内部错误优先就近展示，不使用全局弹窗作为默认反馈。

### Initialization View / 初始化配置 View

- 触发条件：
  - 禅道地址、账号、密码任一缺失。
  - 已保存地址、账号、密码但进入页面自动验证失败。
- 结构：
  - 顶部：Tab 内 view 切换，包含 `初始化配置` 与 `打卡`；未验证成功时 `打卡` 禁用。
  - 顶部：标题 `初始化配置`，说明“先验证禅道连接，仓库可先登记也可稍后补充”。
  - 必填区：API 地址、账号、密码；密码右侧放置 `验证` 按钮。
  - 仓库区：Windows/WSL 仓库新增、编辑、删除。
  - 底部状态：验证失败原因或验证成功提示。
- 切换规则：
  - 未验证成功时不能进入打卡 view。
  - `验证` 负责验证和保存；验证成功后进入打卡 view。
  - 初始化完成后，可随时切回初始化配置 view 维护禅道基础信息和仓库配置。
  - 不使用弹窗、蒙版或遮罩承载初始化配置。

### Daily Layout / 日常布局

- 画布：`100dvh`，延续现有 Header 高度 `h-14`。
- 主体采用“顶部控制条 + 三栏内容”：
  - 顶部控制条高度按内容自适应，承载日期、项目、迭代、任务类型、工时、任务名模板、定时触发。
  - 左栏宽度约 `300px`，用于仓库多选和配置状态。
  - 中栏自适应，最小宽度约 `420px`，用于提交预览和待创建任务。
  - 右栏宽度约 `320px`，用于提交打卡、最近运行结果和错误恢复。
- 栏之间用 `border-r` 分隔，不使用嵌套阴影卡片。
- 各栏内部使用标题区、工具条、滚动内容区，保持工作台密度。

### Simulated Desktop View / 桌面模拟效果

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Quick Notes   任务   速记   禅道打卡                                                搜索提交...  ⋯ │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 日期 [2026-07-17]  项目 [自动加载 ▾]  迭代 [自动加载 ▾] 类型 [开发 ▾] 工时 [1.0] 定时 [ ] │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 本次参与仓库                       │ 打卡预览                                      │ 提交打卡         │
│                                    │                                                │                  │
│ ☑ openclaw-web                     │ 8 commits from 2 repositories                 │ API 已验证        │
│   D:\work-space\openclaw-web       │                                                │ 项目/迭代已选择   │
│                                    │ openclaw-web              4 commits   成功     │                  │
│ ☑ dayu-api                         │   17:20 fix quick notes sync mapping           │ [打开预览]        │
│       D:\work-space\openclaw-web   │   16:42 add WSL repository requirement         │ 迭代     [可选 ▾] │
│                                    │   11:08 polish task row copy                   │ [提交打卡]        │
│ ☐ legacy-admin                     │                                                │                  │
│   E:\repos\legacy-admin            │ 待创建任务：[2026-07-17] openclaw-web 禅道打卡 │ 最近一次：成功    │
│                                    │                                                │                  │
│ [初始化配置] [打卡]                │                                                │                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Primary Flow / 主流程

- 入口：用户点击 Header 中的 `禅道打卡`。
- 第一步：系统检查初始化配置；必要时进入初始化配置 view。
- 第二步：初始化验证成功后，系统自动拉取项目；如已有项目 ID，则自动拉取迭代。
- 第三步：用户选择日期、项目、迭代、任务类型、工时、任务名模板和本次参与仓库。
- 第四步：用户点击 `打开预览`，系统抓取 Git 提交并生成待创建任务。
- 第五步：用户确认后点击 `提交打卡`，系统创建任务后立即完成该任务。
- 第六步：右栏和中栏同步展示成功、跳过、失败结果。

### Repository Configuration / 仓库配置区

- 每个仓库行显示：
  - 日常页面使用本次参与多选框。
  - 仓库名称。
  - 路径，使用单行截断，hover 或 tooltip 展示完整路径。
  - 环境标签：`Windows` 或 `WSL`。
  - 最近一次抓取状态：成功、失败、跳过。
- 添加仓库主要在初始化弹窗内完成；日常页提供 `管理初始化配置` 入口回到弹窗。
- WSL 仓库配置应展示发行版和 Linux 路径：
  - `Ubuntu`
  - `/home/me/dayu-api`
  - 可辅助显示系统路径：`\\wsl$\Ubuntu\home\me\dayu-api`

### Commit Preview / 提交预览区

- 默认按仓库分组。
- 仓库组头展示：
  - 选择框。
  - 仓库名。
  - commit 数量。
  - 抓取状态。
- commit 行展示：
  - 时间。
  - commit message。
  - 短 hash。
  - author。
  - 是否纳入本次禅道任务创建的选择状态。
- 空状态：
  - 标题：`这一天没有可同步的提交`
  - 说明：`换一个日期，或检查仓库启用状态。`
  - 操作：`重新抓取`
- 部分失败状态：
  - 成功仓库保留正常结果。
  - 失败仓库显示错误原因和 `重试此仓库`。

### ZenTao Submission Panel / 禅道打卡区

- 顶部状态：
  - `未配置`：提示填写 API 地址与认证信息。
  - `待验证`：展示 `验证连接` 按钮。
  - `已验证`：展示 API 域名与最近验证时间。
  - `验证失败`：展示失败原因和重试入口。
- 字段区：
  - 项目：进入页面自动拉取候选后选择。
  - 迭代：选择项目后自动拉取候选。
  - 指派账号：可选，说明文案为“创建任务时的 assignedTo；不填时使用当前登录账号”。
  - 任务类型：下拉列表，默认 `开发`，选项按禅道类型枚举提供。
  - 预计工时：数字输入，单位小时。
  - 任务名模板：单行或多行输入，帮助文案展示可用变量。
  - 完成备注：默认使用提交明细，可选编辑。
- 操作区：
  - `打开预览`：secondary，内部执行 Git 抓取和任务草稿生成。
  - `提交打卡`：primary，仅在有待创建任务且日常配置完整时启用。
  - 创建中/完成中显示 loading 状态，禁止重复点击。

### Scheduled Run / 定时触发区

- 使用 Switch 控制定时自动触发。
- 开启后展示：
  - 触发规则，例如 `每天 18:30`。
  - 下一次运行时间。
  - 最近一次运行结果。
- 项目、迭代和至少一个参与仓库配置完成后才允许启用。
- 配置不完整时，Switch 禁用并显示缺失原因。

### State Samples / 状态样例

#### Empty / 初始空状态

```text
提交记录

还没有抓取记录
选择日期、项目/迭代和参与仓库后点击“打开预览”，系统会读取当天 commit。

[打开预览]
```

#### Loading / 抓取中

```text
正在抓取 3 个仓库

openclaw-web      读取中
dayu-api          等待中
legacy-admin      已停用
```

#### Partial Failure / 部分失败

```text
抓取完成，2 个仓库成功，1 个仓库失败

openclaw-web      4 commits
dayu-api          WSL Git 不可用，请检查 Ubuntu 发行版和 git 命令
legacy-admin      已停用
```

#### Submission Result / 提交结果

```text
禅道打卡完成

成功 1 个，跳过 0 个，失败 0 个

创建结果：
任务 #2381 已创建并完成
```

### Visual Style / 视觉风格

- 颜色：
  - 背景：`bg-background`。
  - 面板：`bg-card`。
  - 次级区域：`bg-muted/40` 或 `bg-input/20`。
  - 正常文字：`text-foreground`。
  - 辅助文字：`text-muted-foreground`。
  - 危险/失败：`text-destructive` 和 `bg-destructive/5`。
  - 成功状态建议使用低饱和绿色 token，若当前应用无独立 success token，技术方案阶段需决定是否新增语义 token或使用中性成功文案。
- 字体：
  - 延续 Inter Variable。
  - 标题 `text-sm font-semibold`。
  - 正文和字段 `text-sm`。
  - 元信息和状态 `text-xs`。
  - hash、路径、模板变量可使用 monospace。
- 间距：
  - Header 延续现有 `h-14`。
  - 栏内 padding 建议 `p-4`。
  - 列表行高度建议 `44px` 到 `56px`，保证可读与点击目标。
- 边框与圆角：
  - 主体分栏使用 `border-r`。
  - 内部输入和按钮使用现有 `rounded-md`。
  - 状态摘要可使用 `rounded-lg border bg-card`，避免嵌套多层卡片。

### Responsive Behavior / 响应式

- 宽屏：三栏并排。
- 中等宽度：左栏可折叠，主体变为提交预览 + 禅道打卡双栏。
- 窄屏：改为纵向步骤：
  - Step 1 仓库与日期。
  - Step 2 提交预览。
  - Step 3 禅道打卡。
- Header 搜索在窄屏可隐藏为图标按钮，点击后展开。

### Accessibility / 可访问性

- 所有仓库启用、commit 选择、定时开关必须有可读 label。
- 状态不能只依赖颜色，必须包含文字：成功、失败、跳过、已停用。
- `创建并完成` 在禁用时必须说明原因。
- 错误信息就近展示，并提供可操作的下一步。
- 键盘顺序应遵循左栏到中栏再到右栏。
- 抓取中、创建中和完成中状态应通过文本区域更新，不要求强制弹窗打断。

## Icon / SVG Component Export / Icon 与 SVG 组件导出

- 导出目标路径：优先复用 `apps/quick-notes-dayu/src/lib/features/common/Icons.svelte`，是否新增 SVG 由技术方案阶段决定。
- 命名规则：语义命名，使用小写枚举名，例如 `git`, `wsl`, `clock`, `check-circle`, `alert-circle`。
- 颜色策略：默认 `currentColor`，状态图标继承文本语义色。
- 尺寸策略：列表与按钮内使用 `size-4`，空状态可使用 `size-5`。
- 可访问性属性：装饰图标 `aria-hidden="true"`；有状态含义时提供相邻文本，不让图标单独承载语义。

| Icon | Figma Node | SVG 文件名 | 组件名 | 尺寸 | 颜色策略 | 状态 |
| ---- | ---------- | ---------- | ------ | ---- | -------- | ---- |
| Git 仓库 | 无外部稿 | 待技术方案确认 | `git` | 16px | currentColor | 待确认 |
| WSL 仓库 | 无外部稿 | 待技术方案确认 | `wsl` | 16px | currentColor | 待确认 |
| 定时触发 | 无外部稿 | 待技术方案确认 | `clock` | 16px | currentColor | 待确认 |
| 成功 | 无外部稿 | 待技术方案确认 | `check-circle` | 16px | currentColor | 待确认 |
| 失败/警告 | 无外部稿 | 待技术方案确认 | `alert-circle` | 16px | currentColor | 待确认 |
