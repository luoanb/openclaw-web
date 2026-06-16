# Packaging Fixes / 打包问题修复记录

## Context / 背景

- 目标应用：`apps/quick-notes`
- 触发时间：2026-06-16 17:53
- 触发问题：
  - 生产包生成后，Windows 可执行文件 / 安装包图标不符合预期。
  - 启动应用时会先打开一个空白终端窗口；关闭该终端窗口时，应用也随之退出。

## Diagnosis / 诊断

- 图标配置位于 `apps/quick-notes/src-tauri/tauri.conf.json`，当前引用 `src-tauri/icons/*` 下的多尺寸图标文件。
- 当前源图标为 `apps/quick-notes/src-tauri/icons/icon.svg`；为避免 `.ico` / PNG / Windows bundle 图标不一致，应从该源 SVG 重新生成整套 Tauri 图标资源。
- 空白终端窗口是 Windows release 二进制仍使用 console subsystem 的典型表现。
- 对 Tauri / Rust Windows GUI 应用，应在 `src-tauri/src/main.rs` 顶部添加：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```

## Fix Plan / 修复方案

1. 在 `apps/quick-notes/src-tauri/src/main.rs` 顶部添加 release-only Windows GUI subsystem 标记。
2. 使用 Tauri CLI 从 `src-tauri/icons/icon.svg` 重新生成 `src-tauri/icons` 下的图标资源。
3. 使用 `pnpm --filter quick-notes tauri build --bundles nsis` 重新生成 Windows NSIS 安装包。

## Validation / 验证

- 已执行：
  - `pnpm --filter quick-notes tauri icon src-tauri/icons/icon.svg`
  - `pnpm --filter quick-notes tauri build --bundles nsis`
- 验收标准：
  - [x] Rust release 编译通过。
  - [x] NSIS 安装包生成成功。
  - [x] 新安装包使用重新生成后的应用图标资源。
  - [x] release 二进制已配置 Windows GUI subsystem，启动时不应再出现空白终端窗口。

## Result / 结果

- 产物路径：

```text
C:\Users\LUOANB~1\AppData\Local\Temp\cursor-sandbox-cache\b005e4c97a8ffbffb8edcc230684afad\cargo-target\release\bundle\nsis\速记_0.0.0_x64-setup.exe
```

- 说明：`pnpm --filter quick-notes tauri build --bundles nsis` 已完成；前端 `svelte-check` 0 errors / 0 warnings；Rust release 编译完成；NSIS 安装包生成成功。
- 剩余注意：Vite 仍提示 Crepe 相关 bundle size warning，不影响本轮图标与控制台窗口修复。
