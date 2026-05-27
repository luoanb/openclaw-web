# Iconography / 图标规范

## Decision

- `apps/web-claw` 统一使用 `@hugeicons/svelte` + `@hugeicons/core-free-icons`。
- 业务组件不得直接 import Hugeicons 图标对象；先通过 `$lib/components/icon` 的项目级 `Icon` 组件和注册表使用。
- 图标默认用于辅助识别，不替代关键文字。只有 icon-only button 可以只显示图标，但必须提供可读 `aria-label`。
- Workbench 密度默认使用 `size-3.5` 到 `size-4`，与 Bits UI / shadcn-svelte 的紧凑按钮尺寸一致。

## Accessibility

- 装饰性图标必须 `aria-hidden="true"`。
- 传达状态或作为唯一可见内容的图标必须有文本、`aria-label` 或同级状态文案。
- 状态不得只靠颜色表达；运行中、失败、不可用等状态需要图标 + 文案共同表达。

## Missing Icon Checklist

- [x] Top-level tabs: Terminal / Files / Preview.
- [x] Runtime status entry: status badge and More action.
- [x] Files panel: refresh, save, file tree expand/collapse/file/folder, tab close, context menu create/rename/delete.
- [x] Terminal panel: title, status, cwd, run button, blocked runtime state, notices/errors.
- [x] Runtime drawer: title, boot/stop actions, session and capability cards, warning/error states.
- [ ] Preview panel: placeholder state, refresh/open-external actions when implemented.
- [ ] Global UI primitives still importing Hugeicons directly should be migrated opportunistically when those primitives are touched.

## Done Contract

This iteration is done when `apps/web-claw` has a project-level icon wrapper, high-frequency Workbench surfaces no longer use raw character placeholders for icon semantics, and Svelte diagnostics remain clean.
