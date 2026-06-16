# Requirements / 需求文档: quick-notes i18n & settings

## Restated Understanding / 需求复述

- 在已有的 `apps/quick-notes` 桌面应用（Tauri v2 + Svelte 5）中，新增多语言支持、Header 菜单入口、设置弹窗与图标系统。
- 当前一期已有 Task、Notes 两个 Tab 及对应的业务功能和本地 JSON 持久化。本期在此之上增加产品化基础设施：国际化、图标库、设置面板。

## Source Baseline / 来源基线

- 应用目录：`apps/quick-notes`
- 技术栈：Tauri v2 + Svelte 5 + Vite + TypeScript + Tailwind CSS 4
- 组件库：shadcn-svelte + bits-ui（已集成）

## Scope / 范围

- **In**:
  - 多语言支持（中文简体 + 英文）
  - Header 右上角 `[...]` 菜单按钮，展开下拉菜单
  - 下拉菜单包含「设置」选项
  - 设置弹窗，内容：语言切换（中文 / English）
  - 图标系统接入（搜索、设置、新增等核心操作）
  - 当前所有静态文本接入 i18n 字典

- **Out**:
  - 多语言切换后的后端/localstore 数据本地化（数据结构不变，不翻译用户数据）
  - 多主题设置
  - 拖拽排序
  - 数据导入导出
  - 键盘快捷键设置
  - 系统托盘
  - 设置面板的数据持久化（首次默认中文，暂不保存用户偏好至 JSON）
  - 第三方 i18n 库依赖（使用轻量自实现，减少 bundle）

## User Interaction / 用户交互

### 交互设计原则

- 设置入口应自然可发现，但不干扰主要操作流程
- 语言切换后立即生效，文案全局刷新
- 图标增强核心操作的可识别性，但不增加视觉噪音
- 设置面板使用模态弹窗，点击遮罩层或「关闭」退出

### Header 菜单

- 触发入口：用户点击 Header 右上角的 `[...]` 图标按钮
- 系统反馈：展开下拉菜单，包含「设置」列表项
- 状态变化：点击 `[...]` 展开 → 点击「设置」或点击外部区域 → 关闭
- 异常/边界：当设置弹窗打开时，点击外部应同时关闭弹窗和下拉菜单

### 设置弹窗

- 触发入口：从 Header 菜单选择「设置」
- 系统反馈：打开模态弹窗
- 用户操作路径：在弹窗内选择「中文」或「English」切换语言
- 状态变化：切换后所有静态文案立即刷新
- 关闭方式：点击弹窗外部遮罩层、点击 X 按钮、按 Esc 键
- 本期不保存语言偏好到磁盘，刷新/重启后默认回中文

### 图标系统

- 搜索框左侧：放大镜图标（搜索）
- 新增按钮：加号图标（新增任务/速记）
- Header 菜单按钮：三点图标（更多操作）
- 设置菜单项：齿轮图标
- 任务完成按钮：勾选图标
- 任务编辑/删除：分别使用编辑/删除图标

## Text Dictionary / 文本字典

### 中文（默认）

| Key | 中文 |
|---|---|
| app.title | 速记 |
| tab.tasks | 任务 |
| tab.notes | 便签 |
| search.placeholder | 搜索当前页 |
| tasks.active | 进行中 |
| tasks.completed | 已完成 |
| tasks.completedCount | 已完成 {count} 项 |
| tasks.addTask | 写一条任务... |
| tasks.editPlaceholder | 编辑任务... |
| notes.addNote | 新增速记 |
| notes.placeholder | 写下速记... |
| notes.empty | 还没有速记。 |
| notes.selectorEmpty | 选择或新增一条速记 |
| notes.selectorHint | 左侧会自动用正文第一行生成标题和摘要，不需要单独维护标题。 |
| notes.searchEmpty | 没有匹配的速记 |
| notes.searchEmptyHint | 清空搜索后会恢复全部速记。 |
| common.cancel | 取消 |
| common.save | 保存 |
| common.delete | 删除 |
| common.settings | 设置 |
| common.language | 语言 |
| common.chinese | 中文 |
| common.english | English |
| settings.title | 设置 |
| settings.language | 语言切换 |
| time.updatedAt | 更新于 |
| time.completedAt | 完成于 |
| error.loadFailed | 读取本地数据失败 |
| error.saveFailed | 保存本地数据失败 |
| error.retry | 重试读取 |
| error.retrySave | 重试保存 |

### English

| Key | English |
|---|---|
| app.title | Quick Notes |
| tab.tasks | Tasks |
| tab.notes | Notes |
| search.placeholder | Search current page |
| tasks.active | Active |
| tasks.completed | Completed |
| tasks.completedCount | Completed {count} |
| tasks.addTask | Write a task... |
| tasks.editPlaceholder | Edit task... |
| notes.addNote | New Note |
| notes.placeholder | Start writing... |
| notes.empty | No notes yet. |
| notes.selectorEmpty | Select or create a note |
| notes.selectorHint | The first line of your note becomes its title and summary. |
| notes.searchEmpty | No matching notes |
| notes.searchEmptyHint | Clearing the search will restore all notes. |
| common.cancel | Cancel |
| common.save | Save |
| common.delete | Delete |
| common.settings | Settings |
| common.language | Language |
| common.chinese | 中文 |
| common.english | English |
| settings.title | Settings |
| settings.language | Language |
| time.updatedAt | Updated at |
| time.completedAt | Completed at |
| error.loadFailed | Failed to load local data |
| error.saveFailed | Failed to save local data |
| error.retry | Retry |
| error.retrySave | Retry Save |
