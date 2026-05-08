import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import type { IFileManagerIdbStore } from "../fileManager/fileManager.interfaces";

/**
 * WebContainer 会话编排：单例容器、`start` 挂当前盘、`switchDriveAndBoot` 换盘、`mount` 导入快照。
 *
 * 干净挂载（§5.2）：正式树之前先 `mount({})`，详见实现注释。
 */
export interface IWebOsRuntime {
  readonly fileStore: IFileManagerIdbStore;

  /** `boot` → 按当前默认盘解析树并挂载（含 §5.2 前置空树）。 */
  start(): Promise<WebContainer>;

  /** §5.2 → `wc.mount(payload)`；标记来源为 import。 */
  mount(wc: WebContainer, payload: FileSystemTree | ArrayBuffer): Promise<void>;

  /** `setCurrentDriveId` → §5.2 → 挂新当前盘树。 */
  switchDriveAndBoot(driveId: string): Promise<WebContainer>;
}
