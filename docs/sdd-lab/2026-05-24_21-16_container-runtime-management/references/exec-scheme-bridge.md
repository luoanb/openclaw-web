# Exec Scheme Bridge / 执行方案桥接

## 1. 仓库能力

- 当前已有 `packages/web-os`，其 `package.json` 明确标记为 WebContainer 探索废案，不作为新 runtime 契约承载包。
- workspace 已包含 `packages/*`，因此本轮可新增 `packages/os-core` 与 `packages/browserpod`，并沿用 `packages/web-os` 的 package、tsconfig、vitest 组织方式。
- 旧 specs 已存在：
  - `docs/specs/2026-05-24_18-00_web-claw-core-contract.md`
  - `docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md`
- BrowserPod 能力证据主要来自 `demos/browserpod-demo`：
  - `src/main.js` 已使用 `BrowserPod.boot({ apiKey, storageKey })` 与 `pod.onPortal(...)`。
  - `src/cases/multipleTerminals.case.js` 已验证同一个 pod 可创建两个默认终端并分别绑定 `pod.run` 输出。
  - `src/cases/interactiveTerminal.case.js` 已记录默认 terminal 的部分 stdin 能力与 custom terminal 边界。
  - `src/cases/customTerminal.case.js` 探测报告见 [`custom-terminal-probe-report.md`](./custom-terminal-probe-report.md)；运行时类型见 [`browserpod-sdk-runtime.types.md`](./browserpod-sdk-runtime.types.md)（`write` 在 `createCustomTerminal` 返回的 terminal 实例上）。

## 2. 库 API

- `@leaningtech/browserpod`：
  - 本仓库 lockfile 版本：`2.8.0`。
  - 当前已验证导出：`BrowserPod`。
  - 当前已验证调用：
    - `BrowserPod.boot({ apiKey, storageKey })`
    - `pod.run(command, args, { echo: true, terminal, cwd })`
    - `pod.onPortal(listener)`
    - `await pod.createDefaultTerminal(domElement)`
    - `pod.createCustomTerminal(options)`：`onOutput` 输出接管已验证；程序化 stdin（`write`）不可用，见 [`custom-terminal-probe-report.md`](./custom-terminal-probe-report.md)。不声明为稳定完整 stdin 能力。
  - 当前 web-claw 终端 adapter 的命令运行应继承 demo 证据：
    - shell 组合命令使用 `pod.run("sh", ["-c", script], { echo: true, terminal, cwd })`。
    - `terminal` 必须是 `createDefaultTerminal` resolve 后的 terminal handle，不能把未 await 的 Promise 传入 `pod.run`。
    - 默认工作目录使用 BrowserPod demo 已验证的 `/home/user`，避免把 `/` 当作可交互用户目录。
  - 当前未在官方 reference 与本仓库证据中确认：
    - `stop` / `dispose`
    - 进程 `kill` / `signal` / 可中止句柄
    - 稳定 exit code 返回结构

## 3. 设计契约

- 继承 `technical-plan.md` 的核心设计：先定义 `os-core` 的 runtime manager/session/capability/error/event 契约，再由 BrowserPod adapter 实现。
- 本轮执行收窄：
  - `packages/os-core` 第一批只落地 runtime 管理契约、最小状态/事件工具与单测。
  - `packages/browserpod` 第一批只落地 runtime adapter 的 check/boot/stop/session/snapshot/event 边界；终端、文件、预览仍由后续迭代接入 `RuntimeSession`。
  - BrowserPod adapter 内部可保留 pod 的 opaque ref，但 app 与 `os-core` 不暴露 SDK 类型。
- 相对旧 specs 的改写：
  - 旧 `IRuntime` 升级为 `RuntimeManager`。
  - 旧 `RuntimeBootOptions.storageKey/env` 移出通用契约，改由 BrowserPod adapter config 处理。
  - 旧 `RuntimeSession.createTerminal/run/abort` 移出 runtime session，避免容器层反向拥有上层能力。
  - 旧 `stopRuntime` boolean 升级为 `shutdown: "supported" | "unsupported" | "unknown"`。
- Done Contract：
  - specs 与代码均不让 app 直接依赖 `@leaningtech/browserpod`。
  - `os-core` 不引用 BrowserPod。
  - BrowserPod 未确认能力保持 `unknown` 或 `unsupported`，不在 UI 或契约中过度承诺。
