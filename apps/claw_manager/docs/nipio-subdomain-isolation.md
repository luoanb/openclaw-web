# claw_manager 多 Gateway 管理 — nip.io 子域名隔离方案

> 2026-06-20 | 实现：生产 Gateway（:18789）与 Dev Gateway（:19001）在 claw_manager 中独立共存，登录态互不干扰

---

## 背景

claw_manager 是一个 Express + Svelte 5 的 HTTPS 管理面板（:5177），通过反向代理统一访问多个后端服务。

需求：新增 Dev OpenClaw Gateway tab，与生产 Gateway **登录态完全隔离**，各自独立登录、独立 localStorage。

---

## 核心方案：子域名 origin 隔离

通过不同子域名让浏览器认为两个 iframe 处于不同 origin，localStorage 天然隔离。

| 入口 | URL | Origin | localStorage |
|---|---|---|---|
| 主页面 | `https://192.168.1.2:5177/` | `192.168.1.2:5177` | — |
| 管理后台 iframe | `https://admin.192.168.1.2.nip.io:5177/proxy/admin/` | `admin.192.168.1.2.nip.io:5177` | 独立 ✅ |
| Dev iframe | `https://dev.192.168.1.2.nip.io:5177/proxy/dev-admin/` | `dev.192.168.1.2.nip.io:5177` | 独立 ✅ |

**原理**：浏览器以完整 hostname 判定 origin，不同子域名 = 不同 origin = 不同 localStorage。不需 sandbox，不需处理 `null` origin。

---

## 不使用方案：iframe sandbox（已废弃）

之前尝试用 `<iframe sandbox>` 加 `allow-scripts` 但不加 `allow-same-origin` 来隔离。失败原因：

- sandbox iframe 的 origin 为 `null`（unique opaque origin）
- `null` origin 的 localStorage 在 Chrome 中是 ephemeral（纯内存），浏览器随时回收
- 每次点击"连接"都会生成新设备密钥对 → gateway 认为新设备 → 要求重新审批
- 需要处理 CORS 头、gateway 的 allowedOrigins 不认 `null` 等问题
- **结论：不可行**

---

## 环境准备

### 1. TLS 证书

自签名证书需包含子域名 SAN：

```bash
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /home/lab/192.168.1.2-key.pem \
  -out /home/lab/192.168.1.2.pem \
  -subj "/CN=*.192.168.1.2.nip.io" \
  -addext "subjectAltName=IP:192.168.1.2,DNS:*.192.168.1.2.nip.io,DNS:192.168.1.2.nip.io"
```

SAN 覆盖：

| 用途 | SAN |
|---|---|
| 直接 IP 访问 | `IP:192.168.1.2` |
| 子域名（admin. / dev.） | `*.192.168.1.2.nip.io` |
| 裸域名 | `192.168.1.2.nip.io` |

### 2. 证书信任（可选）

浏览器访问自签名证书的服务时会弹出安全警告。可接受一次例外，或安装到系统信任：

```bash
# Linux 系统信任
sudo cp /home/lab/192.168.1.2.pem /usr/local/share/ca-certificates/
sudo update-ca-certificates

# Chrome NSSDB（需重启 Chrome 生效）
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "OpenClaw Local" -i /home/lab/192.168.1.2.pem
```

### 3. 本地代理排除（关键）

如果本地有 HTTP 代理（如 mihomo/Clash），nip.io 域名不会被 `no_proxy` 中的 IP 段匹配，导致请求走代理而失败：

```bash
# ❌ 原配置：192.168.0.0/16 按 hostname 字符串匹配，不匹配 nip.io
export no_proxy=localhost,127.0.0.1,192.168.0.0/16

# ✅ 修正：加 .nip.io 通配
export no_proxy=localhost,127.0.0.1,192.168.0.0/16,.nip.io
export NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,.nip.io
```

---

## claw_manager 代码改动

### server.ts

关键改动：

1. **WebSocket upgrade handler 统一 Origin**

```typescript
server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin ?? "";
  if (origin === "null" || origin.includes("nip.io")) {
    req.headers.origin = "https://192.168.1.2:5177";
  }
  // 按 path 路由到对应 target
  for (const { path: routePath, target } of wsTargets) {
    if (url.startsWith(routePath)) {
      proxyUpgrade(target, req, socket, head, { secure: false });
      return;
    }
  }
  socket.destroy();
});
```

2. **WebSocket 手动路由** — 使用 `httpxy.proxyUpgrade` 代替 http-proxy-middleware 内置的 `ws: true`，避免多个 ws proxy 冲突。

### App.svelte

```typescript
const iframeServices = [
  {
    label: "管理后台",
    page: "admin",
    url: `https://admin.192.168.1.2.nip.io:${window.location.port}/proxy/admin/`,
  },
  {
    label: "Dev",
    page: "dev-admin",
    url: `https://dev.192.168.1.2.nip.io:${window.location.port}/proxy/dev-admin/`,
  },
];
```

- iframe URL 使用子域名（不同 origin）
- 去掉 `sandbox` 属性（不需要了）
- 去掉 CORS 头反射（同源 iframe 不需要）

### Gateway allowedOrigins（无需改动）

两个 Gateway 的 `allowedOrigins` 保持现有配置 `["https://192.168.1.2:5177", "https://192.168.1.2:5173"]`。upgrade handler 会将子域名 origin 统一改写为 IP origin，所以 gateway 始终看到白名单内的值。

---

## 完整架构

```
用户浏览器 → https://192.168.1.2:5177/（claw_manager，唯一入口）
├─ 管理后台 tab
│   <iframe src="https://admin.192.168.1.2.nip.io:5177/proxy/admin/">
│     → claw_manager 代理 → 生产 Gateway (:18789)
│     → origin = admin.192.168.1.2.nip.io → localStorage 独立
│
├─ Dev tab
│   <iframe src="https://dev.192.168.1.2.nip.io:5177/proxy/dev-admin/">
│     → claw_manager 代理 → Dev Gateway (:19001)
│     → origin = dev.192.168.1.2.nip.io → localStorage 独立
│
└─ Code tab
    <iframe src="https://192.168.1.2:8080/">（直连 code-server）
```

---

## 问题记录

| 阶段 | 问题 | 原因 | 解决 |
|---|---|---|---|
| Phase 1 | iframe 同源 → localStorage 共享 | 默认同源 | 子域名隔离 |
| Phase 1 | sandbox 方案 localStorage 被 Chrome 回收 | opaque origin ephemeral 存储 | 废弃 sandbox，改子域名 |
| Phase 2 | 浏览器访问 nip.io 报"终止连接" | 本地代理拦截了 nip.io 域名 | no_proxy 加 `.nip.io` |
| Phase 2 | 多个 ws:true proxy 冲突 | http-proxy-middleware 的 pathFilter 默认 `/` | 改用 httpxy.proxyUpgrade 手动路由 |

---

## 验证命令

```bash
# 测试服务是否在线
curl -sk -o /dev/null -w "%{http_code}" https://admin.192.168.1.2.nip.io:5177/
# 预期：200

# 测试 dev 子域名
curl -sk -o /dev/null -w "%{http_code}" https://dev.192.168.1.2.nip.io:5177/proxy/dev-admin/health
# 预期：200
```