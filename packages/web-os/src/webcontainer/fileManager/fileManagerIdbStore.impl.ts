import type { FileSystemTree } from "@webcontainer/api";
import { IdbQuotaError } from "../fileSystem/errors";
import { assertValidFileSystemTree } from "../fileSystem/treeGuard";
import {
  FILE_MANAGER_DB_VERSION,
  FILE_MANAGER_IDB_NAME,
  FILE_MANAGER_TREE_STORE,
} from "./fileManager.constants";
import type { FileManagerTreeRecord, IFileManagerIdbStore } from "./fileManager.interfaces";
import { FileSystemTreeMerge } from "./mergeTrees.impl";

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

function mapIdbWriteError(e: unknown): Error {
  if (e instanceof DOMException && e.name === "QuotaExceededError") {
    return new IdbQuotaError();
  }
  return e instanceof Error ? e : new Error(String(e));
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

export class FileManagerIdbStore implements IFileManagerIdbStore {
  private db: IDBDatabase | null = null;

  constructor(private readonly dbName: string = FILE_MANAGER_IDB_NAME) {}

  async open(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.dbName, FILE_MANAGER_DB_VERSION);
      req.onerror = () => reject(req.error ?? new Error("indexedDB.open failed"));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(FILE_MANAGER_TREE_STORE)) {
          const os = db.createObjectStore(FILE_MANAGER_TREE_STORE, { keyPath: "recordId" });
          os.createIndex("driveId", "driveId", { unique: false });
          os.createIndex("savedAt", "savedAt", { unique: false });
          os.createIndex("schemaVersion", "schemaVersion", { unique: false });
          os.createIndex("isCurrent", "isCurrent", { unique: false });
        }
      };
    });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  async listRecords(driveId: string): Promise<FileManagerTreeRecord[]> {
    await this.open();
    const store = this.db!.transaction(FILE_MANAGER_TREE_STORE, "readonly").objectStore(
      FILE_MANAGER_TREE_STORE,
    );
    const idx = store.index("driveId");
    const rows = await idbRequest<FileManagerTreeRecord[]>(idx.getAll(driveId));
    return FileSystemTreeMerge.sortRecordsBySchemaVersion(rows);
  }

  async pushTreeRecord(driveId: string, tree: FileSystemTree): Promise<string> {
    assertValidFileSystemTree(tree);
    await this.open();

    const existing = await this.listRecords(driveId);
    const nextSv =
      existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.schemaVersion)) + 1;

    const recordId = crypto.randomUUID();
    const record: FileManagerTreeRecord = {
      recordId,
      driveId,
      savedAt: Date.now(),
      tree,
      isCurrent: false,
      schemaVersion: nextSv,
    };

    try {
      await idbRequest(
        this.db!.transaction(FILE_MANAGER_TREE_STORE, "readwrite").objectStore(FILE_MANAGER_TREE_STORE).put(
          record,
        ),
      );
    } catch (e) {
      throw mapIdbWriteError(e);
    }
    return recordId;
  }

  /**
   * §4.1.1 + §4.2：计算合并结果并写入 tip 的 `mergedTree` / `isCurrent`。
   */
  async mergeDriveToBootTree(driveId: string): Promise<FileSystemTree> {
    await this.open();
    const records = await this.listRecords(driveId);
    if (records.length === 0) return {};

    const merged = FileSystemTreeMerge.computeMergedForDrive(records);
    assertValidFileSystemTree(merged);

    const sorted = FileSystemTreeMerge.sortRecordsBySchemaVersion(records);
    const tip = FileSystemTreeMerge.findTipRecord(sorted);
    if (!tip) return {};

    const prevCurrent = sorted.find((r) => r.isCurrent === true);

    const tx = this.db!.transaction(FILE_MANAGER_TREE_STORE, "readwrite");
    const os = tx.objectStore(FILE_MANAGER_TREE_STORE);

    try {
      if (prevCurrent && prevCurrent.recordId !== tip.recordId) {
        await idbRequest(
          os.put({
            ...prevCurrent,
            isCurrent: false,
          }),
        );
      }

      await idbRequest(
        os.put({
          ...tip,
          mergedTree: merged,
          isCurrent: true,
        }),
      );
      await transactionDone(tx);
    } catch (e) {
      throw mapIdbWriteError(e);
    }

    return merged;
  }

  /** 启动挂载（Spec §4.2 读路径），不改库。 */
  async resolveMountTreeForDrive(driveId: string): Promise<FileSystemTree> {
    const records = await this.listRecords(driveId);
    return FileSystemTreeMerge.resolveMountTree(records);
  }
}
