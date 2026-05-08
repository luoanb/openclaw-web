import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import type { IWebOsRuntime } from "./runtime.interfaces";
import { FileManagerIdbStore } from "../fileManager/fileManagerIdbStore.impl";
import type { IFileManagerIdbStore } from "../fileManager/fileManager.interfaces";
import { tree as minimalSeedTree } from "../minimalWorkspaceTemplate";

type MountKind = "none" | "filemanager" | "import";

/**
 * Web OS WebContainer 运行时：当前盘挂载、换盘、导入快照与 §5.2 干净挂载（先 `mount({})`）。
 */
export class WebOsRuntime implements IWebOsRuntime {
  readonly fileStore: IFileManagerIdbStore;

  private wcSingleton: Promise<WebContainer> | null = null;

  private mountKind: MountKind = "none";

  private lastFilemanagerDriveId: string | null = null;

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

    this.mountKind = "filemanager";
    this.lastFilemanagerDriveId = driveId;
  }

  async start(): Promise<WebContainer> {
    const wc = await this.getOrBootWc();
    await this.fileStore.open();

    if (this.mountKind === "import") {
      return wc;
    }

    const driveId = await this.fileStore.getCurrentDriveId();
    if (
      this.mountKind === "filemanager" &&
      driveId !== null &&
      this.lastFilemanagerDriveId === driveId
    ) {
      return wc;
    }

    await this.mountWorkspaceFromCurrentDrive(wc);
    return wc;
  }

  async mount(wc: WebContainer, payload: FileSystemTree | ArrayBuffer): Promise<void> {
    await this.cleanMountThenApply(wc, async () => {
      await wc.mount(payload);
    });
    this.mountKind = "import";
  }

  async switchDriveAndBoot(driveId: string): Promise<WebContainer> {
    await this.fileStore.open();
    await this.fileStore.setCurrentDriveId(driveId);
    this.mountKind = "none";
    this.lastFilemanagerDriveId = null;

    const wc = await this.getOrBootWc();
    await this.mountWorkspaceFromCurrentDrive(wc);
    return wc;
  }
}

/** 包内默认运行时实例。 */
export const webOsRuntime = new WebOsRuntime();
