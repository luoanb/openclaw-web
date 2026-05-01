# 仓库文档（`docs/`）

本目录是**根目录 Markdown 知识库**，与 `apps/` 下的 Next 应用（若存在名为 `docs` 的包）不是同一概念。

## 子目录说明

| 路径 | 用途 |
|------|------|
| [`research/`](./research/) | 调研、可行性、审计、方案草案、阶段规划等；结论可标 Draft，以交叉链接与更新日期为准。 |
| [`specs/`](./specs/) | 任务/功能级最小 Spec（目标、边界、验收、验证方式）；与代码变更强绑定时可落盘于此。 |
| [`micro_specs/`](./micro_specs/) | 小范围改动的 micro-spec，短生命周期。 |
| [`codemap/`](./codemap/) | 跨模块索引（入口、边界、数据流），非源码拷贝；按需维护。 |
| [`context/`](./context/) | SDD `build_context_bundle` 等产出的需求上下文包（按需创建）。 |
| [`archive/`](./archive/) | SDD `archive` 命令产出的 human/llm 归档摘要（按需创建）。 |

## 分流规则

- **探索结论、尚未承诺实现的方案** → `research/`。
- **已批准实施、需要验收契约的任务** → `specs/` 或 `micro_specs/`。
- **面向使用者的对外说明** → 仍以仓库根目录 `README.md` 等为准。
- **Agent 工作流与协议** → [`../AGENTS.md`](../AGENTS.md)、[`../skills/`](../skills/)。

## 命名（与内部 skill 对齐时可选用）

- Spec：`YYYY-MM-DD_hh-mm_<TaskName>.md`
- `TaskName`：简短英文或拼音，单文件一个主任务。

## 当前已有内容

- [`research/`](./research/)：`feasibility-openclaw-webcontainers.md`、`solution-s3-openclaw-browser.md`、`s3-phase-0-plan.md`、`s3-p0-d1-dependency-audit.md` 等。
- [`specs/`](./specs/)：[browser-deps-audit WebContainers 证据驱动阻断 Spec](./specs/s3-browser-deps-audit-webcontainers-evidence-spec.md)（SDD Plan / 与包实现强绑定）；WebContainer OpenClaw 系列含终端预览、Svelte 迁移、VSCode 级终端路线图、**[UI 公共组件抽离（2026-05-01）](./specs/2026-05-01_10-00_WebContainer-OpenClaw-UI公共组件抽离.md)** 等。
