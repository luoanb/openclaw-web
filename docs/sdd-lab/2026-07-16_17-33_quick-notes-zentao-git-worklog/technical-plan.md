# Technical Plan / 技术方案: quick-notes zentao git worklog

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-07-16_17-33_quick-notes-zentao-git-worklog/requirements.md`
- 对应视觉设计文档：`docs/sdd-lab/2026-07-16_17-33_quick-notes-zentao-git-worklog/visual-design.md`
- 需求确认状态：用户已批准按附加 plan 落地技术边界方案；代码执行仍未进入。
- 本方案覆盖范围：
  - 本地 Windows Git 仓库与 WSL Git 仓库的提交抓取方式。
  - 禅道 REST API 调用边界与第一版创建并完成任务接口契约。
  - 前端/后端模块落点。
  - 仓库配置、禅道凭据和同步记录的本地存储策略。
  - 定时自动触发的第一版执行边界。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `apps/quick-notes-dayu/src-tauri/src/lib.rs`
  - `apps/quick-notes-dayu/src/lib/core/quick-notes-repository.ts`
  - `apps/quick-notes-dayu/src/lib/core/quick-notes-types.ts`
  - `apps/quick-notes-dayu/src/App.svelte`
  - `apps/quick-notes-dayu/src/app.css`
  - `apps/quick-notes-dayu/src-tauri/Cargo.toml`
  - `apps/quick-notes-dayu/package.json`
- 当前实现事实：
  - Tauri 后端目前只有 `load_store`、`save_store`、`toggle_devtools` 三个 command。
  - `QuickNotesStore` 目前只包含 `tasks` 与 `notes`。
  - 前端通过 `QuickNotesRepository` 调用 Tauri `invoke`，再由 service 层归一化数据。
  - 当前应用没有前端 shell 权限、HTTP 插件或独立配置仓库。
  - 现有数据落在 Tauri `app_data_dir()` 下的 `quick-notes.json`。
- 禅道公开 API 事实：
  - REST API 常见认证方式为 `POST /api.php/v1/tokens`，请求体包含 `account` 与 `password`，响应返回 `token`。
  - 后续业务接口通过 Header `Token: <token>` 携带认证。
  - 当前用户系统为禅道开源版 18.13。
  - 创建任务的公开 REST v1 接口为 `POST /api.php/v1/executions/:executionID/tasks`。
  - 创建任务核心字段包括 `name`、`type`、`assignedTo`、`estStarted`、`deadline`，`estimate` 为可选预计工时。
  - 完成任务的公开 REST v1 接口为 `POST /api.php/v1/tasks/:id/finish`。
  - 完成任务核心字段包括 `currentConsumed`、`finishedDate`，可选字段包括 `assignedTo`、`realStarted`、`comment`。
- 约束与风险：
  - 用户实际禅道项目/迭代权限、用户账号和任务字段约束仍可能不同，第一版必须提供连接验证与错误展示。
  - WSL 仓库读取不应优先依赖 Windows Git 访问 `\\wsl$`，应优先在 WSL 内执行 Git。
  - 凭据不能混入任务/速记 store，也不能在错误日志或 UI 中明文回显。

## Open Questions / 开放问题

- [x] Q1 禅道任务如何定位？
  - 触发来源：用户补充 / 禅道接口契约
  - 用户回答/确认：每次打卡固定创建任务，不拉取已有任务；只有项目、迭代等候选需要拉取。
  - 状态：已关闭
- [x] Q2 用户禅道版本是什么？
  - 触发来源：公开 API 版本差异
  - 用户回答/确认：当前系统为禅道开源版 18.13。
  - 状态：已关闭
- [ ] Q3 创建任务的 `assignedTo` 默认使用哪个禅道账号？
  - 触发来源：禅道创建任务接口必填字段
  - 无法确定的内容：任务指派给当前登录账号，还是允许在配置中填写固定账号。
  - 影响范围：`create_zentao_tasks` payload 与 UI 配置字段。
  - 候选处理：第一版默认使用当前登录账号；若 API 无法稳定获取当前账号，则配置 `assignedTo`。
  - 用户回答/确认：待确认。
  - 状态：待用户确认
- [x] Q4 Tab 名称和任务最终状态是什么？
  - 触发来源：用户补充
  - 用户回答/确认：Tab 名称固定为【禅道打卡】；任务应该创建并完成。
  - 状态：已关闭

## Solution Options / 方案候选

### Option A / 方案 A：Tauri 后端统一执行 Git 与禅道 API

- 推荐：是
- 方案摘要：本地命令、WSL 命令和禅道 HTTP 都放在 Rust 后端，前端只通过结构化 Tauri commands 触发。
- 涉及模块：
  - `src-tauri/src/git.rs`
  - `src-tauri/src/zentao.rs`
  - `src-tauri/src/worklog.rs`
  - `src-tauri/src/config.rs`
  - `src/lib/core/worklog/**`
  - `src/lib/features/worklog/**`
- 优点：
  - 命令执行边界清晰，不开放任意 shell。
  - WSL、路径、编码、超时、错误解析都在后端集中处理。
  - 禅道凭据不暴露给前端 HTTP 层，避免跨域和前端日志泄漏。
  - 与当前 Tauri command + repository 模式一致。
- 缺点：
  - Rust 后端模块会明显增加。
  - 需要新增 HTTP client 依赖。
- 风险：
  - 用户禅道项目/迭代权限或创建/完成任务字段约束导致提交失败。
  - 用户环境缺少 `git.exe`、`wsl.exe` 或 WSL 内 `git`。

### Option B / 方案 B：前端调用 Tauri shell/http 插件

- 推荐：否
- 方案摘要：前端通过 Tauri shell 插件执行 Git，通过 HTTP 插件调用禅道。
- 涉及模块：
  - 前端 worklog repository/service
  - Tauri shell/http plugin capability
- 优点：
  - Rust 自定义代码较少。
- 缺点：
  - shell 权限面更大，配置复杂。
  - 前端更容易接触凭据和命令细节。
  - 与当前 `quick-notes-dayu` 的简单 Tauri command 模式不一致。
- 风险：
  - capability 配置不当会扩大本地命令执行风险。
  - 业务错误处理分散在前端。

## Decision / 方案决策

- Selected / 选定方案：Option A，Tauri 后端统一执行 Git 与禅道 API。
- Why / 选择原因：附加 plan 已明确后端可信边界；该方案最符合本地命令、WSL、凭据、禅道 API 和错误处理的风险收敛要求。
- Decision Owner / 决策人：user
- Decision Time / 决策时间：2026-07-16 17:47
- Open Questions 状态：存在 Q1/Q2，但不阻塞技术边界落盘；执行实现前必须确认或采用默认值。

## API Design / API 设计

### Contract Scope / 契约范围

- 变更类型：新增
- 消费方：`WorklogTab` 前端功能域
- 真相源文件：
  - 后端：`apps/quick-notes-dayu/src-tauri/src/worklog.rs`
  - 前端：`apps/quick-notes-dayu/src/lib/core/worklog/worklog-types.ts`

### `WorklogConfig`

- `repositories: WorklogRepositoryConfig[]`：Git 仓库配置。
- `zentao: ZentaoConfig`：禅道连接与提交配置。
- `schedule: WorklogScheduleConfig`：定时触发配置。
- `lastRun?: WorklogRunSummary | null`：最近一次运行结果。

### `WorklogRepositoryConfig`

- `id: string`：仓库配置 ID。
- `name: string`：显示名称。
- `enabled: boolean`：是否参与抓取。
- `environment: "windows" | "wsl"`：仓库运行环境。
- `windowsPath?: string`：Windows 本地仓库路径。
- `wslDistro?: string`：WSL 发行版名称，例如 `Ubuntu`。
- `wslPath?: string`：WSL 内 Linux 路径，例如 `/home/me/repo`。
- `wslUncPath?: string`：可选展示路径，例如 `\\wsl$\Ubuntu\home\me\repo`。
- `authorFilter?: string | null`：可选作者过滤。
- `branch?: string | null`：可选分支过滤。

### `ZentaoConfig`

- `baseUrl: string`：禅道站点地址，不包含尾部 `/api.php/...`。
- `account: string`：禅道账号。
- `passwordSecretRef?: string | null`：凭据引用，不在前端 store 明文展示。
- `projectId?: number | null`：从禅道拉取并选择的项目 ID。
- `executionId?: number | null`：从禅道拉取并选择的迭代/执行 ID，用于创建任务。
- `assignedTo?: string | null`：任务指派账号，用于创建任务接口 `assignedTo` 字段；第一版 UI 可留空，后端默认使用当前登录账号 `account`。
- `taskType?: string | null`：任务类型，下拉枚举选择，默认 `devel`；第一版枚举为 `design`、`devel`、`request`、`test`、`study`、`discuss`、`ui`、`affair`、`misc`。
- `estimate: number`：预计工时，单位小时。
- `titleTemplate: string`：任务名称模板。
- `descriptionTemplate?: string | null`：任务描述模板，默认包含提交明细。
- `finishCommentTemplate?: string | null`：完成备注模板，默认复用提交明细。

### `GitCommitRecord`

- `repositoryId: string`：来源仓库 ID。
- `repositoryName: string`：来源仓库名称。
- `hash: string`：完整 commit hash。
- `shortHash: string`：短 hash。
- `message: string`：commit message。
- `authorName: string`：作者名称。
- `authorEmail: string`：作者邮箱。
- `committedAt: string`：ISO 时间。

### `ZentaoTaskDraft`

- `id: string`：前端预览 ID。
- `commitKey: string`：去重 key，建议为 `${repositoryId}:${hash}`。
- `executionId: number`：目标迭代/执行 ID。
- `date: string`：同步日期，格式 `YYYY-MM-DD`。
- `name: string`：任务名称。
- `type: string`：任务类型，默认 `devel`。
- `assignedTo: string`：指派账号。
- `estimate: number`：预计工时。
- `estStarted: string`：计划开始日期。
- `deadline: string`：计划截止日期。
- `desc?: string`：任务描述，默认包含提交明细。
- `finishComment: string`：完成任务备注。

### Tauri Commands

- `load_worklog_config() -> WorklogConfig`
- `save_worklog_config(config: WorklogConfig) -> WorklogConfig`
- `validate_repository(config: WorklogRepositoryConfig) -> RepositoryValidationResult`
- `scan_git_commits(request: ScanGitCommitsRequest) -> ScanGitCommitsResult`
- `validate_zentao_config(config: ZentaoConfig) -> ZentaoValidationResult`
- `list_zentao_projects(config: ZentaoConfig) -> Vec<ZentaoProjectOption>`
- `list_zentao_executions(request: ListZentaoExecutionsRequest) -> Vec<ZentaoExecutionOption>`
- `preview_zentao_tasks(request: PreviewZentaoTasksRequest) -> Vec<ZentaoTaskDraft>`
- `create_and_finish_zentao_tasks(request: CreateAndFinishZentaoTasksRequest) -> CreateAndFinishZentaoTasksResult`

### Git Command Contract / Git 命令契约

- Windows 仓库：
  - 程序：`git`
  - 参数：`-C <windowsPath> log --since <start> --until <end> --pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e`
- WSL 仓库：
  - 程序：`wsl.exe`
  - 参数：`-d <wslDistro> -- git -C <wslPath> log --since <start> --until <end> --pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e`
- 安全约束：
  - 不拼接 shell 字符串。
  - 使用 `Command::new(program).args([...])` 传参。
  - 对日期、路径、distro 做结构化校验。
  - 设置超时策略，超时后返回该仓库失败，不阻塞其他仓库。

### Zentao API Contract / 禅道 API 契约

- 获取 Token：
  - `POST {baseUrl}/api.php/v1/tokens`
  - Header：`Content-Type: application/json`
  - Body：`{"account":"<account>","password":"<password>"}`
  - Response：`{"token":"<token>"}`
- 创建任务：
  - `POST {baseUrl}/api.php/v1/executions/{executionId}/tasks`
  - Header：`Token: <token>`、`Content-Type: application/json`
  - Payload：
    - `name: string`
    - `type: string`，来自禅道任务类型下拉枚举。
    - `assignedTo: string`
    - `estimate?: number`
    - `estStarted: string`
    - `deadline: string`
    - `desc?: string`
- 完成任务：
  - `POST {baseUrl}/api.php/v1/tasks/{taskId}/finish`
  - Header：`Token: <token>`、`Content-Type: application/json`
  - Payload：
    - `currentConsumed: number`
    - `finishedDate: string`
    - `assignedTo?: string`
    - `realStarted?: string`
    - `comment?: string`
- 项目/迭代候选：
  - 具体接口需在实现前按禅道 18.13 当前部署验证；第一版后端保留 `list_zentao_projects` 和 `list_zentao_executions` 窄口 command，不让前端直接拼 URL。

## Execution Steps / 执行步骤

### Step 0. 执行前检查

- 前置条件：
  - 用户确认创建任务的 `assignedTo` 默认账号。
  - 用户确认项目/迭代候选拉取接口在当前禅道 18.13 部署中可用；若接口受限，退回手动输入 ID。
  - 用户确认 WSL 输入采用 `发行版 + Linux 路径` 为主，`\\wsl$` 仅作为展示/兼容输入。
- 若执行前需求、API、范围或交互规则变化：
  - 先回写 `requirements.md` 与本文件，再进入代码实现。

### Step 1. 拆分 Tauri 后端模块

#### 文件：`apps/quick-notes-dayu/src-tauri/src/lib.rs`

- 改动类型：修改
- 改动内容：
  - 保留现有 `load_store`、`save_store`、`toggle_devtools`。
  - 新增 `mod git; mod zentao; mod worklog; mod config;`。
  - 注册新增 Tauri commands。
- 设计约束：
  - `lib.rs` 不继续堆业务实现，只保留 command 注册与既有 store 函数迁移计划。
- 验收点：
  - 现有任务/速记读写命令不变。

#### 文件：`apps/quick-notes-dayu/src-tauri/src/git.rs`

- 改动类型：新增
- 改动内容：
  - 实现 Windows Git 仓库验证与提交扫描。
  - 实现 WSL Git 仓库验证与提交扫描。
  - 实现 Git log 输出解析。
- 设计约束：
  - 固定命令与参数，不允许任意 shell。
  - 单仓库失败返回结构化错误，不 panic。
- 验收点：
  - Windows 仓库和 WSL 仓库均可返回指定日期 commit。

#### 文件：`apps/quick-notes-dayu/src-tauri/src/zentao.rs`

- 改动类型：新增
- 改动内容：
  - 实现 token 获取、连接验证、项目候选拉取、迭代候选拉取、创建任务、完成任务。
- 设计约束：
  - 错误信息脱敏，不回显密码/token。
  - HTTP 超时明确。
- 验收点：
  - 可验证 API 地址与账号。
  - 可拉取项目/迭代候选。
  - 可在所选迭代下创建任务并完成任务。

#### 文件：`apps/quick-notes-dayu/src-tauri/src/worklog.rs`

- 改动类型：新增
- 改动内容：
  - 定义后端 DTO。
  - 实现 commit 到 `ZentaoTaskDraft` 的模板渲染。
  - 实现创建并完成任务结果聚合。
- 设计约束：
  - 模板变量第一版支持 `{repo}`、`{message}`、`{hash}`、`{shortHash}`、`{author}`、`{date}`。
- 验收点：
  - 能从提交记录生成待创建并完成的禅道任务。

#### 文件：`apps/quick-notes-dayu/src-tauri/src/config.rs`

- 改动类型：新增
- 改动内容：
  - 独立读写 `worklog-config.json`。
  - 保存仓库、禅道非敏感配置、定时配置和最近一次运行摘要。
  - 保存密码时第一版可采用本地文件存储 + UI 脱敏；若引入系统密钥环，需另增依赖和验证。
- 设计约束：
  - 不写入现有 `quick-notes.json`。
  - 日志、错误和返回值不得包含明文密码/token。
- 验收点：
  - 配置读写不影响任务/速记 store。

### Step 2. 新增前端 worklog core

#### 文件：`apps/quick-notes-dayu/src/lib/core/worklog/worklog-types.ts`

- 改动类型：新增
- 改动内容：
  - 定义 `WorklogConfig`、`WorklogRepositoryConfig`、`ZentaoConfig`、`GitCommitRecord`、`ZentaoTaskDraft` 等类型。
- 设计约束：
  - 与 API Design 保持一致。
- 验收点：
  - 前后端 DTO 字段命名一致。

#### 文件：`apps/quick-notes-dayu/src/lib/core/worklog/worklog-repository.ts`

- 改动类型：新增
- 改动内容：
  - 封装 `invoke` 调用。
  - 统一错误消息转换。
- 设计约束：
  - 前端不拼 Git 命令，不直接调用禅道 URL。
- 验收点：
  - UI 只依赖 repository 方法。

#### 文件：`apps/quick-notes-dayu/src/lib/core/worklog/worklog-service.ts`

- 改动类型：新增
- 改动内容：
  - 处理 UI 状态归一化、选择状态、过滤、结果聚合。
- 设计约束：
  - 业务逻辑用 class 封装，符合 `core` 编码约定。
- 验收点：
  - 组件内不散落复杂数据转换。

### Step 3. 新增禅道打卡 UI

#### 文件：`apps/quick-notes-dayu/src/App.svelte`

- 改动类型：修改
- 改动内容：
  - 扩展 `QuickNotesTab` 为 `tasks | notes | worklog`。
  - Header 新增 `禅道打卡` Tab。
  - 搜索 placeholder 在 worklog Tab 中变为提交过滤语义。
- 设计约束：
  - 延续现有 Header Tab 样式。
- 验收点：
  - 现有任务/速记 Tab 行为不变。

#### 文件：`apps/quick-notes-dayu/src/lib/features/worklog/WorklogTab.svelte`

- 改动类型：新增
- 改动内容：
  - 实现三栏布局：仓库与日期、提交预览、禅道打卡。
  - 接入配置读写、抓取提交、预览、创建并完成任务和定时状态。
  - 左栏提供仓库/定时配置保存入口；右栏提供禅道配置保存入口，两个入口均保存同一份 `WorklogConfig`。
- 设计约束：
  - 遵循 `visual-design.md`。
  - 错误就近展示，不默认弹窗。
- 验收点：
  - 可完整走通手动抓取、创建任务、完成任务路径。

### Step 4. 定时触发

#### 文件：`apps/quick-notes-dayu/src/lib/features/worklog/WorklogTab.svelte`

- 改动类型：修改
- 改动内容：
  - 第一版使用应用运行时 timer。
  - 定时触发只在配置完整、禅道验证通过且用户启用时运行。
  - 记录最近一次运行摘要。
- 设计约束：
  - 应用关闭后不执行自动同步；该限制需在 UI 文案说明。
- 验收点：
  - 启用后可在应用运行期间自动触发。

### Step 5. 检查与回写

#### 命令

- 运行：
  - `pnpm --filter quick-notes check`
  - `pnpm --filter quick-notes build`
  - `pnpm --filter quick-notes tauri:build`
- 修复：
  - 修复新增 TypeScript/Svelte/Rust 编译错误。
  - 若当前环境缺少 Rust/Cargo，记录阻塞原因并至少完成前端检查。

#### 文件：`docs/sdd-lab/2026-07-16_17-33_quick-notes-zentao-git-worklog/lifecycle.md`

- 回写执行记录：
  - 实际改动摘要。
  - 验证命令和结果。
  - 偏差、剩余风险、下一步。

## Risk And Mitigation / 风险与缓解

- 风险：禅道 18.13 当前部署的项目/迭代列表接口或权限与公开文档不一致。
  - 缓解方式：项目/迭代拉取失败时展示脱敏错误；保留手动输入 ID 的技术 fallback。
- 风险：WSL Git 执行失败。
  - 缓解方式：仓库级错误隔离；提示发行版、路径和 WSL 内 `git` 检查项。
- 风险：凭据明文存储。
  - 缓解方式：第一版至少从任务/速记 store 分离，并在 UI 和日志脱敏；若需要更高安全性，后续引入系统 keyring。
- 风险：定时触发误写入。
  - 缓解方式：必须显式启用；配置不完整或验证失败不执行创建/完成；运行结果可见。
- 风险：重复创建任务。
  - 缓解方式：使用 `repositoryId + commit hash + date + executionId` 生成本地去重 key；默认已创建记录跳过，不覆盖。

## Execute Checkpoint / 执行检查点

- 当前理解：新增【禅道打卡】Tab，将 Git 提交记录聚合为禅道任务创建请求，并在创建后立即完成任务。
- 核心目标：本地/WSL Git 抓取和禅道创建/完成任务 API 都通过 Tauri Rust 后端窄口 command 实现。
- 下一步动作：等待用户确认执行代码实现；执行前建议确认 `assignedTo` 默认账号。
- 风险：禅道 18.13 项目/迭代拉取接口、权限和 `assignedTo` 默认值仍需确认；未确认前执行应采用本文默认值并保留可配置项。
