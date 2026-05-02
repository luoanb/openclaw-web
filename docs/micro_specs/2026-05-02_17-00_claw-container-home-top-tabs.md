# Micro-spec: claw-container 首页顶栏 Tab

## 目标

重构 `apps/claw-container` 路由 `/`（`Home.svelte`）：顶部为三个 Tab（文件管理、系统运行、功能预览），下方为对应内容区；功能预览内容区暂为空；前两区为占位即可。

## 事实

- 入口路由：`App.svelte` → `svelte-spa-router`，`/` → `src/routes/Home.svelte`。
- UI：`$lib/components/ui/tabs`（Bits / shadcn-svelte 封装）已在 Demo 中使用。

## 方案

1. **重写 `Home.svelte`**：移除现有 Vite/Svelte 模板营销区块与 `Counter`；使用 `<Tabs>`，`TabsList` 采用 `variant="line"` 顶栏样式，`TabsTrigger` 三等分宽。
2. **Tab value**：`files` | `runtime` | `preview`（英文便于绑定与后续路由/query 扩展）。
3. **内容**：`preview` 的 `TabsContent` 无任何占位文案；`files` / `runtime` 使用简短「待接入」类占位。
4. **辅助**：页脚保留指向 `#/about`、`#/demo` 的链接（原首页演示路由能力，不占主导 visually）。

## 边界（不改）

- 不改 `App.svelte` 路由表与其他路由页面逻辑。
- 不接真实文件系统或进程监控。

## Done Contract

- `pnpm -C apps/claw-container run check` 通过。
- `pnpm -C apps/claw-container run build` 通过。
- 手动：`/` 可见顶栏三 Tab，切换内容符合占位约定；功能预览为空。

## Change Log / Validation

- **变更**：重写 `src/routes/Home.svelte`：顶栏 `TabsList variant="line"` 三 Tab；`files` / `runtime` 占位 copy；`preview` 无文案；页脚保留 `#/about`、`#/demo` 链接。
- **验证**：`pnpm -C apps/claw-container run check` ✅（0 errors，ShowcaseLiveBlock 既有 1 warn）；`pnpm -C apps/claw-container run build` ✅。
- **未覆盖**：浏览器手点 Tab 需本地 `dev`/`preview` 自测。

## 附：与 Demo Tabs 视觉一致

- Demo（`ShowcaseLiveBlock` slug `tabs`）使用 **默认** `TabsList`（`bg-muted` 分段、圆角轨道），**非** `variant="line"` 下划线款。
- 首页应与之一致：默认 variant、`gap-2`、`TabsContent` 使用 `mt-1.5 border-t pt-2 text-xs` 与 Demo 相同层级分隔。

- **原因**：`app.css` 中 `#app` 曾为 `width: 1126px` + `margin: 0 auto`（Vite 模板“稿纸”列），视口更宽时两侧出现空带。
- **处理**：`#app` 改为 `width: 100%` 全宽壳（已移除居中窄列与 `border-inline`/`text-align: center`）。
