# SDD - Claw Manager 软件设计说明

| 属性 | 值 |
|------|-----|
| 项目名称 | claw_manager |
| 版本 | v1.0 |
| 状态 | 已上线 |
| 创建日期 | 2026-06-06 |
| 最后更新 | 2026-06-06 |

---

## 1. 系统概述

### 1.1 项目定位

**Claw Manager** 是 OpenClaw Web 的统一管理入口，通过单一的 HTTPS 界面集成多个后台服务，解决多服务、多证书、混合内容（Mixed Content）等体验问题。

### 1.2 核心功能

| 功能 | 描述 |
|------|------|
| 服务集成 | 通过 iframe 嵌入三个核心服务：WebClaw、管理后台、Code |
| 同源代理 | 使用 Node.js 反向代理消除 Mixed Content 和证书警告 |
| 全屏模式 | 支持 iframe 内容全屏展示 |
| 侧边栏导航 | 折叠式侧边栏，快速切换服务 |

### 1.3 目标用户

- OpenClaw 运维人员
- 开发人员

---

## 2. 架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (HTTPS)                        │
│                     https://192.168.1.2:5177                │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js HTTPS Server + Proxy                   │
│                        port: 5177                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │  静态文件    │  │           反向代理 (http-proxy)     │  │
│  │ (Svelte App)│  │                                     │  │
│  │   /dist/    │  │  /proxy/openclaw → 5173 (HTTPS)    │  │
│  │             │  │  /proxy/admin    → 18789 (HTTPS)   │  │
│  │             │  │  /proxy/code    → 8080 (HTTP)      │  │
│  └─────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | Svelte | 5.x |
| 构建工具 | Vite | 7.x |
| UI 组件 | bits-ui | latest |
| 样式 | Tailwind CSS | 4.x |
| 后端代理 | Express + http-proxy-middleware | latest |
| HTTPS | Node.js native (self-signed cert) | - |

---

## 3. 功能模块设计

### 3.1 模块结构

```
src/
├── App.svelte              # 根组件：布局 + 路由状态
├── main.ts                 # 入口文件
├── routes/
│   ├── Home.svelte         # 首页（预留）
│   └── Settings.svelte     # 设置页（预留）
└── lib/
    ├── components/
    │   ├── layout/
    │   │   ├── AppSidebar.svelte    # 侧边栏导航
    │   │   └── MainContent.svelte   # 主内容区（iframe 容器）
    │   ├── ui/
    │   │   └── button/              # 按钮组件
    │   └── icon/
    │       ├── Icon.svelte          # 图标组件
    │       └── icons.ts             # 图标定义
    └── hooks/
        └── is-mobile.svelte.ts      # 响应式检测
```

### 3.2 核心模块说明

#### 3.2.1 App.svelte（根组件）

**职责**：
- 管理全局状态（activePage, sidebarCollapsed, activeIframeUrl, isFullscreen）
- 定义服务配置（iframeServices）
- 处理导航逻辑

**关键状态**：

```typescript
let activePage = $state("home");           // 当前激活的页面
let sidebarCollapsed = $state(true);       // 侧边栏是否折叠
let activeIframeUrl = $state<string | null>(null);  // 当前 iframe URL
let isFullscreen = $state(false);          // 全屏模式
```

#### 3.2.2 AppSidebar.svelte（侧边栏导航）

**职责**：
- 展示服务列表
- 处理点击导航
- 支持折叠/展开

#### 3.2.3 MainContent.svelte（主内容区）

**职责**：
- 渲染 iframe 容器
- 处理全屏逻辑
- 响应式布局

#### 3.2.4 server.ts（Node.js 代理服务器）

**职责**：
- 提供 HTTPS 服务
- 静态文件服务（生产构建产物）
- 反向代理到各后端服务

---

## 4. 界面设计

### 4.1 布局结构

```
┌─────┬──────────────────────────────────────┐
│     │  Header (h-11)                       │
│ 侧  │  ┌────────────────────────────────┐  │
│ 边  │  │                                │  │
│ 栏  │  │       iframe 容器              │  │
│     │  │       (MainContent)            │  │
│     │  │                                │  │
│     │  └────────────────────────────────┘  │
└─────┴──────────────────────────────────────┘
```

### 4.2 服务配置

| 服务名称 | 图标 | 页面标识 | 代理路径 |
|----------|------|----------|----------|
| WebClaw | globe | openclaw | /proxy/openclaw |
| 管理后台 | dashboard | admin | /proxy/admin |
| Code | code | code-server | /proxy/code |

### 4.3 UI 规范

- **色彩**：使用 Tailwind CSS 默认主题（slate/gray 基色）
- **间距**：基于 4px 网格系统
- **交互**：hover 状态使用 `bg-muted`，过渡使用 `transition-colors`

---

## 5. 接口设计

### 5.1 代理路由

| 路径 | 目标服务 | 目标端口 | 说明 |
|------|----------|----------|------|
| `/proxy/openclaw/*` | OpenClaw Web | 5173 | 去除前缀 |
| `/proxy/admin/*` | 管理后台 | 18789 | 去除前缀 |
| `/proxy/code/*` | Code-server | 8080 | 去除前缀 |

### 5.2 代理配置

```typescript
const proxyConfig = {
  changeOrigin: true,
  secure: false,           // 跳过自签名证书校验
  pathRewrite: { "^/proxy/xxx": "" },
  // WebSocket 支持（需额外配置 ws: true）
};
```

### 5.3 本地开发代理

开发环境使用 Vite Proxy，配置见 `vite.config.ts`，逻辑与生产环境一致。

---

## 6. 数据流

### 6.1 用户交互流程

```
用户点击侧边栏
    ↓
navigate(page) 被调用
    ↓
查找对应服务的 url
    ↓
更新 activeIframeUrl 状态
    ↓
MainContent 渲染 <iframe src={activeIframeUrl}>
    ↓
浏览器通过同源代理请求目标服务
```

### 6.2 请求流程

```
浏览器请求 https://192.168.1.2:5177/proxy/openclaw/xxx
    ↓
Node.js server.ts 接收请求
    ↓
http-proxy-middleware 匹配路由 /proxy/openclaw
    ↓
转发到 https://192.168.1.2:5173/xxx（去除前缀）
    ↓
响应返回，浏览器收到同源 HTTPS 响应
    ↓
iframe 正常渲染，无 Mixed Content 警告
```

---

## 7. 部署与运行

### 7.1 环境要求

- Node.js 22.6+（支持 `--experimental-strip-types`）
- pnpm

### 7.2 运行命令

```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build

# 生产运行
pnpm start
```

### 7.3 证书配置

自签名证书存放路径：`cert/`
- `cert/key.pem` — 私钥
- `cert/cert.pem` — 证书

---

## 8. 已知限制

| 限制 | 说明 |
|------|------|
| 绝对路径资源 | 被代理服务中的绝对路径资源可能无法正确加载 |
| WebSocket | 需要额外配置 `ws: true` 支持 code-server 终端 |
| 自签名证书 | 首次访问需接受一次证书警告 |

---

## 9. 附录

### 9.1 相关文档

| 文档 | 路径 |
|------|------|
| 解决方案文档 | `../SOLUTION.md` |
| 项目规范 | `../AGENTS.md` |
| 证书配置 | `../cert/` |

### 9.2 变更历史

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-06-06 | 初始 SDD 创建 | 阿七 |
