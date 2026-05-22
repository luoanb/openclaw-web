# SDD Lab Templates / SDD Lab 模板

本文件只在创建或补齐 `docs/sdd-lab/<iteration>/` 文档时读取。需求文档生成阶段只使用 `lifecycle.md` 和 `requirements.md` 模板；进入技术方案生成阶段后，才使用 `technical-plan.md` 模板。

## `lifecycle.md`

````markdown
# Lifecycle / 生命周期: <Iteration Name>

```yaml
status: draft
result: pending
created_at: YYYY-MM-DD hh:mm
updated_at: YYYY-MM-DD hh:mm
owner: user
```

## Current Summary / 当前摘要

- 当前状态：
- 当前核心目标：
- 当前下一步：
- 当前卡点：
- 下一步唯一动作：
- 下一轮核心目标：

## Approval / 批准状态

- Requirements confirmed: `Pending` / `Approved`
- Technical plan confirmed: `Pending` / `Approved`
- Execution approval: `Pending` / `Approved`
- Approved by:
- Approved at:

## Execution Log / 执行记录

- YYYY-MM-DD hh:mm:
  - 动作：
  - 涉及文件：
  - 状态变化：无 / `<from> -> <to>`（原因：；依据：；下一步：）
  - 偏差：

## Validation / 验证

- Self-check:
- Static checks:
- Runtime / Test:
- Human confirmation:
- 结果汇总：
- 剩余风险：

## Review / 复盘

- Requirements fidelity:
- Technical-plan fidelity:
- Quality:
- Risk:
- 结论：
````

## `requirements.md`

```markdown
# Requirements / 需求文档: <Iteration Name>

## Restated Understanding / 需求复述

- 我理解当前需求是：
- 当前核心目标是：
- 当前边界是：
- 暂不处理：

## Scope / 范围

- In:
- Out:

## User Interaction / 用户交互

- 触发入口：
- 用户操作路径：
- 系统反馈：
- 状态变化：
- 异常/边界交互：
- 不应发生的交互：

## Acceptance Criteria / 验收标准

- [ ] 验收标准 1：

## Constraints / 约束

- 业务约束：
- 技术约束：
- 时间/兼容性约束：

## Open Questions / 开放问题

- [ ] 待确认问题 1：

## Requirement Decisions / 需求决策

- YYYY-MM-DD hh:mm:
  - 决策：
  - 原因：
```

## `technical-plan.md`

```markdown
# Technical Plan / 技术方案: <Iteration Name>

## Requirement Baseline / 需求基线

- 对应需求文档：
- 需求确认状态：
- 本方案覆盖范围：

## Current Project Facts / 当前项目事实

- 已读取文件/模块：
- 当前实现事实：
- 相关接口/数据结构：
- 约束与风险：

## Proposed Solution / 拟定方案

- 方案摘要：
- 为什么选择该方案：
- 不采用的方案：

## Page Design / 页面设计

- 页面入口/路由：
- 布局结构：
- 核心组件：
- 交互状态：
- 视觉约束：
- 响应式/可访问性：

## Impacted Areas / 影响范围

- 文件/模块：
- 接口/类型：
- 数据/状态：
- UI/交互：
- 测试：

## Execution Steps / 执行步骤

1. 步骤 1：
2. 步骤 2：
3. 步骤 3：

## Risk And Mitigation / 风险与缓解

- 风险：
  - 缓解方式：

## Validation Plan / 验证计划

- 静态检查：
- 单元/集成测试：
- 手动验证：
- 验收证据：

## Execute Checkpoint / 执行检查点

- 当前理解：
- 核心目标：
- 下一步动作：
- 风险：
- 验证方式：
- Execution Approval: `Pending` / `Approved`
```

## 使用要求

- 新建迭代处于需求文档生成阶段时，只创建 `requirements.md` 和必要的 `lifecycle.md`。
- 需求阶段只能完善 `requirements.md` 和 `lifecycle.md`，不要创建 `technical-plan.md` 占位文件。
- 技术方案阶段必须先读取项目现状，再创建或更新 `technical-plan.md`。
- 执行阶段发现偏差时，先更新对应文档，再继续实现。
- Review 阶段以 `requirements.md` 和 `technical-plan.md` 为基准，不以聊天记忆为基准。
