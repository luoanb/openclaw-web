# webcontainer-openclaw 非 UI 逻辑抽离至 packages

## 目标

将 `demos/webcontainer-openclaw` 中**无 Svelte 依赖**的可复用逻辑迁入 `packages/`，供本 monorepo 内其它应用（如后续 `claw-container`）通过 workspace 依赖复用；demo 保留 UI（`features/*/components`、`components/ui`、`ui/`、`utils.ts` 的 `cn` 等）。

## 现状摘要（事实）

- **拟迁移源码（14 个 `.ts`）**
  - `src/lib/core/webcontainer/`：`boot.ts`、`workspaceConstants.ts`、`fileSystem/`（含 IndexedDB、快照校验等）
  - `src/lib/core/terminal/`：`config`、`logBuffer`、`refs`、`cwdPrompt`、`shellRunner`、`index`
- **拟迁移特性逻辑（1 个 `.ts`）**
  - `src/lib/features/preview/preview.ts`：`attachPreview`（纯 TS + DOM，无 `.svelte`）
- **保留在 demo 内（不迁入包）**
  - 全部 `.svelte`、`utils.ts`（`cn` / 展示用类型工具）、`ui/toast`、`ui-old` 等
- **当前引用 `$lib/core` / `preview.ts` 的文件**
  - `TerminalPane.svelte`、`WorkspaceFilesDialog.svelte`、`OpenClawShell.svelte`

## 方案要点

- 新建 workspace 包：**目录** `packages/web-os`，**`package.json` 的 `name`**：`web-os`（与本仓库其它包并列；依赖写法 `"web-os": "workspace:*"`，代码里 `from 'web-os'`）。
- 包内目录建议与现有一致：`src/webcontainer/`、`src/terminal/`、`src/preview.ts`，根 `src/index.ts` 统一再导出（或 `package.json` `exports` 子路径，二选一以最少样板为准）。
- **依赖声明**：`@webcontainer/api`、`@xterm/xterm`（`shellRunner` 依赖 `Terminal` 类型）；peer 或 dependencies 按实际解析约定放置。
- **构建策略**：优先 **发布源码 + `types`/指向 `.ts`**，由消费方 Vite 直接编译（与现有 demo `noEmit` 一致）；若 monorepo 要求显式 `build`，再补最小 `tsc`/`tsup`（本 micro-spec 默认不引入除非验证失败）。
- **demo 改动**：删除已迁移的 `src/lib/core/**` 与 `features/preview/preview.ts`，改为 `import ... from 'web-os'`；`pnpm-workspace.yaml` 已包含 `packages/*`，仅需在 demo `package.json` 增加 `"web-os": "workspace:*"`；必要时调整 `vite.config` / `tsconfig` 以确保解析 workspace 包。

## 边界

- **不改** Bits UI 组件、Toast、样式、路由；不改其它 app（除非为打通 workspace 必须且列出）。
- **不做** 行为变更：仅搬家与 import 路径更新；公共 API 与现有导出语义对齐。

## Done Contract

- [x] `packages/web-os`（包名 `web-os`）存在且仅含上述 TS 模块；demo 中 `src/lib/core` 与 `features/preview/preview.ts` 已删除；`features/preview/components/PreviewPanel.svelte` 保留。
- [x] `demos/webcontainer-openclaw` 的 `pnpm build` 与 `pnpm check` 通过（2026-05-02）。
- [x] `pnpm exec tsc -p packages/web-os/tsconfig.json` 通过。

## 风险

- **Singleton 状态**：`boot.ts` 中 `wcSingleton` / `workspaceContentMounted` 为模块级状态；抽离后仍为单例，多入口若重复打包需注意；当前单 demo 可接受。
- **类型与 bundler**：workspace 包路径解析失败时需补 `vite.optimizeDeps` 或 `ssr.noExternal`（按需）。

## Change Log / Validation（执行后回写）

- **包路径**：`packages/web-os`，`package.json` 的 `name` 为 `web-os`；入口 `src/index.ts` 统一再导出（含 `preview`、`webcontainer/*`、`terminal/*`）。
- **`terminal.config.json`**：迁至 `packages/web-os/terminal.config.json`，`TerminalConfigLoader` 经 `src/terminal/config.ts` 引用；demo 根目录同名文件已删除。
- **demo**：`package.json` 增加 `"web-os": "workspace:*"`；`TerminalPane.svelte`、`WorkspaceFilesDialog.svelte`、`OpenClawShell.svelte` 改为 `from "web-os"`；无需改 `vite.config.ts`。
- **验证命令（均已通过）**：`pnpm install`；`pnpm exec tsc -p packages/web-os/tsconfig.json`；`pnpm --filter webcontainer-openclaw build`；`pnpm --filter webcontainer-openclaw check`。

---

**状态**：已按用户「开始吧」完成实现并验证。
