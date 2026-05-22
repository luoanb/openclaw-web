import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import type { IFileManagerIdbStore } from "../fileManager/fileManager.interfaces";

/**
 * WebContainer 会话编排：单例容器、`start` 挂当前盘、`switchDriveAndBoot` 换盘、`mount` 导入快照。
 *
 * 干净挂载（§5.2）：正式树之前先 `mount({})`，详见实现注释。
 */
export interface IWebOsRuntime {
  readonly fileStore: IFileManagerIdbStore;

  /** 首次：`boot` + 当前盘挂载；之后：直接返回同一 `wc`（不重复引导）。换盘用 `switchDriveAndBoot`。 */
  start(): Promise<WebContainer>;

  /** §5.2 → `wc.mount(payload)`。 */
  mount(wc: WebContainer, payload: FileSystemTree | ArrayBuffer): Promise<void>;

  /** `setCurrentDriveId` → §5.2 → 挂新当前盘树。 */
  switchDriveAndBoot(driveId: string): Promise<WebContainer>;
}
