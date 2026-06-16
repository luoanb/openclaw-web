# quick-notes Tauri/JSON 技术规格

| 属性 | 内容 |
|------|------|
| 状态 | 待审核 |
| PRD | `docs/prd/prd-quick-notes-light.md` |
| 应用目录 | `apps/quick-notes` |

## 技术选择

- 桌面壳：Tauri v2。
- 前端：Svelte 5 + Vite + TypeScript。
- 样式：Tailwind CSS 4，沿用仓库 Bits UI / shadcn-svelte 风格。
- 本地数据：Tauri 后端读写应用数据目录下的 `quick-notes.json`。

## 当前实施边界

- 已允许：先搭建 `apps/quick-notes` 的 Tauri + Svelte/Vite 框架。
- 未允许：实现 TODO、速记、本地 JSON 读写命令、前端业务 store 与业务页面交互。
- 下方数据模型与 Tauri 命令是后续业务实现契约，需在 PRD/技术方案审核通过后再落代码。

## 数据文件

运行时数据文件位于 Tauri 应用数据目录：

```text
<app_data_dir>/quick-notes.json
```

首次启动或文件不存在时返回空数据：

```json
{
  "tasks": [],
  "notes": []
}
```

## 数据模型

```ts
type TaskStatus = "active" | "done";

interface QuickTask {
  id: string;
  content: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

interface QuickNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface QuickNotesStore {
  tasks: QuickTask[];
  notes: QuickNote[];
}
```

约束：

- `content` 由前端 trim 后保存，空内容不提交。
- `createdAt`、`updatedAt`、`completedAt` 均使用 ISO 字符串。
- 完成任务时设置 `status = "done"` 与 `completedAt`。
- 恢复任务时设置 `status = "active"` 并清空 `completedAt`。

## Tauri 命令

| 命令 | 入参 | 返回 | 说明 |
|------|------|------|------|
| `load_store` | 无 | `QuickNotesStore` | 读取 JSON；文件不存在则返回空数据。 |
| `save_store` | `store: QuickNotesStore` | `QuickNotesStore` | 校验后写入 JSON，并返回已保存的数据。 |

错误处理：

- 读取 JSON 失败或反序列化失败时返回可读错误。
- 写入失败时返回可读错误，前端保留内存中的当前数据。
- 首期不引入 schema 迁移；后续如增加字段，再在本文件追加版本策略。

## 写入策略

- 写入前确保应用数据目录存在。
- 写入时先写 `quick-notes.json.tmp`，再重命名为 `quick-notes.json`。
- JSON 使用 pretty 格式，便于本地排查。

## 前端分层

```text
src/lib/
  core/
    quick-notes-store.ts   # 数据类型、默认值、排序与不可变更新服务
  features/
    tasks/                 # TODO 展示与交互组件
    notes/                 # 速记展示与交互组件
  components/
    ui/                    # 按需 UI 组件封装
```

`core` 逻辑优先用类封装状态与行为，避免把可复用过程散落成大量顶层函数。

## 验证

- `pnpm --filter quick-notes check`
- `pnpm --filter quick-notes build`
- `pnpm --filter quick-notes tauri build`

若本机缺少 Tauri/Rust/WebKitGTK 等桌面构建依赖，应记录失败原因，并至少完成 Svelte/Vite 层验证。

WSL/Ubuntu 上需要先满足系统依赖：

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### 2026-06-16 框架验证结果

| 命令 | 结果 |
|------|------|
| `pnpm --filter quick-notes check` | 通过；`svelte-check` 0 errors / 0 warnings。 |
| `pnpm --filter quick-notes build` | 通过；Vite production build 成功。 |
| `pnpm --filter quick-notes tauri:dev` | 未通过；已补齐用户态 Rust/Cargo，并进入 `cargo run`；当前环境缺少系统 C linker，报错 `linker cc not found`。 |
| `pnpm --filter quick-notes tauri:build` | 未通过；同属系统构建依赖未满足，需先安装 C toolchain 与 Tauri Linux WebView 依赖。 |

## 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-06-16 | 初稿；定义 Tauri command、JSON 数据模型与写入策略。当前仅完成框架搭建，业务实现待审核后推进。 |
