# Spec: Quick Notes Note Autosave

## Goal

- 要解决什么问题：将 Header 中的“速记”Tab 展示文案改为“便签”，并抽象一个可复用的定时 diff 自动保存工具；便签编辑区只是本轮第一个应用场景。
- 验收结果：用户编辑便签后无需手动点击“保存”也能在定时触发时保存变更；无更新时不重复保存。

## Done Contract

- Header 展示为“任务 / 便签”，点击“便签”仍进入现有 notes 工作区。
- 便签编辑器定时检查当前 Markdown；内容 trim 后非空且相对上次提交有变化时保存，无变化或空白时跳过。
- 用户切换 Tab 导致编辑器组件销毁，或切换选中便签导致编辑器实例替换时，应在清理前主动提交一次未保存变更。
- 自动保存复用现有 `onCreateNote(content)` / `onUpdateNote(noteId, content)` 链路，并继续使用现有保存失败提示与“重试保存”入口。

## Scope

- In:
  - `apps/quick-notes/src/App.svelte` 中 Header Tab 文案 `速记` -> `便签`。
  - 新增公共自动保存工具，建议路径为 `apps/quick-notes/src/lib/core/autosave/diff-auto-saver.ts`。
  - `apps/quick-notes/src/lib/features/notes/NoteEditor.svelte` 接入公共工具，完成便签编辑器的定时 diff 自动保存。
  - 切换 Tab、切换选中便签、退出创建态等销毁/替换编辑器实例的场景，触发一次 flush 提交。
  - 保留手动“保存”按钮，作为即时保存入口。
- Out:
  - 不改应用名、窗口标题、安装包名称、文件名。
  - 不改 `QuickNote` / `notes` / `content` 数据结构和 Tauri `load_store` / `save_store` 命令。
  - 不实现历史版本、冲突合并、多窗口协作、云同步。

## Facts / Constraints

- 已确认事实：
  - 当前 `NoteEditor.svelte` 使用 Milkdown Crepe，通过 `markdownUpdated` 同步 `draft`。
  - 当前保存只由“保存”按钮触发，回调到上层 `createNote` / `updateNote`，再由 `App.svelte` 的 `persist()` 保存本地 JSON。
  - 当前 `persist()` 已具备保存失败提示和 `pendingStore` 重试机制。
- 技术/业务约束：
  - 自动保存必须复用现有保存链路，不新增第二套持久化入口。
  - 公共工具不包含 NoteEditor、Crepe、Markdown、QuickNote 或本地 JSON 等业务语义。
  - 公共工具以类封装状态与行为，符合 `core/**` 可复用逻辑优先使用 class 的项目约定。
  - 空白便签不能创建或保存。
  - 无更新时必须跳过保存，避免定时器造成重复写入。
  - 销毁或替换前的 flush 仍必须执行同样的空内容和 diff 判断，不应无条件写入。
- 已知风险：
  - 创建态自动保存后会切换为已有便签，需要确保旧 interval 清理。
  - Crepe 实例切换时应在销毁前读取并提交当前内容，随后停止 interval，避免销毁后继续读取旧实例。

## Open Questions

- [x] 自动保存间隔是否需要用户可配置？
  - 处理：本轮不配置，采用代码内常量，建议 3000ms。
- [x] 自动保存是否替代手动保存按钮？
  - 处理：不替代，手动保存保留。
- [x] 自动保存工具是否应绑定 NoteEditor 命名？
  - 处理：不绑定。采用公共命名 `DiffAutoSaver`，编辑器保存只是本次应用场景。

## Restated Understanding

- 我理解当前任务是：按 sdd-light 处理一个小范围 quick-notes 增量，先固化 micro-spec，再等待执行批准。
- 当前核心目标是：让“速记”Tab 在 UI 上变为“便签”，并以公共 `DiffAutoSaver` 支撑便签正文的定时 diff 自动保存。
- 当前边界是：处理前端文案、公共自动保存工具和便签编辑器接入。
- 暂不处理：数据结构、Tauri 后端、安装包命名、任务功能、跨窗口冲突。

## 接口契约设计

```ts
type DiffAutoSaverOptions<T> = {
  intervalMs: number;
  readSnapshot: () => T;
  submitSnapshot: (snapshot: T) => void;
  normalizeSnapshot?: (snapshot: T) => T;
  canSubmit?: (snapshot: T) => boolean;
  isEqual?: (left: T, right: T) => boolean;
};

class DiffAutoSaver<T> {
  constructor(initialSnapshot: T, options: DiffAutoSaverOptions<T>);

  start(): void; // 启动定时 tick；重复调用不重复创建 interval。
  stop(): void; // 停止定时 tick。
  tick(): void; // 读取快照 -> 规范化 -> 可提交判断 -> diff -> submit。
  flush(): void; // 立即执行一次 tick，用于组件销毁、切换记录等离开场景。
  markCommitted(snapshot: T): void; // 手动保存或自动保存发起后同步基线。
  dispose(options?: { flush?: boolean }): void; // 可选先 flush，再清理 interval。
}
```

应用约定：

- `DiffAutoSaver` 不知道编辑器类型，只处理泛型快照。
- 便签场景使用 `string` 作为快照类型。
- `NoteEditor.svelte` 负责提供 `readSnapshot()`，优先读取 `crepeEditor.getMarkdown()`，失败时回退 `draft`。
- 便签场景的 `normalizeSnapshot` 使用 `trim()`，`canSubmit` 保证空字符串不提交。
- `NoteEditor.svelte` 在 Svelte effect cleanup 中调用 `dispose({ flush: true })`，覆盖切换 Tab、切换选中便签、创建态切换等实例离开场景。

## Goal Alignment Check

- 当前动作是否仍服务于核心目标：是，已将自动保存从 NoteEditor 专用方案修订为公共工具方案。
- 若否，偏差在哪里：无。
- 是否需要调整本轮目标或范围：不需要。

## Checkpoint Summary

- 当前任务理解：本轮按 `sdd-light` 处理，不继续向 `docs/sdd-lab/` 新增 sidecar 文档。
- 当前核心目标：完成“便签”文案、公共 `DiffAutoSaver` 工具与便签编辑器接入。
- 当前进度：micro-spec 已形成，待用户批准进入代码实现。
- 下一步 1：修改 `App.svelte` Tab 文案。
- 下一步 2：新增 `DiffAutoSaver` 公共工具，封装 interval、diff、flush、提交基线和清理。
- 下一步 3：修改 `NoteEditor.svelte`，接入 `DiffAutoSaver` 并复用手动保存提交逻辑。
- 涉及文件 / 模块：
  - `apps/quick-notes/src/App.svelte`
  - `apps/quick-notes/src/lib/core/autosave/diff-auto-saver.ts`
  - `apps/quick-notes/src/lib/features/notes/NoteEditor.svelte`
- 风险：公共工具 API 需要保持足够通用，同时避免为未来场景过度设计；自动保存定时器与 Crepe 生命周期切换需要正确清理，离开场景的 flush 不能绕过 diff 判断。
- 验证方式：`pnpm --filter quick-notes check`；必要时 `pnpm --filter quick-notes build`。
- Execution Approval: `Approved`

## Change Log

- 2026-06-16 18:22: 新建本轮 micro-spec，标准位置为 `docs/micro_specs/2026-06-16_18-22_quick-notes-note-autosave.md`。
- 2026-06-16 18:25: 按用户要求将 `NoteEditorAutosave` 修订为公共 `DiffAutoSaver` 工具；便签编辑器保存只是本轮应用场景。
- 2026-06-16 18:28: 补充离开场景保存要求：切换 Tab、切换选中便签或组件销毁前需 flush 一次未提交变更，避免丢数据。
- 2026-06-16 18:32: 完成实现：新增公共 `DiffAutoSaver`；`NoteEditor.svelte` 接入定时保存与 cleanup flush；Header Tab 文案改为“便签”。

## Validation

- Self-check: 已确认 `DiffAutoSaver` 不包含 NoteEditor、Crepe、Markdown、QuickNote 或本地 JSON 等业务语义；`NoteEditor.svelte` 在 effect cleanup 中调用 `dispose({ flush: true })`。
- Static checks: `pnpm --filter quick-notes check` 通过，`svelte-check` 0 errors / 0 warnings。
- Runtime / Test: `pnpm --filter quick-notes build` 通过；仍存在既有 Crepe chunk size warning。
- Human confirmation: 用户已要求“开始执行”。
- 结果汇总：Svelte/TypeScript 检查通过，Vite production build 通过。
- 核心目标是否已由证据证明完成：已由静态检查和构建验证证明代码层可用。
- 若未完成，当前剩余差距：仍建议做桌面手动验证，确认定时保存和切换场景 flush 的真实交互体验。
- 剩余风险：自动保存和离开前 flush 已接入现有保存链路，但尚未在 Tauri 桌面窗口中人工验证本地 JSON 写入时机。

## Resume / Handoff

- 当前状态：实现完成，等待人工验证。
- 当前卡点：未做 Tauri 桌面窗口手动验证。
- 下一步唯一动作：运行桌面应用，手动验证编辑便签后等待 3 秒、切换便签、切换 Tab 都会触发现有保存链路。
- 下一轮核心目标：完成桌面人工验证；若发现保存时机偏差，先回写本 spec 再修代码。
