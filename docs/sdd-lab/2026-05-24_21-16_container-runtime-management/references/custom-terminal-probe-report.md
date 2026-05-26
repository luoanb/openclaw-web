# BrowserPod `createCustomTerminal` 探测报告

| 字段 | 内容 |
|------|------|
| 状态 | 已完成（结论稳定，可评审） |
| SDK | `@leaningtech/browserpod@2.8.0` |
| 用例 | `demos/browserpod-demo` → `custom-terminal`（`src/cases/customTerminal.case.js`） |
| 对照 | `interactive-terminal`（`src/cases/interactiveTerminal.case.js`） |
| 关联规格 | `docs/specs/2026-05-24_18-05_web-claw-browserpod-implementation.md` |

## 1. 目的

验证 `pod.createCustomTerminal({ onOutput, cols, rows })` 能否在 web-claw 中作为**完整终端替代**（输出 + 程序化 stdin），还是仅适合**输出接管**。

| 能力 | 探测问题 |
|------|----------|
| API | `createCustomTerminal` 是否存在？handle 上有哪些成员？ |
| 输出 | `onOutput` 能否收到绑定该 terminal 的 `pod.run` 的 stdout/stderr？ |
| 输入 | `handle.write` 能否写入**前台进程 stdin**（而非仅 PTY 回显）？ |

## 2. 方法

### 2.1 步骤 1 — API 与 handle

- 记录 `typeof pod.createCustomTerminal` 与 `pod` / handle 的 key 列表。
- 不启动子进程。

### 2.2 步骤 2 — 输出流（`onOutput`）

```text
pod.run('sh', ['-c', 'printf "custom-stdout\n"; printf "custom-stderr\n" 1>&2'],
        { echo: true, terminal: customTerminal, cwd: '/home/user' })
```

- 判定：`onOutput` 拼接流是否同时含 `custom-stdout`、`custom-stderr`。
- 实现：`onOutput` chunk 若基于 SharedArrayBuffer，须先拷贝再 `TextDecoder.decode`（否则浏览器抛错）。
- 勿用 `node -e`：BrowserPod Node 运行时（日志前缀 `[node:https:]`）对 `-e` 不可靠，会报 `Cannot find module '-e'`。

### 2.3 步骤 3 — stdin 边界复现

**原理**：`pod.run(..., { terminal: customTerminal })` 启动的前台 `sh` 在 `read -t 5` 阻塞；若 `handle.write` 接入进程 stdin，`onOutput` 应出现脚本打印的 `__BP_VAL__:custom_ok`。

```text
pod.run('sh', ['-lc', '{ printf "custom-stdin> "; IFS= read -r -t 5 line;
  printf "\n__BP_EXIT__:%s\n__BP_VAL__:%s\n" "$?" "$line"; }'],
        { echo: false, terminal: customTerminal, cwd: '/home/user' })
```

- 见到 `custom-stdin> ` 后执行一次 `write('custom_ok\n')`。
- **正向判据**：流中出现 `__BP_VAL__:custom_ok`。
- **不以** `await pod.run(...)` resolve 为必要条件（custom terminal 下 Promise 常长期 pending）。

## 3. 结果

| 步骤 | 项 | 结果 | 说明 |
|------|-----|------|------|
| 1 | `createCustomTerminal` | 通过 | `typeof === 'function'` |
| 1 | handle `write` | 存在 | 运行时命中 `writer=write`（`index.d.ts` 中 `Terminal` 为空类，无 `write` 声明） |
| 2 | stdout → `onOutput` | 通过 | `stdout seen: true` |
| 2 | stderr → `onOutput` | 通过 | `stderr seen: true` |
| 3 | 见到 prompt | 通过 | `sawPrompt: true` |
| 3 | 程序化 stdin | **不通过（预期）** | `stdinOk: false` |
| 3 | 脚本收尾 `__BP_EXIT__:<数字>` | 未观察到 | `scriptCompleted: false` |
| 3 | `pod.run` Promise | 常超时 | 以 `onOutput` 为准 |

### 3.1 步骤 3 终态证据（Console）

```json
{
  "stdinOk": false,
  "scriptCompleted": false,
  "sawPrompt": true,
  "combined": "custom-stdin> custom_ok\n",
  "writer": "write"
}
```

解读：

- `custom-stdin> `：前台 shell prompt 已进入 `onOutput`。
- `custom_ok`：`write` 在 PTY 流上可见，多为**回显**。
- 无 `__BP_VAL__:custom_ok`：`read` 未读到输入 → **`write` 未接入进程 stdin**。
- 无 `__BP_EXIT__:<数字>`：收尾未进流；不改变 stdin 结论。

## 4. 与默认终端对照

| 维度 | `createDefaultTerminal` | `createCustomTerminal` |
|------|-------------------------|-------------------------|
| 输出 | SDK 渲染 DOM | `onOutput` 自建 UI（步骤 2 已验证） |
| 用户键盘 stdin | 已验证（`interactive-terminal`） | 本用例未测 |
| 程序化 `write` stdin | 非本用例重点 | **不可用**（步骤 3） |

## 5. Harness 教训（非平台能力变更）

1. SharedArrayBuffer → 解码前拷贝。
2. 避免 `node -e`；组合命令用 `sh -c` / `sh -lc`。
3. stdin 探测使用 `echo: false`，以 `__BP_VAL__:custom_ok` 为唯一正向判据。
4. 不以 `pod.run` resolve 作为 stdin 探测成功条件。

## 6. 结论与建议

### 6.1 结论

1. **Custom terminal 适合输出接管**：`onOutput` 可承载 `pod.run` 的 stdout/stderr。
2. **不宜依赖程序化 stdin**：`write` 存在但无法稳定喂给运行中 `read`。
3. **运行中交互输入**应使用 **默认终端 + 用户键盘**。
4. **命令**：`pod.run("sh", ["-c", script], { terminal, cwd: "/home/user", echo })`；`cwd` 用 `/home/user`。

### 6.2 web-claw / `packages/browserpod`

- 输出面板、日志镜像 → `createCustomTerminal` + `onOutput`。
- 交互式前台、运行中 stdin → `createDefaultTerminal`。
- `writeStdin` 对 custom terminal → `unsupported` 或等价降级（与 `browserpodTerminal.impl.ts` 一致）。

### 6.3 未决（本报告未覆盖）

- `Process` / exit code 稳定结构。
- `stop`、`dispose`、进程 `kill`。
- custom terminal 下 `__BP_EXIT__` 是否永不进入 `onOutput`（待 SDK 侧确认）。

## 7. `write` 的位置（类型与运行时）

| 项 | 说明 |
|----|------|
| 对象 | `createCustomTerminal()` 返回的 **terminal 实例** |
| 路径 | **`terminal.write`**（直接方法，非 `stdin.write`） |
| npm `index.d.ts` | `Terminal` 为空类，**未声明** `write` |
| 探测 | `findInputWriter` → `writer: "write"`；见 [`browserpod-sdk-runtime.types.md`](./browserpod-sdk-runtime.types.md) |
| 能力 | 方法**存在**；**不能**作为 `pod.run` 前台 stdin 的稳定通道（步骤 3） |

## 8. 参考

- 用例：`demos/browserpod-demo/src/cases/customTerminal.case.js`
- 桥接：`exec-scheme-bridge.md`（同目录）
- **类型（npm + 探测）**：[`browserpod-sdk-runtime.types.md`](./browserpod-sdk-runtime.types.md)
- SDK 公布：`node_modules/@leaningtech/browserpod/index.d.ts`

## 9. 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-05-26 | 初稿：汇总 `custom-terminal` 用例三轮探测与终态 Console 证据 |
| 2026-05-26 | 补充 §7 `write` 位置；链至 `browserpod-sdk-runtime.types.md` |
