# bcryptjs — 负控（预期在 WC 内可用）

`bcryptjs` 为纯 JavaScript 实现，**不应**出现在 `blockedEntries` 阻断名单中。

在 WebContainers 内：

```bash
npm install
node probe.mjs
```

预期输出含 `ok: bcryptjs`。
