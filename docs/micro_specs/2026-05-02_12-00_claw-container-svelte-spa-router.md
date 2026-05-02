# Micro-spec: claw-container 接入 svelte-spa-router

## 目标

在 `apps/claw-container`（Vite + Svelte 5 SPA）中接入 **`svelte-spa-router` v5**，用 `<Router>` 驱动页面切换；保留现有首页内容与样式，作为默认路由 `/`。

## 事实

- 入口：`src/main.ts` → `mount(App, …)`；根组件 `src/App.svelte` 目前为单页模板内容。
- `svelte-spa-router` **5.x** 面向 Svelte 5：使用 `<Router {routes} />`、路由表对象、`router` 对象与回调 props（如 `onRouteLoaded`），而非旧版 store/`on:` 事件（见上游 `UPGRADING.md`）。

## 方案（获批后执行）

1. **依赖**：`pnpm add svelte-spa-router@^5`（workspace 内于 `apps/claw-container` 执行）。
2. **路由表**：新建少量路由组件（建议 `src/routes/Home.svelte` 承接现有 `App.svelte` 主体；可选 `src/routes/NotFound.svelte` 或第二条演示路由，便于验证切换）。
3. **根壳**：`App.svelte` 精简为仅渲染 `<Router routes={…} />`（按需保留全局样式入口若现有结构需要）。
4. **模式（重要）**：npm 包 `svelte-spa-router`（ItalyPaleAle）**v5.1.0 仅实现 hash 路由**（`#/…`，源码中 `getLocation`/`push` 均基于 `location.hash`），**不支持**在地址栏使用无 `#` 的 HTML5 History 路径。若产品要求 **history / 无 `#` URL**，需改用手头支持 `history` 的路由（例如 `@dvcol/svelte-simple-router`、`@keenmate/svelte-spa-router` 等）或 SvelteKit；本任务仍按官方包完成 **hash 接入**。
5. **Vite**：已设 `appType: 'spa'`，便于未知路径回退到 `index.html`（对 hash 方案为常见托管/预览习惯，也为将来换用 History 路由预留）。

## 边界（不改）

- 不引入 SvelteKit；不大范围挪动 `src/lib` 业务结构。
- 不做认证、复杂路由守卫（除非明确要求）。

## Done Contract

- `pnpm -C apps/claw-container check` 通过。
- `pnpm -C apps/claw-container build` 通过。
- 开发模式下 `/`（或 `#/`）展示与原首页等价内容；至少一处路由切换可验证（第二路由或 404）。

## Change Log / Validation

- **变更**：`pnpm add svelte-spa-router@^5`；`App.svelte` 挂载 `<Router {routes} />`；`src/routes/Home.svelte`、`src/routes/About.svelte`；`vite.config.ts` 增加 `appType: 'spa'`。
- **验证**：`pnpm -C apps/claw-container run check` ✅；`pnpm -C apps/claw-container run build` ✅。
- **history 模式**：当前所用 **`svelte-spa-router`（ItalyPaleAle）v5.1.0 不提供 History 模式**，实际 URL 为 `/#/about` 形式；若要 `/about` 无 `#`，需更换路由库（见上文「方案」第 4 点）。

## Checkpoint（执行前）

- **理解**：SPA 根组件挂载 Router，页面级内容为路由组件。
- **风险**：v5 API 与 v4 差异（仅用 v5 文档与类型）。
- **验证**：`check` + `build` + 本地 `dev` 手动点链验证。
