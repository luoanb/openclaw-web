# Micro-spec: claw-container 组件 Demo 展示页

## 目标

在 `apps/claw-container` 中新增 **组件预览 / 展示** 路由页，用于集中查看 `$lib/components/ui` 设计系统组件；与现有 `Home`、`About` 并列，通过 hash 路由可达（`/#/demo`，与当前 `svelte-spa-router` 行为一致）。

## 事实

- 根路由表：`src/App.svelte` 中 `routes` 对象；链接使用 `use:link`（与 `Home.svelte` 相同）。
- UI 组件位于 `src/lib/components/ui/<name>/index.ts`，约 **56** 个顶层族；各族 API 复杂度不一（部分需组合子组件、状态或上下文）。

## 方案（获批后执行）

1. **路由**：新增 `src/routes/Demo.svelte`（或 `ComponentShowcase.svelte`），在 `App.svelte` 注册 `'/demo': Demo`。
2. **页面结构**：
   - 顶栏：标题「组件展示」+ 返回首页 / About 的 `use:link` 导航。
   - 主区：纵向分区，**每一 UI 族对应一节**（稳定 `id` 便于锚点与后续自动化）。
3. **展示策略（v1）**：
   - **注册表**：在 `$lib/features/showcase/`（或等价路径，遵守 `features` 不反向依赖业务）维护 `showcase-registry.ts`，列出全部 `ui` 族名与锚点 `id`。
   - **可运行预览**：对实现成本低、无额外 Provider 的族提供 **最小可用** 示例（如 Button 多 variant、Badge、Input、Card 组合、Separator、Skeleton、Label 等）；数量目标 **≥ 12** 族有真实 Svelte 预览。
   - **其余族**：同节展示 **组件族中文可读标题 + `$lib/...` 路径提示 + 简短「预览待补」占位**，避免空白节，并保留与注册表一致的可扩展挂钩（后续按族补 `*Preview.svelte` 即可）。
4. **样式**：使用现有 Tailwind / shadcn 语义类（`text-muted-foreground`、`border`、`rounded-lg`、`space-y-*`），不引入新设计体系；不强制对照 Figma 像素级（本页为 **开发用陈列面**）；若与 `BitsUI.md` 冲突，以本 spec 为准（Dev showcase）。

## 边界（不改）

- 不引入 Storybook、不新增 npm 依赖。
- 不搬迁整个 `components/ui` 目录结构；不改为 SvelteKit 路由。
- 不在 v1 中承诺每个族均为「完整交互故事」（如 Chart/Data-table 等可仅占位）。

## Done Contract

- `pnpm -C apps/claw-container run check` 与 `pnpm -C apps/claw-container run build` 通过。
- 访问 `/#/demo` 可看到完整页面；注册表中 **每一** `ui` 族在页面上有对应一节（含占位或预览）。
- **≥ 12** 族具备真实组件渲染预览；首页或 About 有指向 Demo 的 `use:link` 入口（至少一处）。

## Change Log / Validation

- **变更**：
  - `src/App.svelte`：注册 `'/demo': Demo`。
  - `src/routes/Demo.svelte`：Demo 页壳（顶栏导航 + 主区）。
  - `src/routes/Home.svelte`：增加指向 `/#/demo` 的 `use:link`。
  - `src/lib/features/showcase/showcase-registry.ts`：`SHOWCASE_ENTRIES`（56 族）、`LIVE_PREVIEW_SLUGS`（19 族实时预览）。
  - `ShowcasePage.svelte`、`ShowcasePlaceholder.svelte`、`ShowcaseLiveBlock.svelte`：分区渲染与占位/预览。
- **验证**：`pnpm -C apps/claw-container run check` ✅；`pnpm -C apps/claw-container run build` ✅。
- **Done Contract**：56 节齐全；实时预览 **19** 族（≥12）；首页有 Demo 入口 ✅。

## Checkpoint（执行前）

- **理解**：单页 SPA 新增 `/demo`，以注册表驱动全量「节」，以分阶段预览填充内容。
- **风险**：部分组件需父级布局或状态；若 `check` 报错则该族暂降为占位并在 registry 注释原因。
- **验证**：`pnpm -C apps/claw-container run check` + `build`；本地 `dev` 打开 `/#/demo` 抽检滚动与链接。
