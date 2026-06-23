# Lifecycle / 生命周期: quick-notes deprecate tasks & data sync

```yaml
status: reviewing
result: pending
created_at: 2026-06-23 10:00
updated_at: 2026-06-23 19:05
owner: user
```

## Current Summary / 当前摘要

- 批准状态：实现偏差已修复；`check` + `build` 通过；待桌面手动验证。
- 当前状态：`reviewing`
- 当前核心目标：恢复任务 UI，并只新增 `deprecated` 状态、DevTools 条件展示、设置内 JSON 导出/导入。
- 下一步唯一动作：桌面手动验证任务废弃/恢复、导出/导入、release DevTools 隐藏。

## Execution Log / 执行记录

- 1. 2026-06-23 10:00: 新建迭代，状态 `draft`。
- 2. 2026-06-23 10:30: 用户确认 Q1–Q5；生成技术方案；状态 `planned`。
- 3. 2026-06-23 11:00–11:10: Q1 澄清（枚举扩展、`deprecated`↔`active`）；回写需求与方案。
- 4. 2026-06-23 11:30: 用户批准执行；实现出现偏差：错误地将任务 UI 删除并改为便签单页；虽 `check`/`build` 通过，但不符合需求。
- 5. 2026-06-23 18:55: 用户指出偏差；已先回写 `requirements.md` 与 `technical-plan.md`：任务功能必须保留，只新增 `deprecated` 状态和对应 UI 流转；下一步修复代码。
- 6. 2026-06-23 19:05: 重新实现并修复偏差：保留任务 Tab 与任务 CRUD/置顶/完成/恢复；新增 `deprecated` 状态、进行中任务“废弃”操作、已废弃任务折叠区、`deprecated -> active` 恢复；保留设置导出/导入与 release DevTools 隐藏；`check`/`build` 通过。

## Validation / 验证

- `pnpm --filter quick-notes check`：0 errors / 0 warnings
- `pnpm --filter quick-notes build`：通过（既有 i18n store / chunk size warning）
- IDE diagnostics：无新增 linter errors
- 手动：待验证任务废弃/恢复、导出/导入、release DevTools 隐藏
