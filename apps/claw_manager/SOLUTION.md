# claw_manager 完整解决方案

## 1. 背景与目标

### 现状
- **claw_manager** (port 5177): HTTPS (自签名证书)
- **OpenClaw Web** (port 5173): HTTPS (自签名证书)
- **管理后台** (port 18789): HTTPS (自签名证书)
- **Code-server** (port 8080): HTTP

### 核心问题
| 问题 | 表现 | 根因 |
|------|------|------|
| Mixed Content | Code-server iframe 被浏览器阻止加载 | HTTPS 页面嵌入 HTTP iframe |
| 证书警告 | 每个 iframe 加载时弹出证书警告 | 三个服务各自使用自签名证书 |
| 协议不一致 | 部分服务 HTTP、部分 HTTPS | 历史原因，无统一入口 |

### 目标
1. 消除 mixed content 报错
2. 浏览器只弹一次证书警告（或零次）
3. 保持其他服务不动
4. claw_manager 保持 HTTPS

---

## 2. 方案对比

### 方案 A：Vite Proxy 代理（轻度方案）

**原理**：利用 Vite Dev Server 的 `server.proxy` 功能，将 `/proxy/*` 路径反向代理到各后端服务。iframe URL 改为指向 claw_manager 自身路径。

**技术路径**：
```
iframe src="https://192.168.1.2:5177/proxy/code/"
  └─ Vite proxy → http://192.168.1.2:8080/
```

| 维度 | 评价 |
|------|------|
| 工作量 | 小（仅改 `vite.config.ts` + `App.svelte`），约 0.5h |
| 依赖 | 零（Vite 内置） |
| 生产可用 | ❌ 仅限 dev 模式 |
| WebSocket | ✅ Vite proxy 支持 `ws: true` |
| 证书 | 仍需要接受一次 claw_manager 的自签名证书 |

**实施步骤**：
1. `vite.config.ts` 添加 `server.proxy` 配置
2. `App.svelte` 中 iframe URL 改为 `/proxy/...` 相对路径
3. 配套修改侧边栏文案

**风险**：
- `vite preview` (生产预览) 不支持 proxy
- 需额外为生产环境准备独立代理服务器

---

### 方案 B：Node.js 同源代理服务器（推荐方案）

**原理**：编写一个 Express 服务器，同时做两件事：
1. 提供 HTTPS 服务（复用现有证书）
2. 将 `/proxy/*` 反向代理到各后端服务

**架构**：
```
浏览器 → https://192.168.1.2:5177
            │
            ├── / → 静态文件 (claw_manager build)
            ├── /proxy/openclaw/* → https://192.168.1.2:5173/*
            ├── /proxy/admin/*    → https://192.168.1.2:18789/*
            └── /proxy/code/*     → http://192.168.1.2:8080/*
```

| 维度 | 评价 |
|------|------|
| 工作量 | 中（新增 `server.ts` + 安装 `express`/`http-proxy-middleware`），约 2h |
| 依赖 | `express`, `http-proxy-middleware`, `node:https`（内置）|
| 生产可用 | ✅ Dev 和 Preview 统一行为 |
| WebSocket | ✅ `http-proxy-middleware` 支持 |
| 证书 | 仅需接受 claw_manager 一个证书 |

**实施步骤**：
1. 安装依赖：`express`, `http-proxy-middleware`, `@types/express`
2. 创建 `server.ts`：HTTPS + 静态文件 + 反向代理
3. 修改 `package.json` scripts：添加 `"start": "node server.ts"`（或编译后运行）
4. 修改 `App.svelte`：iframe URL 改为 `/proxy/...` 相对路径
5. 修改侧边栏文案和默认折叠状态

**风险**：
- `http-proxy-middleware` 处理 WebSocket 需要额外配置 `ws: true`
- 被代理服务的资源路径是绝对路径时，无法正确重写（需要配置 `pathRewrite`）
- 某些服务可能检测到非原始 Host 并拒绝请求（需要 `changeOrigin: true`）

---

### 方案 C：Caddy 侧边车代理（稳健方案）

**原理**：引入 Caddy 作为专用反向代理，caddy 自动处理 HTTPS、证书、代理。

**架构**：
```
Caddy (port 443)
  ├── / → 静态文件代理 → claw_manager (5177)
  ├── /openclaw/* → 反向代理 → 5173
  ├── /admin/* → 反向代理 → 18789
  └── /code/* → 反向代理 → 8080
```

| 维度 | 评价 |
|------|------|
| 工作量 | 中高（需安装 Caddy + 编写 Caddyfile + 配置开发流程），约 3h |
| 依赖 | Caddy（系统额外服务） |
| 生产可用 | ✅ 工业级 |
| WebSocket | ✅ 原生支持 |
| 证书 | ✅ 自动获取 Let's Encrypt 或使用自定义证书 |
| 跨平台 | ❌ 需为每台机器安装 Caddy |

**实施步骤**：
1. 安装 Caddy
2. 编写 Caddyfile
3. 调整 claw_manager 端口/配置
4. 调整 iframe URL

**风险**：
- 增加系统复杂度
- 不适合作为前端项目的一部分维护
- 端口 443 需要 root 权限（可用非标准端口绕过）

---

## 3. 推荐方案

**推荐方案 B（Node.js 同源代理服务器）**，理由如下：

| 考量 | 方案 A (Vite Proxy) | 方案 B (Node.js Proxy) | 方案 C (Caddy) |
|------|:---:|:---:|:---:|
| Dev/Preview 一致性 | ❌ | ✅ | ✅ |
| 额外依赖 | 0 | 轻 (3 个 npm pkg) | 重 (系统服务) |
| 实现复杂度 | 低 | 中 | 高 |
| 长期维护成本 | 低 | 低 | 高 |
| 对现有项目侵入 | 低 | 中 | 高 |
| 证书体验 | 一次警告 | 一次警告 | 零警告 (ACME) |

方案 B 在前端项目的边界内解决问题，不引入外部系统依赖，且 dev/preview 行为一致。

---

## 4. 实施步骤（方案 B 详细）

### 4.1 安装依赖

```bash
pnpm add express http-proxy-middleware
pnpm add -D @types/express @types/node
```

### 4.2 创建 `server.ts`

```ts
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

const app = express();
const PORT = 5177;
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// 1. 静态文件服务（生产构建产物）
app.use(express.static(path.resolve(__dirname, "dist")));

// 2. 反向代理
const proxyConfig = {
  "/proxy/openclaw": {
    target: "https://192.168.1.2:5173",
    changeOrigin: true,
    secure: false, // 自签名证书
    pathRewrite: { "^/proxy/openclaw": "" },
  },
  "/proxy/admin": {
    target: "https://192.168.1.2:18789",
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/proxy/admin": "" },
  },
  "/proxy/code": {
    target: "http://192.168.1.2:8080",
    changeOrigin: true,
    pathRewrite: { "^/proxy/code": "" },
  },
};

for (const [route, config] of Object.entries(proxyConfig)) {
  app.use(route, createProxyMiddleware(config));
}

// 3. SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

// 4. HTTPS
https
  .createServer(
    {
      key: fs.readFileSync(path.resolve(__dirname, "cert/key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "cert/cert.pem")),
    },
    app,
  )
  .listen(PORT, () => {
    console.log(`claw_manager running at https://192.168.1.2:${PORT}`);
  });
```

### 4.3 修改 `vite.config.ts`（开发环境同样支持）

```ts
export default defineConfig({
  // ... 现有配置
  server: {
    allowedHosts: true,
    https: { key, cert },
    proxy: {
      "/proxy/openclaw": {
        target: "https://192.168.1.2:5173",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/openclaw/, ""),
      },
      "/proxy/admin": {
        target: "https://192.168.1.2:18789",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/admin/, ""),
      },
      "/proxy/code": {
        target: "http://192.168.1.2:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/code/, ""),
      },
    },
  },
});
```

### 4.4 修改 `package.json`

```json
{
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "start": "tsx server.ts",
    "check": "svelte-check --tsconfig ./tsconfig.json"
  }
}
```

> 注意：`tsx` 需要安装 `pnpm add -D tsx`，或使用 `node --experimental-strip-types server.ts`（Node 22.6+）。

### 4.5 修改 `App.svelte`

```ts
const iframeServices = [
  { label: "WebClaw", icon: "globe" as const, page: "openclaw", url: "/proxy/openclaw" },
  { label: "管理后台", icon: "dashboard" as const, page: "admin", url: "/proxy/admin" },
  { label: "Code", icon: "code" as const, page: "code-server", url: "/proxy/code" },
];
```

### 4.6 侧边栏默认折叠

```ts
let sidebarCollapsed = $state(true);
```

---

## 5. 风险及规避

| 风险 | 概率 | 影响 | 规避方案 |
|------|------|------|----------|
| 被代理服务使用绝对路径资源 | 中 | iframe 内部分资源加载失败 | `http-proxy-middleware` 的 `cookieDomainRewrite` + `pathRewrite`；必要时增加 `onProxyRes` 改写 HTML |
| WebSocket 连接失败 | 中 | code-server 终端/HMR 失效 | 在 proxy 配置中增加 `ws: true` |
| 被代理服务检查 `Host` header | 低 | 返回 403/错误 | 使用 `changeOrigin: true` |
| `import.meta.url` 在 Windows 路径格式 | 低 | 资源路径错误 | 使用 `fileURLToPath` 转换 |
| 开发环境与生产环境 pathRewrite 实现差异（Vite vs http-proxy-middleware） | 低 | 路径不一致 | Vite 用 `rewrite`（函数），http-proxy-middleware 用 `pathRewrite`（对象），注意保持逻辑一致 |

---

## 6. 额外需求调整

### 侧边栏文案

```diff
- { label: "OpenClaw Web", ... }
+ { label: "WebClaw", ... }

- { label: "Code-server", ... }
+ { label: "Code", ... }
```

### 左侧面板默认折叠

```diff
- let sidebarCollapsed = $state(false);
+ let sidebarCollapsed = $state(true);
```

---

## 7. 实施顺序（推荐）

```
Step 1: 安装 express + http-proxy-middleware         → 5 min
Step 2: 修改 vite.config.ts（dev proxy）              → 15 min
Step 3: 创建 server.ts（production proxy）             → 30 min
Step 4: 修改 App.svelte（iframe URL + 文案 + 折叠）   → 10 min
Step 5: 修改 package.json（添加 start script）        → 5 min
Step 6: 验证 dev 模式                                 → 10 min
Step 7: pnpm build && pnpm start 验证生产模式          → 10 min
                                                    ────────
                                                      约 1.5h
```
