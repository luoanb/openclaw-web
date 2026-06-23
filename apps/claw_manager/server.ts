import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { proxyUpgrade } from "httpxy";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5177;

const tlsOptions = {
  key: fs.readFileSync("/home/lab/192.168.1.2-key.pem"),
  cert: fs.readFileSync("/home/lab/192.168.1.2.pem"),
};

// 1. 静态文件服务
app.use(express.static(path.resolve(__dirname, "dist")));

// 2. 反向代理（HTTP only — WebSocket 由自定义 upgrade handler 处理）
const proxyOptions = [
  {
    path: "/proxy/openclaw",
    target: "https://192.168.1.2:5173",
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/proxy/openclaw": "" },
  },
  {
    path: "/proxy/admin",
    target: "https://192.168.1.2:18789",
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/proxy/admin": "" },
    on: {
      proxyRes: (proxyRes: import("http").IncomingMessage, _req: import("http").IncomingMessage) => {
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["x-frame-options-allow-from"];
        for (const h of ["content-security-policy", "content-security-policy-report-only"]) {
          const csp = (proxyRes.headers[h] as string | undefined);
          if (csp) {
            proxyRes.headers[h] = csp.replace(/;\s*frame-ancestors[^;]*/, "");
          }
        }
        // sandbox iframe origin=null needs CORS for JS loading
        if (_req.headers.origin) proxyRes.headers["Access-Control-Allow-Origin"] = _req.headers.origin
      },
    },
  },
  {
    path: "/proxy/code",
    target: "http://192.168.1.2:8080",
    changeOrigin: true,
    pathRewrite: { "^/proxy/code": "" },
  },
  {
    path: "/proxy/dev-admin",
    target: "https://192.168.1.2:19001",
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/proxy/dev-admin": "" },
    on: {
      proxyRes: (proxyRes: import("http").IncomingMessage, _req: import("http").IncomingMessage) => {
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["x-frame-options-allow-from"];
        for (const h of ["content-security-policy", "content-security-policy-report-only"]) {
          const csp = (proxyRes.headers[h] as string | undefined);
          if (csp) {
            proxyRes.headers[h] = csp.replace(/;\s*frame-ancestors[^;]*/, "");
          }
        }
        // sandbox iframe origin=null needs CORS for JS loading
        if (_req.headers.origin) proxyRes.headers["Access-Control-Allow-Origin"] = _req.headers.origin
      },
    },
  },
];

// WebSocket 转发目标配置
const wsTargets: { path: string; target: string }[] = [
  { path: "/proxy/admin", target: "wss://192.168.1.2:18789" },
  { path: "/proxy/dev-admin", target: "wss://192.168.1.2:19001" },
];

for (const opts of proxyOptions) {
  const { path: routePath, ...rest } = opts;
  app.use(routePath, createProxyMiddleware(rest));
}

// 3. SPA fallback
app.use((_req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

// 4. 自定义 WebSocket upgrade 路由 — 按 path 分发到对应目标
//    使用 httpxy.proxyUpgrade 直接代理，避免多个 ws:true 冲突
const server = https.createServer(tlsOptions, app);

server.on("upgrade", (req, socket, head) => {
  // 统一 Origin：sandbox null 或子域名 → 统一为 IP:5177
  const origin = req.headers.origin ?? "";
  if (origin === "null" || origin.includes("nip.io")) {
    req.headers.origin = "https://192.168.1.2:5177";
  }
  const url = req.url ?? "";
  for (const { path: routePath, target } of wsTargets) {
    if (url.startsWith(routePath)) {
      proxyUpgrade(target, req, socket, head, { secure: false });
      return;
    }
  }
  socket.destroy();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`claw_manager running at https://192.168.1.2:${PORT}`);
  console.log("  WebClaw    → /proxy/openclaw");
  console.log("  管理后台    → /proxy/admin");
  console.log("  Dev        → /proxy/dev-admin");
  console.log("  Code       → /proxy/code");
  console.log("  WS admin   → wss://192.168.1.2:18789");
  console.log("  WS dev     → wss://192.168.1.2:19001");
});
