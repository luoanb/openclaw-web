import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import type { IWebOsRuntime } from "./runtime.interfaces";
import { FileManagerIdbStore } from "../fileManager/fileManagerIdbStore.impl";
import type { IFileManagerIdbStore } from "../fileManager/fileManager.interfaces";
import { tree as minimalSeedTree } from "../minimalWorkspaceTemplate";

/**
 * Web OS WebContainer 运行时：当前盘挂载、换盘、导入快照与 §5.2 干净挂载（先 `mount({})`）。
 *
 * **`startCompleted`**：首次 `start()` 成功落地当前盘后即为 true；之后 **`start()`** 只返回同一 `wc`，不再重复 `open`/挂载（单例 `boot` 本身也只执行一次）。换盘见 **`switchDriveAndBoot`**。
 */
export class WebOsRuntime implements IWebOsRuntime {
  readonly fileStore: IFileManagerIdbStore;

  private wcSingleton: Promise<WebContainer> | null = null;

  /** 首次 `start()` 已成功完成引导与当前盘挂载后为 true。 */
  private startCompleted = false;

  constructor(fileStore?: IFileManagerIdbStore) {
    this.fileStore = fileStore ?? new FileManagerIdbStore();
  }

  private getOrBootWc(): Promise<WebContainer> {
    this.wcSingleton ??= WebContainer.boot();
    return this.wcSingleton;
  }

  /**
   * §5.2：同一挂载目标下先挂空树，再挂真实树；官方无 unmount。
   */
  private async cleanMountThenApply(
    wc: WebContainer,
    mountReal: () => Promise<void>,
  ): Promise<void> {
    await wc.mount({});
    await mountReal();
  }

  private async mountWorkspaceFromCurrentDrive(wc: WebContainer): Promise<void> {
    let driveId = await this.fileStore.getCurrentDriveId();
    if (!driveId) {
      driveId = await this.fileStore.createDrive();
      await this.fileStore.setCurrentDriveId(driveId);
      await this.fileStore.pushTreeRecord(driveId, minimalSeedTree);
    }

    const tree = await this.fileStore.resolveMountTreeForDrive(driveId);

    await this.cleanMountThenApply(wc, async () => {
      await wc.mount(tree);
    });
  }

  async start(): Promise<WebContainer> {
    const wc = await this.getOrBootWc();
    if (this.startCompleted) {
      return wc;
    }

    await this.fileStore.open();
    await this.mountWorkspaceFromCurrentDrive(wc);
    this.startCompleted = true;
    return wc;
  }

  async mount(wc: WebContainer, payload: FileSystemTree | ArrayBuffer): Promise<void> {
    await this.cleanMountThenApply(wc, async () => {
      await wc.mount(payload);
    });
  }

  async switchDriveAndBoot(driveId: string): Promise<WebContainer> {
    await this.fileStore.open();
    await this.fileStore.setCurrentDriveId(driveId);

    const wc = await this.getOrBootWc();
    await this.mountWorkspaceFromCurrentDrive(wc);
    return wc;
  }
}

/** 包内默认运行时实例。 */
export const webOsRuntime = new WebOsRuntime();
