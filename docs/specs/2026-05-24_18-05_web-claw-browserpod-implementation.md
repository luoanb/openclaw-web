# web-claw browserpod 实现文档 — 已废弃

| 属性 | 内容 |
|------|------|
| 状态 | Deprecated |
| 废弃时间 | 2026-05-25 |
| 替代真相源 | [`docs/sdd-lab/2026-05-24_21-16_container-runtime-management`](../sdd-lab/2026-05-24_21-16_container-runtime-management/technical-plan.md) |

## 废弃说明

本文是早期 BrowserPod 运行与终端 MVP 实现草案，已被容器 runtime 管理 SDD 迭代取代，不再维护。

后续实现不得以本文的旧 boot 映射、终端映射、进程映射或停止语义为准。BrowserPod adapter 的执行边界以当前 SDD 迭代的 `requirements.md`、`technical-plan.md` 与 `references/exec-scheme-bridge.md` 为真相源。
# web-claw browserpod 实现文档 — 运行与终端 MVP

| 属性 | 内容 |
|------|------|
| 状态 | 草稿 |
| 产品来源 | [`docs/prd/prd-web-claw-light.md`](../prd/prd-web-claw-light.md) |
| 契约来源 | [`2026-05-24_18-00_web-claw-core-contract.md`](./2026-05-24_18-00_web-claw-core-contract.md) |
| 包边界 | `packages/browserpod` |
| 参考实现 | [`demos/browserpod-demo/src/main.js`](../../demos/browserpod-demo/src/main.js)、[`demos/browserpod-demo/src/persistVerify.js`](../../demos/browserpod-demo/src/persistVerify.js) |

## 1. 目标

定义 `packages/browserpod` 如何实现 `packages/os-core` 的运行与终端 MVP 契约。本文只描述 BrowserPod 映射、降级策略、错误转换和部署约束，不定义 app UI，不新增 package。

## 2. 边界

**包含**：

- `BrowserPod.boot({ apiKey, storageKey })` 到 `IRuntime.boot()` 的映射。
- `createDefaultTerminal` 到 `TerminalSession` 的第一阶段实现策略。
- `pod.run(command, args, options)` 到 `RuntimeSession.run()` 的映射。
- 中止、停止、错误、能力声明的实现口径。
- COOP/COEP、API Key、`storageKey` 部署约束。

**不包含**：

- 文件管理实现。
- Portal 服务预览多 tab 实现。
- workspace 快照导入导出。
- WebContainer 兼容。

## 3. 包结构建议

```text
packages/browserpod/
  src/
    runtime/
      browserpodRuntime.impl.ts
      browserpodRuntime.interfaces.ts
    terminal/
      browserpodTerminal.impl.ts
    process/
      browserpodProcess.impl.ts
    errors/
      browserpodErrorMapper.impl.ts
    index.ts
```

`packages/browserpod` 可以引用 `@leaningtech/browserpod` 和 `packages/os-core`；`apps/web-claw` 不直接引用 `@leaningtech/browserpod`。

## 4. Boot 映射

### 4.1 输入

| os-core 字段 | BrowserPod 映射 | 说明 |
|-----------|------------------|------|
| `RuntimeBootOptions.env` | 读取 `VITE_BP_APIKEY` 或上层注入值 | API Key 不应在 UI 明文展示。 |
| `RuntimeBootOptions.storageKey` | `BrowserPod.boot({ storageKey })` | 第一阶段用于稳定本地盘；workspace 产品语义后续再定。 |

### 4.2 行为

| 步骤 | 行为 |
|------|------|
| 前置检查 | 检查 `globalThis.crossOriginIsolated`；不满足则抛 `isolation-unavailable`。 |
| API Key 检查 | 缺少 key 则抛 `auth-missing`。 |
| boot | 调用 `BrowserPod.boot({ apiKey, storageKey })`。 |
| 成功 | `RuntimeStatus` 从 `booting` 进入 `running`，返回 `RuntimeSession`。 |
| 失败 | 进入 `failed`，通过 `RuntimeError` 映射错误。 |

### 4.3 状态映射

| os-core 状态 | BrowserPod 状态来源 |
|-----------|----------------------|
| `idle` | 尚未调用 boot。 |
| `booting` | 正在等待 `BrowserPod.boot`。 |
| `running` | boot resolve 且本地持有 pod 实例。 |
| `stopping` | 正在执行停止策略。 |
| `stopped` | 已清理本包引用或产品态已停止。 |
| `failed` | boot 或运行阶段出现不可忽略错误。 |

## 5. Terminal 映射

### 5.1 第一阶段策略

BrowserPod demo 已验证 `pod.createDefaultTerminal(domElement)` 可创建默认终端，并可被 `pod.run(..., { terminal })` 输出使用。`os-core` 契约中的 `TerminalSession` 需要 app 能管理多个终端，因此 `packages/browserpod` 必须隐藏 DOM/SDK 细节，并提供终端会话对象。

### 5.2 终端创建

| os-core 行为 | BrowserPod 映射 |
|-----------|------------------|
| `createTerminal(options)` | 基于 BrowserPod 默认终端能力创建终端绑定。 |
| `TerminalSession.id` | 由 `packages/browserpod` 生成稳定 id。 |
| `TerminalSession.name` | 使用 `options.name`，否则生成「终端 N」。 |
| `TerminalSession.status` | 创建中为 `creating`，成功后为 `ready`。 |

### 5.3 交互能力待验证

当前 demo 只证明了 `createDefaultTerminal` 与 `pod.run` 输出绑定，未证明完整长驻交互 shell。因此第一阶段能力声明必须保守：

| capability | 默认值 | 说明 |
|------------|--------|------|
| `interactiveTerminal` | 不直接声明为 true | demo 已验证默认 terminal 可向运行中 `read` 送入 stdin，且 `sh -i` 有交互证据；但 `bash -i` 未形成长驻交互，custom terminal 未验证完整 stdin 接管，第一阶段仍应保守降级。 |
| `multipleTerminals` | 已验证可用 | `multiple-terminals` case 验证同一 `BrowserPod` 实例可创建两个默认终端，并分别绑定 `pod.run` 输出。 |
| `abortProcess` | 待实现验证后决定 | 需要确认 BrowserPod 进程中止 API 或可替代策略。 |
| `stopRuntime` | 待实现验证后决定 | 需要确认 BrowserPod 是否有 dispose/stop。 |

若某能力未验证，`packages/browserpod` 不得在 `capabilities` 中声明为 true。

## 6. Process 映射

### 6.1 `run` 映射

| os-core 字段 | BrowserPod 映射 |
|-----------|------------------|
| `command` | `pod.run(command, args, options)` 第一个参数。 |
| `args` | `pod.run` 第二个参数。 |
| `cwd` | `pod.run` options.cwd。 |
| `echo` | `pod.run` options.echo。 |
| `terminalId` | 查找对应 BrowserPod terminal，并传给 `options.terminal`。 |

### 6.2 Shell 组合命令

BrowserPod 报告与 demo 均显示 `pod.run` 不是 shell。若产品需要 `&&`、管道或重定向，`packages/browserpod` 应显式转换为：

```text
pod.run("sh", ["-c", script], { terminal, cwd })
```

该转换只能由实现层做；app 不应拼接 BrowserPod 专属调用。

### 6.3 前台任务状态

- `run({ mode: "foreground" })` 应将目标终端状态置为 `busy`。
- 命令完成后，终端状态恢复为 `ready` 或进入 `failed`。
- `ProcessResult.exitCode` 需从 BrowserPod 可获得的结果中提取；若 SDK 不提供，先记为 `null` 并在待定中说明。

## 7. 中止与停止

### 7.1 中止

第一阶段实现前必须验证 BrowserPod 是否有进程句柄、kill、signal 或等价 API。

| 情况 | 行为 |
|------|------|
| 可中止 | `abort()` 返回 `{ ok: true }`，并发出终端状态事件。 |
| 不支持 | `abort()` 返回 `{ ok: false, reason }`，并抛或发出 `process-abort-failed` / `capability-unsupported`。 |
| 目标不存在 | 返回失败并提示目标终端/进程已结束。 |

### 7.2 停止

若 BrowserPod SDK 没有明确 stop/dispose：

- `stop()` 只能表达产品态停止：清理 `packages/browserpod` 内部引用、禁止继续创建终端/运行命令。
- `capabilities.stopRuntime` 必须为 `false` 或通过文案说明“停止不等于销毁底层实例”。
- app 不得向用户承诺已释放所有底层资源。

## 8. 错误映射

| BrowserPod/环境错误 | os-core `RuntimeErrorCode` |
|---------------------|--------------------------|
| `crossOriginIsolated === false` | `isolation-unavailable` |
| API Key 缺失 | `auth-missing` |
| API Key 被拒或认证失败 | `auth-invalid` |
| `BrowserPod.boot` reject | `boot-failed` |
| 默认终端创建失败 | `terminal-create-failed` |
| 写入/输出失败 | `terminal-write-failed` |
| `pod.run` reject | `process-run-failed` |
| 中止失败 | `process-abort-failed` |
| SDK 不支持某能力 | `capability-unsupported` |

错误对象需保留 `cause`，但 app 默认只展示可读 `message`。

## 9. 部署约束

| 约束 | 要求 |
|------|------|
| COOP/COEP | dev 与生产均需满足 `Cross-Origin-Opener-Policy: same-origin` 与 `Cross-Origin-Embedder-Policy: require-corp`。 |
| API Key | 使用 `VITE_BP_APIKEY` 或上层配置注入；不得提交 `.env`。 |
| HTTPS | 生产环境应使用 HTTPS。 |
| 浏览器 | 第一阶段以 Chromium 系为主要验收目标。 |
| storageKey | 第一阶段可由 app 注入默认值；用户可见 workspace 语义后续再由 PRD 定义。 |

## 10. Done Contract

- `packages/browserpod` 的实现文档可逐项追溯到 `os-core` 契约。
- `apps/web-claw` 不需要直接认识 `BrowserPod`、`pod`、`terminal` SDK 类型。
- 未验证能力必须通过 `capabilities` 降级，不通过 UI 或文案过度承诺。
- 实现阶段最小验证应覆盖：缺 API Key、缺隔离环境、boot 成功、创建终端、运行命令、命令失败、中止不支持或成功分支。

## 11. Demo 验证台

`demos/browserpod-demo` 应作为 BrowserPod 能力验证台维护，而不是只保留单条 happy path 示例。新增 SDK 能力判断前，应优先沉淀为独立 case：

- 每个 case 独立声明验证目标、操作步骤、结果展示和人工判定口径。
- case 可共享同一个 `BrowserPod` 实例，但不得共享会互相污染结论的 DOM 或终端对象。
- 涉及终端输出的 case 必须保持 terminal DOM 挂载；可以隐藏，不得在命令运行中卸载。
- 验证结论只有在 case 实测通过后，才能反写到本文的能力声明。

第一批 case：

| case | 目的 |
|------|------|
| `persist-storage` | 验证固定 `storageKey` 下终端写入文件可刷新后复用。 |
| `multiple-terminals` | 验证同一 `BrowserPod` 实例能否创建两个默认终端，并分别绑定 `pod.run` 输出。 |
| `express-portal` | 保留官方 Express/Portal 示例，验证 `npm install`、服务运行和 Portal iframe。 |
| `interactive-terminal` | 验证运行中 stdin、`sh`/`bash` 长驻交互 shell、`createCustomTerminal` 输出与输入接管边界。 |

## 12. 待定

| 项 | 说明 |
|----|------|
| 长驻交互 shell | 已通过 `interactive-terminal` case 初测：默认 terminal 支持运行中 stdin；`sh -i` 在超时保护下可交互；`bash -i` 本次未保持长驻。尚不足以把 `interactiveTerminal` 作为完整能力声明。 |
| 多默认终端 | 已通过 `demos/browserpod-demo` 的 `multiple-terminals` case 验证：同一 `BrowserPod` 实例可创建两个默认终端，并分别承载不同 `pod.run` 输出。 |
| 进程中止 API | 需核对 SDK 是否提供 kill/signal/handle。 |
| `pod.run` 返回值 | 需确认是否可稳定取得 exit code。 |
| `createCustomTerminal` I/O | `onOutput` 已验证可接收输出；custom terminal 暴露 `write`，但 guarded write 未能喂给运行中 `read`，不能按完整输入输出接管设计。 |
| stop/dispose | 需确认 BrowserPod 是否提供底层资源释放接口。 |

## 13. 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-05-24 | 初稿；将 BrowserPod demo 中已验证的 boot、terminal、run、storageKey 能力映射到 `os-core` 契约，并标注待验证能力。 |
| 2026-05-24 | 增补 demo 验证台约定；将多默认终端验证收敛到独立 `multiple-terminals` case。 |
| 2026-05-24 | 通过浏览器实测确认同一 Pod 支持两个默认终端分别绑定 `pod.run` 输出；`multipleTerminals` 能力改为已验证。 |
| 2026-05-24 | 新增 `interactive-terminal` demo case：确认默认 terminal stdin 与 `sh -i` 部分交互能力，确认 `bash -i` 与 custom terminal stdin 不足以声明完整交互终端。 |
