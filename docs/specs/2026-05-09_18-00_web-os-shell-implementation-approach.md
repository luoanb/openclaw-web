# Web OS — Shell 绿场：实现思路（底层能力 → 交付物）

## 1. 文档定位

| 项 | 说明 |
|----|------|
| **类型** | 实现路径说明（如何做），补充 **`2026-05-09_17-00_web-os-shell-greenfield.md`**（做什么 / 验收边界）。 |
| **受众** | 实现者与 Review：对齐依赖层级、模块分层、迭代顺序与最终产物。 |

若二者冲突，以 **绿场规格** 为准，并 **Reverse Sync** 修订本文。

**用户侧端到端调用顺序**（Runtime → Shell → UI）：见绿场规格 **§5.5**。

## 2. 自下而上：依赖哪些底层能力

### 2.1 浏览器 / 宿主环境

| 能力 | Shell 模块中的用途 |
|------|-------------------|
| **Web Streams**（`ReadableStream` / `WritableStream`）或官方封装等价物 | 消费子进程 stdout/stderr、向 stdin 写入用户字节流；处理背压（`desiredSize` / `await ready` 等，以 API 为准）。 |
| **Promise / async** | `spawn` 就绪、`exit` 回调、`dispose` 顺序收尾。 |
| **UTF-8 文本编码**（`TextEncoder` / `TextDecoder`） | 可选：仅当调用方传字符串时在边界编码；**规格默认强调字节透传**，编码策略见绿场 §8。 |

### 2.2 `@webcontainer/api`（唯一执行后端）

以下为 **能力心智模型**，具体字段名与可选参数 **以实现时所安装的包类型定义为准**：

| 能力 | 用途 |
|------|------|
| **`WebContainer` 实例** | 持有已 boot、且（由上层运行时保证）已完成工作区 **`mount`** 的容器句柄。 |
| **`spawn`** | 启动 Shell 进程（命令 + 参数 + 选项：`cwd`、`env`、是否 **终端模式** / TTY 语义等）。 |
| **子进程 stdin** | `write()` 透传用户输入（控制字符、换行、粘贴块）。 |
| **子进程 stdout / stderr** | 订阅数据块并 **尽快** 转发给上层（原始字节或 UTF-8 字符串策略可配置）。 |
| **退出结果** | `exit code`（及若提供的 **signal**）；驱动会话状态变为 `exited` 并触发回调。 |
| **终端尺寸（若 API 提供）** | 列/行变化时通知子进程（常见于 `resize` 或等价方法）；若无 API，则在规格 §7 记下 **降级：仅本地记录维度，进程侧不感知**。 |

### 2.3 仓库内：`IWebOsRuntime`（编排层，非 Shell 内部实现）

| 能力 | 与 Shell 的关系 |
|------|----------------|
| **`start()` / `switchDriveAndBoot()`** | 保证调用 Shell 时 **`WebContainer` 已就绪且当前盘树已挂载**（见 `2026-05-09_12-00_web-os-webcontainer-runtime.md`）。 |
| **干净挂载 §5.2** | Shell **不**参与 `mount({})` 策略；仅假设文件系统视图符合产品约定。 |

**集成方式**：应用或更高层组合「`await runtime.start()` → 取 `wc` → `new ShellSession(wc, options)`」。Shell 包内 **可直接依赖 `runtime` 的类型仅用于示例或可选工厂**，核心会话类应 **`WebContainer` 注入**，便于单测 Mock。

### 2.4 明确不依赖

| 项 | 原因 |
|----|------|
| **`packages/web-os/src/terminal/**`** | **已删除**（2026-05-09）；绿场实现勿恢复该路径。 |
| **具体终端 UI（xterm.js 等）** | Shell 止于字节/事件边界；UI 在应用层解码键盘、渲染 ANSI。 |

---

## 3. 自上而下：最终实现什么内容

### 3.1 对外交付（`packages/web-os/src/shell/`）

| 交付物 | 说明 |
|--------|------|
| **`IShellSession`（或等价契约）** | `start`/`attach`、`write(bytes \| string 策略)`、`resize(cols, rows)`、`dispose`、`onOutput`/`onExit` 等；状态：`idle` → `running` → `exited` \| `disposed`。 |
| **`ShellSession` 实现类** | 封装 `wc.spawn`、流订阅、写队列（可选）、卸载监听；**不在内部改写 write 载荷**（绿场 §5.1）。 |
| **`ShellSpawnPreset` / 选项工厂**（可选） | 默认命令（如 `jsh`）、`terminal: true`、`env` 模板；可被调用方整体覆盖。 |
| **`index.ts` 导出** | 是否提升到包根 `packages/web-os/src/index.ts` 由绿场 §8 决议；实现可先只做 `shell/index.ts`。 |
| **单元测试** | Mock `WebContainer` / 最小 `spawn` 返回形状：验证状态机、dispose 幂等、`write` 直通 Mock stdin、退出路径。 |

### 3.2 非交付（边界外）

- 键盘映射、提示符绘制、滚动缓冲区 UI、主题。
- 自动同步「编辑器 cwd」等业务逻辑。

### 3.3 调用方（未来）最小接线心智

```text
runtime.start() → wc
       → ShellSession.spawn(wc, { cols, rows, env?, cwd?, terminal?: true })
       → UI: onOutput → 终端渲染；键盘 → session.write(字节)
       → 关闭 Tab → session.dispose()
```

---

## 4. 内部分层建议（实现结构）

```text
┌─────────────────────────────────────────┐
│  ShellSession（门面 / 生命周期）          │
│  - spawn / dispose / write / resize      │
│  - 聚合 exit / error 事件                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  WebContainerProcess 适配（薄层）         │
│  - 仅封装 spawn 选项与流句柄获取          │
│  - 不做业务语义                           │
└─────────────────────────────────────────┘
```

- **可选**：将「输出解码 UTF-8 / 分包合并策略」抽成小型 **`OutputPump`** 类，便于单测与日后换缓冲策略。
- **禁止**：在 Shell 包内引入「猜测用户意图」的命令预处理层。

---

## 5. 推荐实现顺序（降低返工）

1. **固化契约**：`shellSession.interfaces.ts`（方法、事件、`ShellSessionOptions`、`ShellExitInfo`）。
2. **纯 TS 状态与选项校验**：例如 `cols/rows` 正整数、`dispose` 后 `write` 抛错或 no-op（行为写入契约）。
3. **Mock 驱动单测**：伪造 `spawn` 返回带可控 Writable/Readable 的对象，验证透传与退出。
4. **真实 `wc` 核对**：在 demo 或临时脚本中手动验证 `terminal` 模式、resize、`Ctrl+C` 字节行为；记录与绿场 §7 的差异。
5. **文档回写**：将实测差异写入绿场规格 §7 / §11 决议。

---

## 6. 验证与完成证据

| 层级 | 验证手段 |
|------|----------|
| **单元** | `pnpm --filter web-os test`（或在 `packages/web-os` 下执行 `pnpm test`）覆盖会话状态机与 Mock 透传。 |
| **集成（可选第二阶段）** | 在具 WebContainer 许可证的环境中手工或 E2E：启动 Shell → `echo` → `resize` → `exit` 码。 |

**Done 含义（实现阶段）**：契约导出稳定；默认预设下交互式 Shell 可长期运行；输入输出路径无私自改写；dispose 无泄漏；绿场 §8 决议已全部回填。

---

## 7. Change Log

| 日期 | 说明 |
|------|------|
| 2026-05-09 | 初稿：底层能力栈、仓库依赖、分层、迭代顺序、交付清单。 |
| 2026-05-09 | 已实现：`shellSession.interfaces.ts`、`shellSession.impl.ts`、`shellSpawnOptions.ts`、`shell/index.ts`、Mock 单测；**未**使用 `abort` 打断 output reader（依赖 `kill` 关闭流），避免与官方流语义竞态。 |
| 2026-05-09 | **`packages/web-os/src/terminal` 已移除**；包入口不再导出旧终端符号；`@xterm/xterm` 迁出 `web-os` 依赖。 |
