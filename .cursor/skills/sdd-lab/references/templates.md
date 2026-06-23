# SDD Lab Templates / SDD Lab 模板

本文件只在创建或补齐 `docs/sdd-lab/<iteration>/` 文档时读取。需求文档生成阶段只使用 `lifecycle.md` 和 `requirements.md` 模板；需求确认后，若涉及 Figma、视觉稿、页面还原、Icon 导出或设计稿文档化，先使用 `visual-design.md` 模板；完成必要的视觉设计文档后，才进入技术方案生成阶段并使用 `technical-plan.md` 模板。

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

- 批准状态：
- 当前状态：
- 当前核心目标：
- 下一步唯一动作：

## Execution Log / 执行记录

- 1. YYYY-MM-DD hh:mm: 简述本次动作、状态变化或偏差。
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

- [ ] Q1 待确认问题：

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

## Open Questions / 开放问题

- [ ] Q1 需要向用户确认的问题：
  - 触发来源：需求 / 当前代码现状 / 方案拟定
  - 无法确定的内容：
  - 影响范围：
  - 候选处理：
  - 用户回答/确认：
  - 状态：待用户确认 / 已关闭

## Solution Options / 方案候选

### Option A / 方案 A

- 推荐：是/否
- 方案摘要：
- 涉及模块：
- 优点：
- 缺点：
- 风险：

### Option B / 方案 B

- 推荐：是/否
- 方案摘要：
- 涉及模块：
- 优点：
- 缺点：
- 风险：

...

## Decision / 方案决策

- Selected / 选定方案：
- Why / 选择原因：
- Decision Owner / 决策人：（等待用户决策）
- Decision Time / 决策时间：
- Open Questions 状态：全部关闭 / 仍有待确认项（说明：）

## Component Design / 组件设计

- 对应视觉设计文档：
- 组件拆分：
- 复用现有组件：
- 新增 / 调整组件：
- Props / Events / Slots：
- 状态与交互：
- 样式与 Token 实现：
- Icon / SVG 组件使用：
- 已知设计偏差：

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

## Execute Checkpoint / 执行检查点

- 当前理解：
- 核心目标：
- 下一步动作：
- 风险：
```

## `visual-design.md`

```markdown
# Visual Design / 视觉设计文档: <Iteration Name>

## Source / 来源

- Figma 链接：
- 文件 / 页面：
- Frame / Node：
- 版本 / 更新时间：

## Page Design / 页面设计

## Icon / SVG Component Export / Icon 与 SVG 组件导出

- 导出目标路径：
- 命名规则：
- 颜色策略：固定色 / currentColor / 主题变量
- 尺寸策略：
- 可访问性属性：

| Icon | Figma Node | SVG 文件名 | 组件名 | 尺寸 | 颜色策略 | 状态   |
| ---- | ---------- | ---------- | ------ | ---- | -------- | ------ |
|      |            |            |        |      |          | 待导出 |
```

## 使用要求

- 新建迭代处于需求文档生成阶段时，只创建 `requirements.md` 和必要的 `lifecycle.md`。
- 需求阶段只能完善 `requirements.md` 和 `lifecycle.md`，不要创建 `technical-plan.md` 占位文件。
- 只有需求涉及 Figma、视觉稿、页面还原、Icon 导出或设计稿文档化时，才创建 `visual-design.md`；视觉设计文档生成前置于技术方案生成，不要创建空占位文件。
- `visual-design.md` 只记录设计事实和导出要求，不记录代码落点、状态管理、接口变更等技术方案。
- `Source / 来源` 只记录核心追溯信息；`Page Design / 页面设计` 内部结构由视觉稿内容决定，不强制套固定字段。
- 视觉稿疑问就近记录在相关章节；影响需求或技术决策的问题同步到 `requirements.md` 或 `technical-plan.md`。
- 设计稿包括 Icon 时，必须在 `Icon / SVG Component Export` 中记录需要导出的 SVG 组件清单、命名、颜色策略、目标路径和状态。
- 技术方案阶段必须先读取项目现状，再创建或更新 `technical-plan.md`。
- 若需求涉及视觉稿，技术方案生成前必须先完成必要的 `visual-design.md`；若存在 `visual-design.md`，技术方案必须引用它作为页面设计和 Icon 导出的设计基线。
- `technical-plan.md` 中使用 `Component Design / 组件设计` 承接视觉稿，记录组件拆分和实现映射，不重复抄写 `visual-design.md` 的页面设计事实。
- 技术拟定阶段支持多方案并行记录；小改动可以只保留一个方案，但需要写明跳过多方案对比的原因。
- `technical-plan.md` 的 `Open Questions` 只记录 Agent 在读取需求、设计文档和项目现状后仍无法确定、必须向用户提问确认的内容；不要记录已经明确的问题、事实或结论。
- `Open Questions` 必须使用稳定序号，例如 `Q1`、`Q2`，问题表述要能直接发给用户回答，便于后续引用、回答、关闭和回写。
- `Open Questions` 不只来自需求阶段；整理代码现状、拟定方案、做技术决策时出现无法自行判断的内容，也必须先提问并交由用户回答或确认后关闭。
- 方案决策必须由用户完成；Agent 可以整理事实、列出候选方案、给出推荐和依据，但不能替用户拍板。
- 方案确认前，`Decision / 方案决策` 必须说明用户选定方案、选择原因，以及 `Open Questions` 是否关闭或仍需用户确认。
- 执行阶段发现偏差时，先更新对应文档，再继续实现。
