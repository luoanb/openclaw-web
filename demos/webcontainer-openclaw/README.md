# webcontainer-openclaw

浏览器内 WebContainer 沙箱：终端（xterm）与 HTTP 预览。

## 栈

- **Svelte 5**（runes）+ **Vite** + **`@sveltejs/vite-plugin-svelte`**
- **bits-ui**（Tabs 等 headless 组件）
- **Tailwind CSS v4**（`@tailwindcss/vite`）+ **`clsx` / `tailwind-merge`**（`cn()`）
- **xterm.js**、**@webcontainer/api**

全局样式入口：[`src/app.css`](./src/app.css)（设计变量 + `@import "tailwindcss"`）；业务布局与面板见 `src/lib/features/`（`shell` / `terminal` / `preview`），公共样式工具见 `src/lib/ui/`。

## 配置

终端滚动缓冲与截断常量见 [`src/lib/features/terminal/xtermLogBuffer.ts`](./src/lib/features/terminal/xtermLogBuffer.ts)（`DEFAULT_TERMINAL_UI_CONFIG`，与历史 `terminal.config.json` 默认值对齐）。交互会话使用 **`web-os` 的 `ShellSession`**（真实 `jsh` stdin/out）；一键 PoC / `npm install` 仍通过 **`wc.spawn`** 前台进程写入 xterm。

## 已知限制（stdin / 非 PTY）

- WebContainer 提供伪终端管道与 **`process.input`** 流；**不是** 操作系统级 PTY。
- 依赖全屏 TUI（如部分 `ncurses`）、精确信号行为的 CLI **可能失败**。
- **交互模式**：键盘输入经 xterm **`onData`** 写入 **`ShellSession.write`**，直达 **`jsh`**；**中止** 在前台 `npm`/`npx` 时 kill 进程，在交互 shell 时发送 Ctrl+C（字符串 `"\x03"`）。

详见仓库 [`docs/research/feasibility-openclaw-webcontainers.md`](../../docs/research/feasibility-openclaw-webcontainers.md)。

## 脚本

```bash
pnpm --filter webcontainer-openclaw dev
pnpm --filter webcontainer-openclaw build
pnpm --filter webcontainer-openclaw check
```

需 **crossOriginIsolated**（本 demo 的 Vite 已配置 COOP/COEP）。
