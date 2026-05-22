# SDD Lab Document Structure

## Scope Guard

本文件是 `sdd-lab` skill 的内部 reference，仅在当前任务已激活 `sdd-lab`，且正在创建、查找或维护 `docs/sdd-lab` 迭代文档时生效。其他 skill、普通代码任务、非 `docs/sdd-lab` 文档任务或后续无关上下文中，不得把本文件作为约束、流程或输出格式依据。

## 根目录

`sdd-lab` 的文档根目录固定为：

```text
docs/sdd-lab/
```

每个需求迭代必须使用独立文件夹。需求文档生成阶段只创建 `lifecycle.md` 和 `requirements.md`：

```text
docs/sdd-lab/YYYY-MM-DD_hh-mm_<iteration-name>/
├── lifecycle.md
└── requirements.md
```

进入技术方案生成阶段后，再创建 `technical-plan.md`：

```text
docs/sdd-lab/YYYY-MM-DD_hh-mm_<iteration-name>/
├── lifecycle.md
├── requirements.md
└── technical-plan.md
```

## 命名规则

- 时间前缀：`YYYY-MM-DD_hh-mm_`
- `<iteration-name>` 使用简短英文、拼音或稳定短语。
- 文件夹名称聚焦需求目标，不写长句。
- 同一文件夹只承载一个主要需求迭代。

## 文件职责

- `lifecycle.md`：记录状态、批准、状态流转、执行记录、验证、review、恢复锚点。
- `requirements.md`：记录需求目标、背景、范围、非目标、验收标准、开放问题。
- `technical-plan.md`：记录基于项目现状的技术方案、涉及模块、接口、步骤、风险和验证方式；只在技术方案生成阶段创建。

不要把技术方案写进 `requirements.md`；不要把需求讨论堆进 `technical-plan.md`；不要把聊天流水账写进 `lifecycle.md`。

## 状态字段

`lifecycle.md` 中必须维护：

```yaml
status: draft | planned | executing | reviewing | done
result: pending | completed | cancelled | rejected
updated_at: YYYY-MM-DD hh:mm
```

`result` 只在 `done` 或接近收尾时有意义；正常推进时保持 `pending`。

## 虚拟分组判断

`进行中` 和 `已完结` 是展示时的虚拟分组，不写入文件：

- 进行中：`draft`、`planned`、`executing`
- 已完结：`reviewing`、`done`

默认列表排序：

1. 进行中优先。
2. 同组内按文件夹时间前缀倒序。
3. 时间前缀缺失时，按 `updated_at` 倒序。
4. 仍无法判断时，放在列表末尾并提示文档需要补齐。

## 状态流转

主路径：

```text
draft -> planned -> executing -> reviewing -> done
```

回退路径：

- `planned -> draft`：技术方案阶段发现需求不清、范围变化或验收标准不成立。
- `executing -> planned`：执行阶段发现技术方案不可行或风险显著变化。
- `reviewing -> planned`：review 发现方案偏差、实现风险或验证证据不足。

状态变化必须同步写入 `lifecycle.md` 的 `Transition Log`，至少记录：

- 变更前状态
- 变更后状态
- 变更原因
- 依据或证据
- 下一步动作

## 默认列表示例

当用户没有输入具体任务时，输出类似：

```text
进行中
- 2026-05-20_11-30_canvas-revision-sync | planned | 下一步：确认技术方案后请求执行批准
- 2026-05-18_16-10_auth-error-copy | draft | 下一步：补齐验收标准

已完结
- 2026-05-19_14-20_bulk-import | reviewing | 下一步：完成 review 结论并回写 lifecycle
- 2026-05-10_09-00_runtime-compat | done/completed
```

保持短，不输出完整文档内容。
