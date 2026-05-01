# webcontainer-openclaw

浏览器内 WebContainer 沙箱：终端（xterm）与 HTTP 预览。

## 栈

- **Svelte 5**（runes）+ **Vite** + **`@sveltejs/vite-plugin-svelte`**
- **bits-ui**（Tabs 等 headless 组件）
- **Tailwind CSS v4**（`@tailwindcss/vite`）+ **`clsx` / `tailwind-merge`**（`cn()`）
- **xterm.js**、**@webcontainer/api**

全局样式入口：[`src/app.css`](./src/app.css)（设计变量 + `@import "tailwindcss"`）；业务布局与面板见 `src/lib/features/`（`shell` / `terminal` / `preview`），公共样式工具见 `src/lib/ui/`。

## 配置

根目录 [`terminal.config.json`](./terminal.config.json) 控制日志截断与单行命令长度上限（`maxCmdLen` 等）。构建时由 `src/lib/features/terminal/terminal.ts` 静态导入。

## 已知限制（stdin / 非 PTY）

- WebContainer 提供伪终端管道与 **`process.input`** 流；**不是** 操作系统级 PTY。
- 依赖全屏 TUI（如部分 `ncurses`）、精确信号行为的 CLI **可能失败**。
- 空闲时 **Enter** 将当前行以 `sh -c` 执行；**进程运行期间** 按键写入子进程 **stdin**。

详见仓库 [`docs/research/feasibility-openclaw-webcontainers.md`](../../docs/research/feasibility-openclaw-webcontainers.md)。

## 脚本

```bash
pnpm --filter webcontainer-openclaw dev
pnpm --filter webcontainer-openclaw build
pnpm --filter webcontainer-openclaw check
```

需 **crossOriginIsolated**（本 demo 的 Vite 已配置 COOP/COEP）。
