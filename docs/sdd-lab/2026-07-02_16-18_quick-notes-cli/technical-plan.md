# Technical Plan / 技术方案: quick-notes CLI

## Requirement Baseline / 需求基线

- 对应需求文档：`docs/sdd-lab/2026-07-02_16-18_quick-notes-cli/requirements.md`
- 需求确认状态：`Draft`；本方案用于用户评审，未进入代码执行。
- 本方案覆盖范围：为 `apps/quick-notes` 增加 CLI 命令入口的技术设计，包括命令集、Rust 模块拆分、数据读写复用、错误处理、验证策略。
- 本方案不覆盖：桌面 UI 改版、云同步、账号、提醒通知、复杂标签、Markdown 终端编辑器、多进程锁与冲突合并。

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
  - `AGENTS.md`
  - `.cursor/skills/sdd-riper-one-light/SKILL.md`
  - `.cursor/skills/sdd-lab/SKILL.md`
  - `apps/quick-notes/package.json`
  - `apps/quick-notes/src/App.svelte`
  - `apps/quick-notes/src/lib/core/quick-notes-types.ts`
  - `apps/quick-notes/src/lib/core/quick-notes-store.ts`
  - `apps/quick-notes/src/lib/core/quick-notes-repository.ts`
  - `apps/quick-notes/src/lib/core/tasks/task-service.ts`
  - `apps/quick-notes/src/lib/core/notes/note-service.ts`
  - `apps/quick-notes/src-tauri/Cargo.toml`
  - `apps/quick-notes/src-tauri/src/lib.rs`
  - `docs/specs/quick-notes-tauri-json.md`
- 当前实现事实：
  - Quick Notes 已有桌面端，基于 Tauri v2 + Svelte 5。
  - 前端业务逻辑已按 `TaskService`、`NoteService`、`QuickNotesStoreService` 拆分。
  - Tauri 后端目前在 `src-tauri/src/lib.rs` 中定义 JSON 数据结构、`load_store`、`save_store`、`validate_store` 和应用数据目录读写。
  - Rust 侧写入策略为先写 `quick-notes.json.tmp`，再 rename 到 `quick-notes.json`。
  - `docs/specs/quick-notes-tauri-json.md` 已记录当前数据模型：`tasks`、`notes`、`active/done/deprecated`、`pinnedAt`。
- 相关接口/数据结构：
  - `QuickNotesStore { tasks, notes }`
  - `QuickTask { id, content, status, createdAt, updatedAt, completedAt, pinnedAt }`
  - `QuickNote { id, content, createdAt, updatedAt, pinnedAt }`
  - Tauri command：`load_store`、`save_store`、`toggle_devtools`
- 约束与风险：
  - CLI 必须与桌面端读写同一份数据文件。
  - 当前 Rust 读写逻辑绑定 `AppHandle` 获取 app data dir；CLI 入口无法直接依赖运行中的 Tauri `AppHandle`。
  - 若 TypeScript CLI 直接读写 JSON，会重复实现路径、校验、原子写入和数据状态机，偏离当前 Tauri 后端事实。
  - `docs/specs/quick-notes-tauri-json.md` 曾引用 `docs/prd/prd-quick-notes-cli-light.md`，但当前仓库未找到该文件；本迭代以 `requirements.md` 作为 CLI 需求真相源。

## Open Questions / 开放问题

- [x] Q1 CLI 可执行文件名称是否固定为 `qn`，还是保留 `quick-notes` 为主命令、`qn` 作为后续别名？
  - 触发来源：需求与发布体验。
  - 无法确定的内容：最终安装后的用户入口命名。
  - 影响范围：Cargo bin 名、打包脚本、README 示例、后续 PATH 配置。
  - 候选处理：A. 主命令 `quick-notes`；B. 主命令 `qn`；C. 主命令 `q-notes`，并提供 `qn` 别名。
  - 用户回答/确认：使用 `q-notes` / `qn`。
  - 状态：已关闭。
- [x] Q2 第一版是否需要 `--json` 机器可读输出？
  - 触发来源：CLI 输出契约。
  - 无法确定的内容：第一版是否服务脚本/自动化。
  - 影响范围：输出格式、测试快照、错误结构。
  - 候选处理：A. 第一版只做人类可读文本；B. 同时支持 `--json`。
  - 用户回答/确认：第一版需要 `--json`。
  - 状态：已关闭。
- [x] Q3 删除命令是否需要确认保护？
  - 触发来源：数据安全。
  - 无法确定的内容：`delete` 是否直接执行，还是要求 `--yes`。
  - 影响范围：交互体验、脚本可用性、误删风险。
  - 候选处理：A. `delete <id> --yes`；B. 直接 `delete <id>`；C. 第一版暂不提供删除命令。
  - 用户回答/确认：删除必须传入 `--yes`。
  - 状态：已关闭。

## Solution Options / 方案候选

### Option A / 方案 A：Rust 共享 core + 同 crate CLI bin

- 推荐：是。
- 方案摘要：把 `src-tauri/src/lib.rs` 中的数据类型、读写、校验和业务状态流转抽到 Rust core 模块；Tauri command 与 CLI bin 同时调用该 core。CLI 作为同一个 Cargo package 下的新 binary，例如 `src-tauri/src/bin/q-notes.rs`，并提供 `qn` 别名入口。
- 涉及模块：
  - `apps/quick-notes/src-tauri/src/lib.rs`
  - `apps/quick-notes/src-tauri/src/main.rs`
  - `apps/quick-notes/src-tauri/src/store.rs`
  - `apps/quick-notes/src-tauri/src/domain.rs`
  - `apps/quick-notes/src-tauri/src/bin/q-notes.rs`
  - `apps/quick-notes/src-tauri/Cargo.toml`
- 优点：
  - 最大化复用当前真实存储契约，减少桌面端和 CLI 数据漂移。
  - CLI 与 Tauri 后端都由 Rust 编译期检查保护。
  - Windows 发布时可随 Tauri 构建链路一起产出可执行文件。
  - 便于后续把 store 逻辑加单元测试。
- 缺点：
  - 需要先拆 `lib.rs`，改动比直接加脚本略大。
  - CLI 参数解析需要新增 Rust 依赖或手写轻量解析。
- 风险：
  - `AppHandle.app_data_dir()` 与 CLI 计算 app data dir 的路径必须一致，否则会读写两份数据。
  - 拆分 `lib.rs` 时必须保持现有 Tauri command 行为不变。

### Option B / 方案 B：Node/TypeScript CLI 复用前端 core

- 推荐：否。
- 方案摘要：在 `apps/quick-notes` 增加 TS CLI，复用 `TaskService`、`NoteService`、`QuickNotesStoreService`，通过 Node fs 读写 JSON。
- 涉及模块：
  - `apps/quick-notes/src/lib/core/*`
  - 新增 CLI TS 入口和打包脚本
  - `package.json`
- 优点：
  - 可复用现有 TS 业务服务，命令实现速度快。
  - 输出格式和前端类型共享更直接。
- 缺点：
  - 需要处理 TS/Node 打包、运行时依赖、PATH 安装和 app data dir 计算。
  - 会绕过 Rust/Tauri 当前真实读写逻辑，重复实现原子写入和校验。
  - 桌面安装包与 Node CLI 分发链路割裂。
- 风险：
  - Windows app data 路径与 Tauri resolver 不一致时产生数据分叉。
  - TS core 使用 `globalThis.crypto.randomUUID()`，Node 运行时兼容性需要额外验证。

### Option C / 方案 C：独立 Rust workspace package

- 推荐：暂不推荐第一版。
- 方案摘要：在 `packages/` 或 workspace 新建独立 Rust/CLI 包，Quick Notes 桌面端与 CLI 通过包依赖共享 store crate。
- 涉及模块：
  - 新增 Rust package
  - `apps/quick-notes/src-tauri`
  - workspace 构建配置
- 优点：
  - 包边界清晰，适合长期作为独立 CLI 产品维护。
  - 后续可单独发布 CLI。
- 缺点：
  - 第一版工程成本高，需要先调整 workspace 与发布策略。
  - 当前功能仍处于单应用内扩展阶段，独立包容易过早抽象。
- 风险：
  - 引入跨包版本、路径和发布复杂度，影响快速验证。

## Decision / 方案决策

- Selected / 选定方案：待用户确认；推荐 Option A。
- Why / 选择原因：Option A 最贴合当前实现事实，能复用 Rust 读写与校验契约，降低 CLI 与桌面端数据不一致风险。
- Decision Owner / 决策人：user。
- Decision Time / 决策时间：待确认。
- Open Questions 状态：Q1、Q2、Q3 已关闭；方案选型仍待用户确认。
- Dependency Decision / 依赖决策：
  - CLI 参数解析采用 `clap` 作为底层库。
  - 推荐使用 `clap` derive API，以 Rust `struct` / `enum` 声明 `q-notes`、`qn`、`task`、`note`、`search`、`path` 等命令结构。
  - 决策时间：2026-07-02 16:29。

## Architecture / 技术分层

推荐结构：

```text
apps/quick-notes/src-tauri/src/
  lib.rs                       # Tauri builder 与 command 注册
  main.rs                      # 桌面应用入口
  domain.rs                    # QuickTask / QuickNote / QuickNotesStore / 状态流转
  store.rs                     # load/save/validate/原子写入/路径解析
  cli.rs                       # CLI 参数解析与输出协调
  bin/
    q-notes.rs                 # CLI binary 入口
    qn.rs                      # 可选别名入口，复用同一 CLI 分发逻辑
```

分层规则：

- `domain.rs` 不依赖 Tauri，不做文件系统读写。
- `store.rs` 不关心 CLI 输出格式，只负责路径、序列化、校验和原子写入。
- `lib.rs` 只把 Tauri `AppHandle` 解析出的路径交给 `store.rs`。
- `cli.rs` 只做参数解析、命令分发和输出，不直接拼 JSON 字符串。
- CLI 与 Tauri command 共享 `domain.rs` 和 `store.rs`。

## CLI Command Contract / CLI 命令契约

第一阶段建议命令：

```text
q-notes task add <content> [--json]
q-notes task list [--all|--active|--done|--deprecated] [--query <keyword>] [--json]
q-notes task done <id> [--json]
q-notes task restore <id> [--json]
q-notes task deprecate <id> [--json]
q-notes task pin <id> [--json]
q-notes task unpin <id> [--json]
q-notes task delete <id> --yes [--json]

q-notes note add <content> [--json]
q-notes note add --stdin [--json]
q-notes note list [--query <keyword>] [--json]
q-notes note show <id> [--json]
q-notes note pin <id> [--json]
q-notes note unpin <id> [--json]
q-notes note delete <id> --yes [--json]

q-notes search <keyword> [--json]
q-notes path [--json]

qn <same subcommands>
```

输出策略：

- 列表默认输出短 ID、状态/置顶标识、更新时间和内容摘要。
- 新增/更新成功输出目标对象 ID 和摘要。
- 任意命令传入 `--json` 时输出机器可读 JSON；成功与错误输出都应保持稳定结构。
- 删除命令必须传入 `--yes`，否则返回保护性错误并不修改数据。
- `path` 输出当前 CLI 使用的数据文件路径，用于排查 CLI 与桌面端是否读写同一份数据。
- 参数错误、找不到对象、读写失败返回非 0 exit code。

ID 匹配策略：

- 第一版可支持完整 UUID。
- 若支持短 ID，必须在当前集合内唯一；短 ID 命中多个对象时返回歧义错误。

## Data Path Strategy / 数据路径策略

目标：CLI 与 Tauri 桌面端读写同一份 `quick-notes.json`。

推荐实现：

- 保留 Tauri command 通过 `AppHandle.path().app_data_dir()` 获取路径。
- CLI 使用与 Tauri bundle identifier / app name 等价的路径解析策略。
- 实现 `q-notes path` 命令，作为人工验证和问题排查入口。
- 若无法可靠复刻 Tauri resolver，应优先引入 Tauri 兼容路径能力或在技术方案回退，不应先实现一套不确定路径。

Windows 验证重点：

- 桌面端创建一条任务。
- CLI 执行 `q-notes path`，确认路径与桌面端数据位置一致。
- CLI `task list` 能看到桌面端数据。
- CLI 新增任务后，桌面端重新加载可见。

## Dependency Strategy / 依赖策略

推荐最小依赖：

- `serde`、`serde_json`：沿用现有。
- `uuid` 或 Rust 标准能力替代：用于稳定生成 ID；若不新增依赖，可先使用时间戳 + 随机后缀，但不如 UUID 清晰。
- `clap`：CLI 参数解析底层库，启用 `derive` feature；用于多级子命令、全局 `--json`、删除保护 `--yes`、自动 `--help` / `--version` 和参数校验。

原则：

- 新依赖必须服务明确边界，不为第一版引入交互式 TUI、数据库或复杂终端 UI。
- 数据模型变化必须先更新 `docs/specs/quick-notes-tauri-json.md`。

`clap` 使用约定：

- 命令结构优先用 `#[derive(Parser)]`、`#[derive(Subcommand)]` 声明。
- `--json` 作为全局 flag 进入顶层 `Cli` 结构。
- `delete` 命令的 `--yes` 作为对应子命令必检 flag；缺失时由业务层返回保护性错误。
- `q-notes` 与 `qn` 应复用同一套 CLI 分发逻辑，避免两份 parser 定义。
- 第一版不启用 shell completions；后续需要时再评估 `clap_complete`。

## Impacted Areas / 影响范围

- 文件/模块：
  - 新增 Rust core 模块与 CLI bin。
  - 调整 `src-tauri/src/lib.rs`，让 Tauri command 调用共享 store。
  - 可能更新 `src-tauri/Cargo.toml` 增加 bin/依赖。
  - 后续需要补充 README 或 quick-notes 使用说明。
- 接口/类型：
  - Rust 数据类型对外从私有 command 结构升级为模块内共享结构。
  - Tauri command 的入参/返回保持不变。
- 数据/状态：
  - 不新增字段，不做迁移。
  - 继续使用 `quick-notes.json`。
- UI/交互：
  - 桌面 UI 不变。
  - CLI 新增终端交互面。
- 测试：
  - Rust 单元测试覆盖状态流转、validate、短 ID 歧义。
  - 集成/手动测试覆盖 CLI 与桌面端共享数据路径。

## Execution Steps / 执行步骤

1. 用户确认 Option A 或其他方案后，将本方案 `Decision` 更新为已确认。
2. 拆分 Rust `domain.rs` 与 `store.rs`，保持 Tauri command 行为不变。
3. 增加 `q-notes` CLI binary 入口和 `qn` 别名入口。
4. 实现任务命令：add/list/done/restore/deprecate/pin/unpin/delete；delete 必须要求 `--yes`。
5. 实现速记命令：add/list/show/pin/unpin/delete，并支持 `note add --stdin`；delete 必须要求 `--yes`。
6. 实现全局 `--json` 输出契约。
7. 实现 `search` 与 `path`。
8. 补充 Rust 单元测试和最小手动验证记录。
9. 根据实际变更回写 `docs/specs/quick-notes-tauri-json.md`、README 或使用说明。

## Risk And Mitigation / 风险与缓解

- 风险：CLI 与桌面端 app data dir 不一致。
  - 缓解方式：先实现并验证 `quick-notes path`；路径不一致则暂停实现并回写方案。
- 风险：拆分 Rust 模块引入 Tauri command 回归。
  - 缓解方式：Tauri command 入参/返回保持不变；先跑 `pnpm --filter quick-notes check`、`build` 和 Rust 测试。
- 风险：CLI 删除误操作。
  - 缓解方式：删除命令必须传入 `--yes`，否则不修改数据。
- 风险：Node/TS 与 Rust 业务规则分叉。
  - 缓解方式：第一版推荐 Rust 共享 core，不采用 TS CLI。
- 风险：数据文件损坏或旧格式加载失败。
  - 缓解方式：保留现有 validate 与可读错误；不自动迁移未知结构。

## Validation Plan / 验证计划

- 静态/构建：
  - `pnpm --filter quick-notes check`
  - `pnpm --filter quick-notes build`
  - `cargo test`（在 `apps/quick-notes/src-tauri`）
  - `cargo build --bin q-notes`
  - `cargo build --bin qn`
- 手动：
  - 桌面端创建任务，CLI list 可见。
  - CLI 新增任务/速记，桌面端重新加载可见。
  - CLI 完成/恢复/废弃任务后，桌面端状态正确。
  - CLI `path` 输出路径与桌面端数据文件一致。
  - CLI `--json` 输出为稳定 JSON，删除命令缺少 `--yes` 时不修改数据并返回非 0 exit code。
  - 参数错误与找不到 ID 返回非 0 exit code。

## Execute Checkpoint / 执行检查点

- 当前理解：本轮只形成 Quick Notes CLI 技术方案；CLI 第一版应作为桌面端伴生命令行工具，复用同一份本地 JSON 数据契约。
- 核心目标：在进入代码前确定 CLI 命令契约、共享 Rust core 方案、数据路径策略、验证方式和风险边界。
- 下一步动作：
  1. 用户确认是否采用 Option A。
  2. 确认后再进入代码实现。
- 风险：最大风险是 CLI 与桌面端数据路径不一致；实现阶段必须优先验证 `path`。
- Execution Approval: `Pending`
