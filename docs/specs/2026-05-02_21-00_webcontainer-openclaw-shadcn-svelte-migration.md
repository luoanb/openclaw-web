# SDD Spec: webcontainer-openclaw — bits-ui → shadcn-svelte（Vite）

## RIPER 状态

| 字段               | 值                                                     |
| ------------------ | ------------------------------------------------------ |
| **phase**          | Research → Plan（待 **Plan Approved** 后进入 Execute） |
| **approval**       | 未批准                                                 |
| **active_project** | `demos/webcontainer-openclaw`                          |
| **spec path**      | 本文档                                                 |

---

## 0. Open Questions

- [ ] **Tailwind / CLI 版本**：当前 demo 使用 **Tailwind CSS v4**（`@tailwindcss/vite`）。执行前需对照 [shadcn-svelte Vite 安装文档](https://www.shadcn-svelte.com/docs/installation/vite) 与官方「Tailwind v4」迁移说明，确认 `shadcn-svelte@latest init` 与所生成组件在当前栈上无阻断性问题。
- [ ] **`components.json` 路径约定**：仓库 `project.mdc` 推荐中有 `src/lib/components`，本 demo 实际使用 **`$lib/ui/components`**（如 `Button.svelte`）。初始化时需选定 **shadcn 生成目录**（建议：`$lib/ui/components/ui`，避免与现有自定义组件混名），并在文档中固定。
- [ ] **全局样式策略**：以 shadcn-svelte 生成的样式为准，不合并现有 `app.css` 的设计 token。若视觉有偏差，在验证阶段记录。

---

## 1. Requirements (Context)

### Goal

在 **`demos/webcontainer-openclaw`** 中，将依赖 **`bits-ui` 的直接用法**迁移为 **[shadcn-svelte](https://www.shadcn-svelte.com/docs/installation/vite)** 推荐的 **CLI 安装 + 拷贝进仓库的组件**（`$lib/.../ui/*`），并最终 **移除 `bits-ui` 依赖**，构建与交互行为保持等价或可接受的视觉对齐。

### In-Scope

- 按官方 Vite 流程补齐/校验：`tsconfig` `paths`、`vite` `$lib` alias（**已存在**，执行时复查）、`shadcn-svelte init`、`components.json`。
- 通过 CLI **`add`** 当前代码实际用到的 primitive：**Tabs**、**Dialog**、**Dropdown Menu**（名称以 CLI 为准）。
- 替换以下文件中对 `bits-ui` 的引用：
  - `src/lib/ui/components/ShellTabs.svelte`（`Tabs`）
  - `src/lib/features/shell/components/OpenClawShell.svelte`（`Tabs.Content`，与 `ShellTabs` **同一 Tabs 上下文**）
  - `src/lib/features/terminal/components/WorkspaceFilesDialog.svelte`（`Dialog`、`DropdownMenu`）
- `package.json`：移除 `bits-ui`；如有仅服务 bits-ui 且不再需要的传递依赖，在验证后清理。
- `demos/webcontainer-openclaw/README.md`：更新依赖说明。
- 校验：`pnpm build` / `pnpm check`（在 demo 目录下）。

### Out-of-Scope

- 全仓库所有包一并迁移（除非后续单独开 spec 并声明 `change_scope=cross`）。
- 大范围改版 `app.css` token（以 shadcn-svelte 生成的样式为准，现有 token 不保留）。
- 替换自研 `Button`、toast 等非 bits-ui 部分（除非 shadcn 组件 API 强制连带修改）。

### 1.1 Context Sources

| 类型             | 路径/链接                                                                    |
| ---------------- | ---------------------------------------------------------------------------- |
| 安装参考         | [shadcn-svelte — Vite](https://www.shadcn-svelte.com/docs/installation/vite) |
| 全局样式与 token | `demos/webcontainer-openclaw/src/app.css`                                    |

### 1.5 Codemap Used（轻量索引，未单独落盘 codemap）

| 区域               | 说明                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| **bits-ui 引用点** | `ShellTabs.svelte`、`OpenClawShell.svelte`、`WorkspaceFilesDialog.svelte`              |
| **构建**           | `vite.config.ts` 已配置 `$lib` → `src/lib`；`tsconfig.json` 已配置 `paths` / `baseUrl` |
| **样式**           | Tailwind v4 + `src/app.css` 自定义变量                                                 |

---

## 2. Research Findings

### 事实

1. **`bits-ui` 仅出现在** `webcontainer-openclaw` 的 `package.json` 与上述 3 个 Svelte 文件；`pnpm-lock.yaml` 中的解析可随移除依赖更新。
2. **Tabs 上下文拆分**：`ShellTabs.svelte` 渲染 `Tabs.Root` / `List` / `Trigger`；`OpenClawShell.svelte` 在子 snippet 内渲染 **`Tabs.Content`**，必须从 **同一组件体系** import（迁移后统一从 shadcn **tabs** 模块导入），否则上下文断裂。
3. **Vite 指南与仓库现状**：官方建议在 `tsconfig` + `vite.config` 中配置 `$lib`；本仓库 **已对齐**，执行阶段只需防回归。
4. **shadcn-svelte 本质**：组件源码进入仓库，便于与 Tailwind / `cn()` 统一；**不等价于「卸载所有 headless 依赖」**——部分生成代码仍可能依赖底层库，以 CLI 生成结果与 `package.json` 为准。

### 风险

| 风险                               | 缓解                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `init` 覆盖 `app.css`              | 执行前备份或分文件（如 `app-shadcn.css`）再合并；以视觉回归为准          |
| API 差异（bits-ui vs shadcn 封装） | 按组件逐个对照迁移；重点测 Tabs 绑定、Dialog `open`、Dropdown `onSelect` |
| Tailwind v4 与 CLI 模板不完全匹配  | 执行前查官方 issue/changelog；必要时锁定 CLI 版本或用手动修复            |

### 2.1 Next Actions

1. 用户确认范围与本 spec（必要时修订 §1）。
2. 用户发送 **`Plan Approved`** 后进入 Execute：按 §4 清单实施。
3. Execute 结束后：**Reverse Sync** `docs/specs/2026-05-01_19-00_WebContainer-工作区导出导入功能.md` 中与 bits-ui 实现路径相关的条目。

---

## 3. Innovate（可选方案）

### Option A — 默认 CLI 路径

完全跟随 [Vite 文档](https://www.shadcn-svelte.com/docs/installation/vite)：`shadcn-svelte init` + `add tabs dialog dropdown-menu`，组件落在配置的 `ui` 目录。

### Option B — 最小文件位移

若 CLI 默认目录与现有 `$lib/ui/components` 冲突，在 `components.json` 中将 **ui 别名**设为 `$lib/ui/components/ui`，自定义按钮等仍留在 `$lib/ui/components`。

### Decision（推荐）

- **Option A + B 的结合**：使用 CLI，但 **显式配置 alias**，使 shadcn 生成物集中在 **`$lib/ui/components/ui/**`**，与现有 `Button.svelte` 等并列且不混装。

### Option C — 冲突目录临时隔离（补充策略）

若 CLI 检测到目标目录已存在（如 `$lib/ui/components/ui/`），shadcn-svelte **不会覆盖**，但可能报错或行为不稳定。

**隔离策略**：

1. 在 `shadcn-svelte init` **之前**，将**所有可能冲突的现有目录**移动到 `src/lib/ui-old/` 备份。
2. 执行 `shadcn-svelte init` 和 `add` 命令，让 CLI 在干净目录中初始化。
3. 迁移完成后，如果现有文件（如自定义 Button）需要保留，从临时路径手动合并回 `src/lib/ui/components/`（**不放在 `ui/` 子目录下，与 shadcn 生成物保持同级并列**）。

**冲突目录清单**（执行前需确认）：

| 现有路径                    | 冲突原因                                | 备份位置                     |
| --------------------------- | --------------------------------------- | ---------------------------- |
| `src/lib/ui/components/`    | 与 shadcn 默认 `components/ui` 名称接近 | `src/lib/ui-old/components/` |
| `src/lib/ui/utils/`（若有） | 与 shadcn `utils.ts` 可能冲突           | `src/lib/ui-old/utils/`      |

**临时隔离原则**：

- 备份目录统一放在 `src/lib/ui-old/` 下
- 迁移完成后统一清理（验证通过后手动删除）
- shadcn 生成目录保持干净，不混入迁移前的自定义组件

### Skip

- `Innovate` 未跳过；目录冲突在本仓库为真实风险，需在 `components.json` 一次性定案。

---

## 4. Plan（Contract）

### 4.1 File Changes（预期）

| 文件                                                                       | 变更                                                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `demos/webcontainer-openclaw/package.json`                                 | 移除 `bits-ui`；可能新增 shadcn/cli 指示的依赖                                                           |
| `demos/webcontainer-openclaw/components.json`                              | **新增**（CLI 生成）                                                                                     |
| `demos/webcontainer-openclaw/src/app.css`                                  | **合并** shadcn 主题/基础样式与现有 token（禁止无脑覆盖）                                                |
| `demos/webcontainer-openclaw/src/lib/ui/utils/cn.ts` 或新增 `lib/utils.ts` | 与 `components.json` 中 **utils** 别名一致；若 shadcn 默认 `lib/utils.ts`，则对齐 import 或复用现有 `cn` |
| `src/lib/ui/components/ShellTabs.svelte`                                   | `bits-ui` → shadcn Tabs                                                                                  |
| `src/lib/features/shell/components/OpenClawShell.svelte`                   | `bits-ui` → shadcn Tabs（Content）                                                                       |
| `src/lib/features/terminal/components/WorkspaceFilesDialog.svelte`         | `bits-ui` → shadcn Dialog + DropdownMenu                                                                 |
| `src/lib/components/ui/**` 或 `src/lib/ui/components/ui/**`                | **新增**（CLI 生成的按钮级组件，以实际路径为准）                                                         |
| `demos/webcontainer-openclaw/README.md`                                    | 依赖说明从 bits-ui 改为 shadcn-svelte                                                                    |
| `docs/specs/2026-05-01_19-00_WebContainer-工作区导出导入功能.md`           | Reverse Sync：Dropdown 实现路径                                                                          |

### 4.2 Signatures / 行为契约

- **Tabs**：`bind:value`（或 shadcn 等价 API）在 Shell 与 Terminal/Preview 切换上行为不变。
- **Dialog**：`WorkspaceFilesDialog` 的 `open` 绑定与关闭逻辑不变。
- **DropdownMenu**：导出项 **点击即执行** 的语义不变（与既有 spec 一致）。
- **`cn()`**：继续作为 class 合并入口；与 shadcn 组件内部用法一致。

### 4.3 Implementation Checklist

- [ ] 1. 在 `demos/webcontainer-openclaw` 执行环境校验：`pnpm install`，确认 Node/pnpm 可用。
- [ ] 2. **Option C 预备动作**：执行 `shadcn-svelte init` 前，先将 `src/lib/ui/components/` 等可能冲突的目录移动到 `src/lib/ui-old/` 备份（**仅备份，不删除**）。
- [ ] 3. 按官方文档运行 `shadcn-svelte@latest init`，交互中选择：**全局 CSS** = `src/app.css`（**以 shadcn 生成的样式为准，现有 `app.css` 的 design token 不保留**）；**$lib**、**components/ui** 路径与 §3 决策一致。
- [ ] 4. `shadcn-svelte add`：`tabs`、`dialog`、`dropdown-menu`（及 CLI 提示的依赖组件）。
- [ ] 5. 迁移 `ShellTabs.svelte`、`OpenClawShell.svelte`、`WorkspaceFilesDialog.svelte`，删除所有 `from "bits-ui"`。
- [ ] 6. 从 `package.json` 移除 `bits-ui`；`pnpm install` 刷新 lockfile（根仓库 monorepo 场景下在仓库根执行安装）。
- [ ] 7. 合并保留的自定义组件（若有，如 Button）：从临时备份中取回，放置在 `src/lib/ui/components/`（**不在 `ui/` 子目录下**）。
- [ ] 8. 运行 `pnpm check` 与 `pnpm build`（在 demo 包目录）。
- [ ] 9. 手动烟测：Tabs 切换、工作区对话框打开/关闭、导出下拉三项触发。
- [ ] 10. 清理 `src/lib/ui-old/` 目录（验证通过后）。
- [ ] 11. **Reverse Sync**：更新 `2026-05-01_19-00_WebContainer-工作区导出导入功能.md` 中提及 bits-ui 的句子；更新 demo `README.md`。

### 4.4 Validation（验收证据）

- `pnpm check` 无错误；`pnpm build` 成功。
- 浏览器中上述烟测通过：Tabs 切换、对话框打开/关闭、导出下拉触发正常。

---

## 5–8. Execute Log / Review / Diff / Archive

_Execute 阶段开始后填写。_

---

## Change Log

| 日期       | 说明                                      |
| ---------- | ----------------------------------------- |
| 2026-05-02 | 首版：Research + Plan，等待 Plan Approved |
