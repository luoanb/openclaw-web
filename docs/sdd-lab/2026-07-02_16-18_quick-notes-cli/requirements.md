# Requirements / 需求文档: quick-notes CLI

## Restated Understanding / 需求复述

- 我理解当前需求是：为 `apps/quick-notes` 增加一个命令行入口，让用户可以在终端快速新增、查看、搜索和流转任务/速记。
- 当前核心目标是：把桌面端已有的本地 `quick-notes.json` 数据能力扩展到 CLI，确保 CLI 与桌面端读写同一份数据、遵循同一份数据契约。
- 当前边界是：先完成 CLI 的技术方案与最小命令集设计，不进入代码实现。
- 暂不处理：云同步、账号、多设备冲突、提醒通知、复杂标签、富文本终端编辑器、跨应用全局快捷键。

## Scope / 范围

- In:
  - 任务：新增、列表、完成、恢复、废弃、删除、置顶/取消置顶、搜索。
  - 速记：新增、stdin 新增、列表、查看、删除、置顶/取消置顶、搜索。
  - CLI 与桌面端共享同一份本地 JSON 存储契约。
  - 命令输出默认面向人类可读，并在第一版提供 `--json` 机器可读输出。
- Out:
  - 不重做桌面 UI。
  - 不改变现有 `QuickNotesStore` 数据模型，除非后续方案明确需要迁移。
  - 不引入远端服务或数据库。
  - 不把 Markdown 编辑器能力搬到终端第一版。

## User Interaction / 用户交互

- 触发入口：终端命令，例如 `q-notes task add "买牛奶"` 或 `qn task list`。
- 用户操作路径：
  - 输入命令和参数。
  - CLI 读取当前应用数据目录下的 `quick-notes.json`。
  - CLI 应用业务变更并写回同一份 JSON。
  - CLI 输出操作结果、简短 ID、错误提示或列表。
- 系统反馈：
  - 成功：输出新增/更新对象的短摘要。
  - 空结果：输出“暂无任务/暂无速记”一类可读提示。
  - 参数错误：输出用法提示并返回非 0 exit code。
  - 读写失败：输出可读错误并返回非 0 exit code。
- 状态变化：
  - 任务状态仍沿用 `active`、`done`、`deprecated`。
  - 完成任务写入 `completedAt`，恢复任务清空 `completedAt`。
  - 废弃任务取消置顶。
  - 置顶写入 `pinnedAt`，取消置顶清空 `pinnedAt`。
- 异常/边界交互：
  - 空内容不得创建任务或速记。
  - 找不到 ID 时返回错误，不静默成功。
  - 删除任务或速记必须显式传入 `--yes`。
  - 数据文件不存在时按空 store 初始化。
- 不应发生的交互：
  - CLI 不应写入与桌面端不兼容的 JSON。
  - CLI 不应绕过数据校验直接覆盖损坏数据。
  - CLI 不应在用户未指定删除动作时删除数据。

## Acceptance Criteria / 验收标准

- [ ] CLI 可以创建任务和速记，桌面端重新加载后可见。
- [ ] CLI 可以读取桌面端已有任务和速记，并按状态/更新时间输出稳定列表。
- [ ] CLI 的任务状态流转与桌面端现有 `TaskService` 语义一致。
- [ ] CLI 与 Tauri 后端共享或等价复用 `quick-notes.json` 的读写、校验和原子写入策略。
- [ ] CLI 支持 `--json` 输出，并保证成功与错误输出结构稳定。
- [ ] 删除任务/速记时必须传入 `--yes`，否则返回用法提示或保护性错误。
- [ ] CLI 参数错误、找不到 ID、读写失败时返回非 0 exit code，并给出可读错误。
- [ ] `pnpm --filter quick-notes check`、`pnpm --filter quick-notes build` 与 Rust 相关验证在本机可运行时通过；若环境缺依赖，需要记录失败原因。

## Constraints / 约束

- 业务约束：
  - `Spec is Truth`：数据契约以 `docs/specs/quick-notes-tauri-json.md` 和本迭代文档为准。
  - CLI 第一版服务“快速捕获”和“轻量管理”，不追求完整桌面体验。
- 技术约束：
  - 当前应用为 Tauri v2 + Svelte 5；本地数据由 Rust 侧读写应用数据目录下 `quick-notes.json`。
  - `core` / `utils` 可复用逻辑优先类封装，保持业务逻辑边界清晰。
  - Windows 是当前主要验证环境。
- 时间/兼容性约束：
  - 第一版优先保持对现有 JSON 的向后兼容。
  - 不做 schema migration，除非后续实现发现不可避免。

## Open Questions / 开放问题

- [x] Q1 CLI 可执行文件名称是否固定为 `qn`，还是保留 `quick-notes` 为主命令、`qn` 作为后续别名？
  - 用户确认：使用 `q-notes` / `qn`。
  - 状态：已关闭。
- [x] Q2 第一版是否需要 `--json` 机器可读输出，还是只做可读文本输出？
  - 用户确认：`--json` 需要。
  - 状态：已关闭。
- [x] Q3 删除任务/速记是否需要 `--yes` 确认参数，还是第一版直接执行删除命令？
  - 用户确认：`--yes` 需要。
  - 状态：已关闭。

## Requirement Decisions / 需求决策

- 2026-07-02 16:18:
  - 决策：先落地技术方案，不进入代码实现。
  - 原因：遵循 `No Spec, No Code` 与 `No Approval, No Execute`。
- 2026-07-02 16:23:
  - 决策：CLI 入口使用 `q-notes` / `qn`；第一版支持 `--json`；删除任务/速记必须传入 `--yes`。
  - 原因：用户已明确回答 Q1、Q2、Q3。
