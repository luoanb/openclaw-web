import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5177;

// TLS 证书
const tlsOptions = {
  key: fs.readFileSync("/home/lab/192.168.1.2-key.pem"),
  cert: fs.readFileSync("/home/lab/192.168.1.2.pem"),
};

// 1. 静态文件服务（生产构建产物）
app.use(express.static(path.resolve(__dirname, "dist")));

// 2. 反向代理：将 /proxy/* 转发到各后端服务，实现同源访问
//    ws: true 让 middleware 自动订阅 server upgrade 事件处理 WebSocket
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
    ws: true,
    pathRewrite: { "^/proxy/admin": "" },
    on: {
      proxyRes: (proxyRes: import("http").IncomingMessage) => {
        // 去掉 CSP frame-ancestors，允许 iframe 嵌入
        const csp = (proxyRes.headers["content-security-policy"] as string | undefined);
        if (csp) {
          proxyRes.headers["content-security-policy"] = csp.replace(/;\s*frame-ancestors[^;]*/, "");
        }
      },
    },
  },
  {
    path: "/proxy/code",
    target: "http://192.168.1.2:8080",
    changeOrigin: true,
    pathRewrite: { "^/proxy/code": "" },
  },
];

for (const opts of proxyOptions) {
  const { path, ...rest } = opts;
  app.use(path, createProxyMiddleware(rest));
}

// 3. SPA fallback — 所有非静态/非 proxy 路径返回 index.html
app.use((_req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

// 4. 启动 HTTPS 服务
//    注意: ws: true 的 proxy 会在首次请求时自动订阅 server upgrade 事件
//    所以不需要手动绑定 upgrade handler
const server = https.createServer(tlsOptions, app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`claw_manager running at https://192.168.1.2:${PORT}`);
  console.log("  WebClaw    → /proxy/openclaw");
  console.log("  管理后台    → /proxy/admin");
  console.log("  Code       → /proxy/code");
});
