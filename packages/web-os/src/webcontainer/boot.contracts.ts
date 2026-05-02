import type { FileSystemTree, WebContainer } from "@webcontainer/api";

/**
 * WebContainer 单例引导与工作区挂载（模板 / 导入）的对外契约。
 *
 * - **`boot`**：多次调用共享同一容器实例（Promise 缓存）。
 * - **`ensureWorkspace`**：若尚未通过导入挂载过，则首次将内置最小模板 `mount`；已挂载则立即返回。
 * - **`mountImportedWorkspace`**：按官方 `mount` 语义恢复树或二进制快照，并标记已挂载，此后 `ensureWorkspace` 不再套用模板。
 */
export interface IBoot {
  boot(): Promise<WebContainer>;
  ensureWorkspace(wc: WebContainer): Promise<void>;
  mountImportedWorkspace(
    wc: WebContainer,
    payload: FileSystemTree | ArrayBuffer,
  ): Promise<void>;
}

/**
 * @deprecated 请使用 {@link IBoot}。
 */
export type IWebOsBoot = IBoot;
