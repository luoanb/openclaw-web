import type { WebContainer } from "@webcontainer/api";
import { assertValidFileSystemTree } from "../fileSystem/treeGuard";
import type { IFileManagerIdbStore, IFileManagerSync, FileManagerSyncOptions } from "./fileManager.interfaces";

/**
 * `fs.watch` + 防抖 `export(format: json)` + `pushTreeRecord`（Spec §3.3）。
 */
export class FileManagerSync implements IFileManagerSync {
  private watching: ReturnType<WebContainer["fs"]["watch"]> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly store: IFileManagerIdbStore) {}

  /**
   * 注册监听并在变更后持久化 JSON 树；**不写** `mergedTree` / `isCurrent`。
   */
  start(wc: WebContainer, driveId: string, options?: FileManagerSyncOptions): void {
    this.stop();
    const debounceMs = options?.debounceMs ?? 400;
    const exportRootPath = options?.exportRootPath ?? ".";

    const scheduleFlush = (): void => {
      if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        void this.flushExport(wc, driveId, exportRootPath);
      }, debounceMs);
    };

    this.watching = wc.fs.watch(
      exportRootPath,
      { recursive: true },
      () => {
        scheduleFlush();
      },
    );
  }

  stop(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.watching?.close();
    this.watching = null;
  }

  private async flushExport(
    wc: WebContainer,
    driveId: string,
    exportRootPath: string,
  ): Promise<void> {
    try {
      const tree = await wc.export(exportRootPath, { format: "json" });
      assertValidFileSystemTree(tree);
      await this.store.pushTreeRecord(driveId, tree);
    } catch {
      // 导出/校验失败时静默跳过，避免打断终端；上层可用日志扩展
    }
  }
}
