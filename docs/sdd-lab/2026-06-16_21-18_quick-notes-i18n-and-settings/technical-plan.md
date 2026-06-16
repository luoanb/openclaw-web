# Technical Plan / 技术方案: quick-notes i18n & settings

## Architecture / 整体架构

### 新增文件树

```
src/lib/core/i18n/
├── types.ts              # 类型定义
├── zh.ts                 # 中文词典
├── en.ts                 # 英文词典
├── store.ts              # Svelte 5 reactive store (locale state, t helper)
src/lib/features/settings/
├── SettingsModal.svelte   # 设置弹窗
├── LanguageSwitcher.svelte # 语言切换组件
src/lib/features/common/
├── HeaderMenu.svelte      # Header 三点菜单 + 下拉
├── Icons.svelte           # 图标组件（统一管理 SVG）
```

### 修改文件

```
src/App.svelte                        # 接入 i18n provider、HeaderMenu
src/lib/features/notes/NoteEditor.svelte     # 替换文本为 $t(...)
src/lib/features/notes/NotesSidebar.svelte   # 同上
src/lib/features/notes/NotesTab.svelte       # 同上
src/lib/features/tasks/TaskComposer.svelte   # 同上
src/lib/features/tasks/TaskList.svelte       # 同上
src/lib/features/tasks/TaskRow.svelte        # 同上
src/lib/features/tasks/TasksTab.svelte       # 同上
```

## Step 1: i18n 基础设施

### 设计考量

- 不使用第三方 i18n 库（`i18next`、`typesafe-i18n` 等），减少 bundle 体积
- 使用 Svelte 5 的 `$state` / `$derived` runes 实现响应式多语言
- 所有静态文本归入字典文件，组件中通过 `$t(key)` 调用
- 字典类型安全：`t()` 参数接受联合类型（所有 key 的字符串字面量）

### 实现细节

**`i18n/types.ts`**

```typescript
export type Locale = "zh" | "en";

export type TranslationKey =
  | "app.title"
  | "tab.tasks"
  | "tab.notes"
  // ... (所有 key 联合类型)

export type Dictionary = Record<TranslationKey, string>;
export type Dictionaries = Record<Locale, Dictionary>;
```

**`i18n/store.ts`**

```typescript
import { getContext, setContext } from "svelte";

const LOCALE_KEY = Symbol("locale");

export function createLocaleStore() {
  let locale = $state<Locale>("zh");

  function t(key: TranslationKey): string {
    return dictionaries[currentLocale][key] ?? key;
  }

  function setLocale(l: Locale) {
    locale = l;
  }

  return { get locale() { return locale; }, t, setLocale };
}

export type LocaleStore = ReturnType<typeof createLocaleStore>;
```

注意：Svelte 5 不支持在 `.ts` 文件中使用 `$state` rune（只在 `.svelte` 文件内有效）。因此 `createLocaleStore` 需在 `.svelte.js` 文件中实现，或使用 Svelte 5 的 module script 与 getContext/setContext 模式。

**推荐方案**：在 `App.svelte` 中创建 store，通过 `setContext` 注入，子组件通过 `getContext` 获取。`$state` 在 `.svelte` 文件中使用是合法的。

### 调用方式

组件中使用：

```svelte
<script lang="ts">
  import { getLocaleStore } from "$lib/core/i18n/store";

  const { t } = getLocaleStore();
</script>

<h1>{t("app.title")}</h1>
```

## Step 2: 图标系统

### 方案

- 不引入 lucide-svelte 等图标库，而是使用内联 SVG 组件
- 创建 `Icons.svelte` 统一管理，按 `icon name` prop 渲染对应 SVG
- 图标列表：search（放大镜）、plus（加号）、more-horizontal（三点）、settings（齿轮）、check（勾选）、edit（铅笔）、trash（删除）、close（X）

### 实现

```svelte
<!-- src/lib/features/common/Icons.svelte -->
<script lang="ts">
  let { name, class: className = "size-4" }: { name: IconName; class?: string } = $props();
</script>

{#if name === "search"}
  <svg class={className} ...>...</svg>
{:else if name === "plus"}
  ...
{/if}
```

### 图标来源

使用 SVG 标准图标路径，参考 [Lucide](https://lucide.dev/icons/) 的公共域 SVG 路径。

## Step 3: Header Menu

### 交互

- Header 右上角新增 `[...]` 图标按钮
- 点击展开下拉菜单，当前只有「设置」
- 点击「设置」→ 打开设置弹窗，下拉菜单关闭
- 点击外部区域关闭下拉菜单
- 下拉菜单位置：与按钮右对齐

### 实现

- `HeaderMenu.svelte`：独立组件，嵌入 `App.svelte` Header 右侧
- 使用简单的 `$state(isOpen)` + `click outside` 事件处理
- 菜单项列表可扩展（后续添加更多设置项）

## Step 4: Settings Modal

### 交互

- 模态弹窗，居中显示
- 遮罩层（半透明黑色），点击关闭
- 右上角 X 按钮关闭
- Esc 键关闭
- 内容：标题「设置」、语言切换 Radio / Toggle
- 语言切换即时生效

### 实现

- `SettingsModal.svelte`：接收 `open` / `onClose` props
- 使用 `svelte:window` 监听 Esc 键
- 语言切换使用 native radio group 或 shadcn-svelte 的 RadioGroup

## Step 5: 文本替换

- 逐文件替换所有硬编码中文为 `{t("key.name")}`
- 变量插值使用 `$derived` 或模板字符串拼接

## Dependencies / 依赖

- 无新增 npm 依赖（图标使用内联 SVG，i18n 使用自实现）

## Risks / 风险

- Svelte 5 中 `.ts` 文件不支持 `$state` rune：需在 `.svelte(.js)` 文件或组件 script 中声明
- 字典覆盖不全：需逐一检查所有 `.svelte` 文件中的中文/英文硬编码文本
- i18n store 通过 setContext/getContext 传递：Svelte 5 中 getContext 需在组件初始化阶段同步调用
