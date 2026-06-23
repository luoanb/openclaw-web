# Technical Plan / 技术方案: quick-notes deprecate tasks & data sync

## Requirement Baseline / 需求基线

- 对应需求文档：`requirements.md`（含 2026-06-23 Q1 澄清）
- 需求确认状态：`Approved`（Q1 语义已纠正，待用户确认后执行）
- 本方案覆盖范围：`TaskStatus` 扩展、任务 UI 新增已废弃状态、DevTools 条件展示、设置弹窗导出/导入

## Current Project Facts / 当前项目事实

- `QuickNotesStore { tasks, notes }` ↔ Tauri `quick-notes.json`。
- `TaskStatus` 现为 `"active" | "done"`；`TaskService` 含 `completeTask` / `restoreTask` 等。
- 任务 UI 在 `features/tasks/*`；`App.svelte` 默认 tasks Tab。

## Open Questions / 开放问题

（无；Q1 已由用户澄清关闭。）

## Decision / 方案决策

- 导出/导入：**Option A**（Blob 下载 + `<input type="file">`），理由不变。
- Q1 数据策略：**仅扩展枚举 + 状态机**；**删除**原「加载批量迁移」设计。

## Component Design / 组件设计

### `TaskStatus` 与状态机

```text
active ──complete──> done
  │
  └──deprecate──> deprecated

done ──restore──> active        （既有）
deprecated ──restore──> active  （新增，与 done 恢复语义一致）
```

- `deprecateTask(tasks, taskId, now)`：仅 `active` → `deprecated`，清 `pinnedAt`，更新 `updatedAt`。
- `restoreTask(tasks, taskId, now)`：扩展为 `done` **或** `deprecated` → `active`；清 `completedAt`（若存在），更新 `updatedAt`。
- **不**在 `normalizeStore` 中改写 `active`/`done`。

### `QuickNotesStoreService.normalizeTask`

- 校验 `status` ∈ `{ active, done, deprecated }`；非法值抛错或归一化失败（导入时提示）。
- 保留既有 `completedAt` / `pinnedAt` 字段归一化；**不改写** status。

### Rust `lib.rs`

- `enum TaskStatus { Active, Done, Deprecated }`
- `validate_store`：
  - `active` 且含 `completedAt` → 错误（既有规则）
  - `done` / `deprecated`：允许有或没有 `completedAt`（`deprecated` 不要求 `completedAt`）

### `QuickNotesDataSyncService`

- 导出：完整 store JSON 下载。
- 导入：`parseImportFile` → `mergeStore`（覆盖/追加 + 冲突策略）；合并时 **保留各 task 的 status**，不批量改 `deprecated`。
- `TaskService`：新增 `deprecateTask`、`getDeprecatedTasks`；`restoreTask` 支持 `done` / `deprecated` → `active`。

### UI

| 组件 | 变更 |
|------|------|
| `App.svelte` | 保留任务/便签 Tab；恢复任务 handlers；新增 `deprecateTask` handler；**无**加载迁移 `persist` |
| `HeaderMenu.svelte` | `import.meta.env.DEV` 控制 DevTools |
| `SettingsModal.svelte` | 数据导出/导入区块 |
| `features/tasks/*` | 保留任务组件；新增已废弃任务区块和废弃操作 |

## Impacted Areas / 影响范围

- 扩展：`quick-notes-types.ts`、`task-service.ts`、`quick-notes-store.ts`、`lib.rs`、新建 `quick-notes-data-sync.ts`、设置相关 UI/i18n。
- 保留：任务 Svelte 组件、`QuickNotesTab` 类型、`App.svelte` 中任务相关代码。
- **不**做：启动时任务 status 批量迁移。

## Execution Steps / 执行步骤

1. 扩展 `TaskStatus`（TS + Rust）+ `deprecateTask` + 校验调整。
2. `normalizeTask` 接受三态，**不**改写 legacy status。
3. 实现 `QuickNotesDataSyncService`。
4. 恢复/保留 `App.svelte` 任务 Tab 与任务 handlers；扩展 `SettingsModal`；条件隐藏 DevTools。
5. 恢复/保留 `features/tasks/*`，新增 deprecated 展示和操作；补齐 i18n。
6. `pnpm --filter quick-notes check` + `build`。

## Risk And Mitigation / 风险与缓解

- 实现偏差风险：不得删除任务功能；任务 UI 必须保留，并新增已废弃状态入口。
- 旧 JSON 仅含 `active`/`done`：正常加载，无需迁移。

## Validation Plan / 验证计划

- 静态：check + build。
- 手动：旧 JSON 加载后 status 不变；导出含 mixed status；导入覆盖/追加；release 无 DevTools。

## Execute Checkpoint / 执行检查点

- 当前理解：任务功能保留；数据层 **三态枚举**；UI 新增 `deprecated` 操作与展示；**不**批量迁移。
- Execution Approval: `Pending`
