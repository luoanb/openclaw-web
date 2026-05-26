# BrowserPod SDK 类型声明（npm 公布 + 本仓库运行时探测）

| 字段 | 内容 |
|------|------|
| SDK 版本 | `@leaningtech/browserpod@2.8.0` |
| npm 类型入口 | `node_modules/@leaningtech/browserpod/index.d.ts` |
| 探测用例 | `demos/browserpod-demo` → `custom-terminal`、`interactive-terminal` |
| 能力结论 | 见 [`custom-terminal-probe-report.md`](./custom-terminal-probe-report.md) |

本文档区分两层类型：

1. **公布类型**：npm 包自带的 `index.d.ts`（LeaningTech 发布）。
2. **探测类型**：demo 在浏览器中对 **运行时对象** 的归纳（**非官方**，供 `packages/browserpod` adapter 与 demo 使用）。

---

## 1. `write` 在哪里？

### 1.1 结论（对象与路径）

| 项 | 内容 |
|----|------|
| **所属对象** | `await pod.createCustomTerminal(...)` 返回的 **`Terminal` 实例**（下称 `terminal`） |
| **不是** | `BrowserPod` 实例、`pod.run` 同步返回的 `Process` 实例（除非另行探测到，见 §3） |
| **成员路径** | `terminal.write`（直接挂在 terminal 上，非 `terminal.stdin.write`） |
| **探测命中** | `findInputWriter(terminal)` 候选表第一项：`value.write`，label 为 `"write"` |
| **调用示例** | `await terminal.write('custom_ok\n')` 或 `terminal.write('custom_ok\n')` |
| **语义（能力）** | 运行时 **存在** 该方法；custom terminal 下 **不能** 稳定写入 `pod.run` 前台进程的 stdin（仅 PTY 回显证据），见探测报告步骤 3 |

### 1.2 与 `packages/browserpod` 的对应

仓库 adapter 已用同名可选成员建模：

```44:48:packages/browserpod/src/runtime/browserpodRuntime.interfaces.ts
export type BrowserPodTerminalLike = {
  readonly write?: (input: string) => unknown;
  readonly resize?: (cols: number, rows: number) => unknown;
  readonly close?: () => unknown;
};
```

`BrowserPodTerminalService.writeStdin` 在 `interactionStatus === "running"` 时调用 `this.terminal.write(input)`（默认终端路径）；custom terminal 应在产品层 **降级为 unsupported**。

### 1.3 未在首项命中的候选（探测扫描顺序）

demo `findInputWriter` 按序尝试，**仅当上一层不存在时才继续**：

| label | 路径 | 本次 custom terminal |
|-------|------|----------------------|
| `write` | `terminal.write` | **命中** |
| `writeInput` | `terminal.writeInput` | 未测（通常无） |
| `writeStdin` | `terminal.writeStdin` | 未测 |
| `input.write` | `terminal.input?.write` | 未测 |
| `stdin.write` | `terminal.stdin?.write` | 未测 |
| `input.getWriter` | `terminal.input?.getWriter()` | 未测 |
| `stdin.getWriter` | `terminal.stdin?.getWriter()` | 未测 |

---

## 2. npm 公布类型（摘要）

来源：`@leaningtech/browserpod@2.8.0` → `index.d.ts`。

```typescript
export class Terminal {}

export class Process {}

export class BrowserPod {
  static boot(opts: {
    nodeVersion?: string;
    apiKey: string;
    storageKey?: string;
    userImage?: string;
  }): Promise<BrowserPod>;

  run(
    executable: string,
    args: Array<string>,
    opts: {
      terminal: Terminal;
      env?: Array<string>;
      cwd?: string;
      echo?: boolean;
    }
  ): Promise<Process>;

  onPortal(cb: (args: { url: string; port: number }) => void): void;
  onOpen(cb: (urlOrPath: string) => void): void;

  createDirectory(path: string, opts?: { recursive?: boolean }): Promise<void>;
  createFile(path: string, mode: string): Promise<BinaryFile | TextFile>;
  openFile(path: string, mode: string): Promise<BinaryFile | TextFile>;

  createDefaultTerminal(consoleDiv: HTMLElement): Promise<Terminal>;

  createCustomTerminal(opts: {
    cols?: number;
    rows?: number;
    onOutput: (buffer: Uint8Array | ArrayBuffer, vt?: unknown) => void;
  }): Promise<Terminal>;
}
```

**缺口**：`Terminal`、`Process` 为空类，**未声明** `write`、`resize`、`close`、`cosProcess` 等运行时成员。

---

## 3. 探测补全类型（本仓库）

以下 TypeScript **描述运行时形状**，用于 adapter 与 demo；与 npm 公布类型并用时，以探测结论标注能力，勿过度承诺。

```typescript
/** onOutput 回调：chunk 可能基于 SharedArrayBuffer，解码前须拷贝 */
export type BrowserPodTerminalOutputChunk = Uint8Array | ArrayBuffer;

export type BrowserPodCustomTerminalOptions = {
  cols?: number;
  rows?: number;
  onOutput: (buffer: BrowserPodTerminalOutputChunk, vt?: unknown) => void;
};

/**
 * createDefaultTerminal / createCustomTerminal 返回的 terminal handle。
 * write 挂在实例自身（探测：custom-terminal 步骤 3，writer=write）。
 */
export type BrowserPodTerminalRuntime = {
  /** 存在；custom terminal 下不可视为 pod.run 前台 stdin */
  write?(input: string): void | Promise<void>;
  resize?(cols: number, rows: number): void;
  close?(): void;
  // 下列为 findInputWriter 扫描项，custom terminal 本次未命中，保留可选
  writeInput?(input: string): void | Promise<void>;
  writeStdin?(input: string): void | Promise<void>;
  input?: { write?(input: string): void | Promise<void>; getWriter?(): WritableStreamDefaultWriter };
  stdin?: { write?(input: string): void | Promise<void>; getWriter?(): WritableStreamDefaultWriter };
};

export type BrowserPodRunOptions = {
  terminal: BrowserPodTerminalRuntime;
  cwd?: string;
  echo?: boolean;
  env?: string[];
};

/**
 * pod.run 同步返回值（main.js 探测：存在 cosProcess）。
 * await pod.run(...) 本身在 custom terminal 场景可能长期 pending。
 */
export type BrowserPodRunReturnRuntime = {
  cosProcess?: Promise<unknown>;
};

export type BrowserPodRuntime = {
  run(
    executable: string,
    args: string[],
    opts: BrowserPodRunOptions
  ): Promise<BrowserPodRunReturnRuntime>;

  createDefaultTerminal(consoleDiv: HTMLElement): Promise<BrowserPodTerminalRuntime>;
  createCustomTerminal(
    opts: BrowserPodCustomTerminalOptions
  ): Promise<BrowserPodTerminalRuntime>;

  onPortal(cb: (args: { url: string; port: number }) => void): void;
  onOpen?(cb: (urlOrPath: string) => void): void;
  // boot、文件 API 同 index.d.ts，略
};
```

### 3.1 能力标注（与探测对齐）

| 成员 | 公布类型 | 运行时 | 能力结论 |
|------|----------|--------|----------|
| `createCustomTerminal` | 有 | 有 | 支持 |
| `onOutput` | 有 | 有 | **输出接管：支持** |
| `terminal.write` | **无** | **有** | **存在但未接入前台 stdin（custom）** |
| `pod.run` → `Process` | 空类 | 有 `cosProcess` 等 | 生命周期 / exit：待验证 |
| `Terminal.resize` / `close` | **无** | 未在本轮用例断言 | `unknown` |

---

## 4. 使用约定（web-claw / adapter）

1. **类型来源**：app 不直接依赖 `@leaningtech/browserpod` 时，以 `packages/browserpod` 的 `BrowserPodTerminalLike` / `BrowserPodLike` 为准；其字段与 §3 对齐。
2. **输出**：`createCustomTerminal` + `onOutput` + `TextDecoder`（shared buffer 先拷贝）。
3. **输入**：运行中 stdin → `createDefaultTerminal` + 用户键盘；**不要**依赖 `terminal.write` 作为稳定 `writeStdin`（custom terminal）。
4. **命令**：`pod.run('sh', ['-c', script], { terminal, cwd: '/home/user', echo })`；避免 `node -e`（`[node:https:]` 限制）。

---

## 5. 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-05-26 | 初稿：写明 `write` 位于 custom terminal 实例；补全 npm 与探测类型对照 |
