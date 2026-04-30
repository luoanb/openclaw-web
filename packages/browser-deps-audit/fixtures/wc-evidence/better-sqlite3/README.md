# better-sqlite3 — WebContainers 证据（wc-runtime）

在 **WebContainers**（或 `node --no-addons` 等效环境）于本目录执行：

```bash
npm install
node probe.mjs
```

## 日志（粘贴区）

在 WC 内典型失败形态包含 **无法加载 native addon** / `ERR_DLOPEN_FAILED` 等（以实际环境输出为准）。将完整 stderr 贴于此，并更新 `native-risk-packages.json` 中对应条目的 `verifiedAt`。

本仓库 **Tier-1 CI 不执行** 本 fixture 的安装与 probe（避免在宿主机拉取 native）；由 **Tier-2** 人工或定时在 WC 中更新本节。
