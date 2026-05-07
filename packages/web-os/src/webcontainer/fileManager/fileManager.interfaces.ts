import type { FileSystemTree } from "@webcontainer/api";
import type { WebContainer } from "@webcontainer/api";

/** 单条扁平日志记录（Spec §3.2）。`schemaVersion` 为同盘内单调递增的世代号。 */
export interface FileManagerTreeRecord {
  recordId: string;
  driveId: string;
  savedAt: number;
  tree: FileSystemTree;
  mergedTree?: FileSystemTree;
  isCurrent: boolean;
  schemaVersion: number;
}

export type FileManagerSyncOptions = {
  /** 防抖间隔（ms），默认 400 */
  debounceMs?: number;
  /** 相对工作区的导出根路径，默认 `.`（与 `EXPORT_ROOT_PATH` 对齐） */
  exportRootPath?: string;
};

/** IndexedDB 侧存储与合并（实例契约）。 */
export interface IFileManagerIdbStore {
  open(): Promise<void>;
  close(): void;
  listRecords(driveId: string): Promise<FileManagerTreeRecord[]>;
  pushTreeRecord(driveId: string, tree: FileSystemTree): Promise<string>;
  mergeDriveToBootTree(driveId: string): Promise<FileSystemTree>;
  resolveMountTreeForDrive(driveId: string): Promise<FileSystemTree>;
}

/** `fs.watch` 同步器（实例契约）。 */
export interface IFileManagerSync {
  start(wc: WebContainer, driveId: string, options?: FileManagerSyncOptions): void;
  stop(): void;
}

/** `FileSystemTreeMerge` 静态侧契约（路径级合并、读路径辅助）。 */
export interface FileSystemTreeMergeStatic {
  mergeFileSystemTrees(trees: FileSystemTree[]): FileSystemTree;
  sortRecordsBySchemaVersion(records: FileManagerTreeRecord[]): FileManagerTreeRecord[];
  findTipRecord(records: FileManagerTreeRecord[]): FileManagerTreeRecord | null;
  computeMergedForDrive(records: FileManagerTreeRecord[]): FileSystemTree;
  resolveMountTree(records: FileManagerTreeRecord[]): FileSystemTree;
}
