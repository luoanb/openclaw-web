import type { FileSystemTree, WebContainer } from "@webcontainer/api";

/** 单条扁平日志记录（Spec §3.2）。 */
export interface FileManagerTreeRecord {
  /** 主键；库内生成。 */
  recordId: string;
  /** 所属硬盘；须已在 `drive_registry`。 */
  driveId: string;
  /** 写入时间（ms）；排序展示用，合并次序以 `schemaVersion` 为准。 */
  savedAt: number;
  /** 本条快照 JSON 树。 */
  tree: FileSystemTree;
  /** 仅 tip 上由 merge/挂载写回：全量合并结果缓存。 */
  mergedTree?: FileSystemTree;
  /** 当前合并锚点；同盘至多一条为 `true`。 */
  isCurrent: boolean;
  /** 同盘内世代序号，单调递增。 */
  schemaVersion: number;
}

/** `drive_registry` 一行（§3.4）。`driveId` 由库生成。 */
export interface FileManagerDriveRecord {
  driveId: string;
  /** 宿主扩展；包内不解释。 */
  meta?: Record<string, unknown>;
  createdAt: number;
  /** 最近 push / 改 meta 等会刷新。 */
  updatedAt: number;
}

/** IndexedDB `settings` 单行 KV（`keyPath: key`）。 */
export type FileManagerSettingsKv = {
  key: string;
  value: string;
};

/** `FileManagerSync.start` 选项。 */
export type FileManagerSyncOptions = {
  /** 防抖（ms），默认 400 */
  debounceMs?: number;
  /** 导出根路径（相对 workdir），默认 `.` */
  exportRootPath?: string;
};

/** `resolveMountTreeWithCacheInfo` 的合并结果 + 是否走 tip 缓存。 */
export type ResolveMountTreeResult = {
  tree: FileSystemTree;
  /** `true`：可直接用 tip 上 `mergedTree`，存储层不必 §4.2 写回。 */
  usedTipMergedTreeCache: boolean;
};

/**
 * File Manager 的 IndexedDB 门面：硬盘注册、树日志、默认盘、挂载读路径（§3.4 / §4）。
 * `driveId` / 新条目的 `recordId` 均由实现生成；未注册 `driveId` 会抛 `FileManagerUnknownDriveError`。
 */
export interface IFileManagerIdbStore {
  open(): Promise<void>;
  close(): void;

  /** 注册空盘，返回新 `driveId`。 */
  createDrive(meta?: Record<string, unknown>): Promise<string>;
  /** 复制整盘（新 `driveId`、新 `recordId`，树字段同构；`meta` 浅拷贝）。 */
  copyDrive(sourceDriveId: string): Promise<string>;
  /** 删盘及该盘全部 `tree_records`；若即当前默认盘则清除默认。 */
  deleteDrive(driveId: string): Promise<void>;
  /** 已注册硬盘列表；建议按 `updatedAt` 降序。 */
  listDrives(): Promise<FileManagerDriveRecord[]>;
  /** 替换该盘 `meta`。 */
  patchDriveMeta(driveId: string, meta: Record<string, unknown>): Promise<void>;

  /** 默认盘 `driveId`；未设返回 `null`。 */
  getCurrentDriveId(): Promise<string | null>;
  /** 设默认盘；`null` 清除。非 `null` 须已注册。 */
  setCurrentDriveId(driveId: string | null): Promise<void>;

  /** 该盘树记录，按 `schemaVersion` 排好序。 */
  listRecords(driveId: string): Promise<FileManagerTreeRecord[]>;
  /** 追加快照；`driveId` 须已注册。返回新 `recordId`。 */
  pushTreeRecord(driveId: string, tree: FileSystemTree): Promise<string>;
  /**
   * 供挂载：快路径只读 tip `mergedTree`；慢路径 §4.1.1 算完再 §4.2 写回 tip。
   */
  resolveMountTreeForDrive(driveId: string): Promise<FileSystemTree>;
}

/** 容器内 `fs.watch` → 防抖 export(json) → `pushTreeRecord`。 */
export interface IFileManagerSync {
  start(wc: WebContainer, driveId: string, options?: FileManagerSyncOptions): void;
  stop(): void;
}

/**
 * `FileSystemTreeMerge` 静态侧；路径级合并与 tip/读路径（§4.1 / §4.2）。
 * 纯计算与 `IFileManagerIdbStore` 写库解耦。
 */
export interface FileSystemTreeMergeStatic {
  /** 多棵树顺序叠（后者盖前者）。 */
  mergeFileSystemTrees(trees: FileSystemTree[]): FileSystemTree;
  /** 按 `schemaVersion`，同代按 `recordId`。 */
  sortRecordsBySchemaVersion(records: FileManagerTreeRecord[]): FileManagerTreeRecord[];
  /** 最大 `schemaVersion` 的 tip；同代取 `recordId` 最小。 */
  findTipRecord(records: FileManagerTreeRecord[]): FileManagerTreeRecord | null;
  /** 合并 + 是否命中 tip 上可用 `mergedTree`（不写库）。 */
  resolveMountTreeWithCacheInfo(records: FileManagerTreeRecord[]): ResolveMountTreeResult;
}
