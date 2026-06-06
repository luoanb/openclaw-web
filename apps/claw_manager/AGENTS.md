# AGENTS.md

本项目使用 coding-agent 调度外部开发 agent。

## 工作流

- 使用 `sdd-riper-one-light` 进行常规开发、文档、bugfix、重构
- 使用 `impeccable` 进行前端界面设计与迭代

## Skills

### sdd-riper-one-light
SDD-RIPER 轻量方法论，Spec 驱动研发流程：
- `No Spec, No Code`
- `No Approval, No Execute`
- `Spec is Truth`

### impeccable
前端界面设计与迭代：
- 网站、落地页、Dashboard、产品 UI
- UX 评审、视觉层级、信息架构
- 响应式、主题化、无障碍

## 使用方式

通过 coding-agent 调度 claurst：

```bash
# 常规开发任务
claurst --provider deepseek --model deepseek-v4-flash --dangerously-skip-permissions --print --max-turns 20

# 前端界面任务（可加载 impeccable skill）
claurst -A build ...
```

## 项目规范

1. 先形成最小 spec，再进入代码实现
2. 未收到 `Plan Approved` 前禁止执行
3. 前端改动优先使用 impeccable skill
4. 验证命令：`pnpm build && pnpm start`

## 技术栈

- Svelte 5 + Vite 7 + Tailwind 4 + bits-ui
- HTTPS + Node.js 反向代理
