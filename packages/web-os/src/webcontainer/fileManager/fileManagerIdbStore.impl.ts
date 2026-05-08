import type { FileSystemTree } from "@webcontainer/api";
import { IdbQuotaError } from "../fileSystem/errors";
import { assertValidFileSystemTree } from "../fileSystem/treeGuard";
import {
  FILE_MANAGER_DB_VERSION,
  FILE_MANAGER_DRIVE_STORE,
  FILE_MANAGER_IDB_NAME,
  FILE_MANAGER_SETTINGS_KEY_CURRENT_DRIVE,
  FILE_MANAGER_SETTINGS_STORE,
  FILE_MANAGER_TREE_STORE,
} from "./fileManager.constants";
import { FileManagerUnknownDriveError } from "./fileManager.errors";
import type {
  FileManagerDriveRecord,
  FileManagerSettingsKv,
  FileManagerTreeRecord,
  IFileManagerIdbStore,
} from "./fileManager.interfaces";
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

function cloneMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return { ...meta };
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
        const tx = (ev.target as IDBOpenDBRequest).transaction!;
        const { oldVersion } = ev;

        if (!db.objectStoreNames.contains(FILE_MANAGER_TREE_STORE)) {
          const os = db.createObjectStore(FILE_MANAGER_TREE_STORE, { keyPath: "recordId" });
          os.createIndex("driveId", "driveId", { unique: false });
          os.createIndex("savedAt", "savedAt", { unique: false });
          os.createIndex("schemaVersion", "schemaVersion", { unique: false });
          os.createIndex("isCurrent", "isCurrent", { unique: false });
        }

        if (!db.objectStoreNames.contains(FILE_MANAGER_DRIVE_STORE)) {
          db.createObjectStore(FILE_MANAGER_DRIVE_STORE, { keyPath: "driveId" });
        }

        if (!db.objectStoreNames.contains(FILE_MANAGER_SETTINGS_STORE)) {
          db.createObjectStore(FILE_MANAGER_SETTINGS_STORE, { keyPath: "key" });
        }

        if (
          oldVersion < 2 &&
          db.objectStoreNames.contains(FILE_MANAGER_TREE_STORE) &&
          db.objectStoreNames.contains(FILE_MANAGER_DRIVE_STORE)
        ) {
          const treeStore = tx.objectStore(FILE_MANAGER_TREE_STORE);
          const driveStore = tx.objectStore(FILE_MANAGER_DRIVE_STORE);
          const getAllReq = treeStore.getAll() as IDBRequest<FileManagerTreeRecord[]>;
          getAllReq.onsuccess = () => {
            const rows = getAllReq.result ?? [];
            const maxSavedAtByDrive = new Map<string, number>();
            for (const r of rows) {
              const prev = maxSavedAtByDrive.get(r.driveId) ?? 0;
              if (r.savedAt > prev) maxSavedAtByDrive.set(r.driveId, r.savedAt);
            }
            for (const [driveId, savedAt] of maxSavedAtByDrive) {
              driveStore.put({
                driveId,
                createdAt: savedAt,
                updatedAt: savedAt,
              });
            }
          };
        }
      };
    });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  private async getDriveRow(driveId: string): Promise<FileManagerDriveRecord | undefined> {
    await this.open();
    const store = this.db!.transaction(FILE_MANAGER_DRIVE_STORE, "readonly").objectStore(
      FILE_MANAGER_DRIVE_STORE,
    );
    return idbRequest<FileManagerDriveRecord | undefined>(store.get(driveId));
  }

  private async assertDriveRegistered(driveId: string): Promise<void> {
    const row = await this.getDriveRow(driveId);
    if (!row) throw new FileManagerUnknownDriveError(driveId);
  }

  async createDrive(meta?: Record<string, unknown>): Promise<string> {
    await this.open();
    const driveId = crypto.randomUUID();
    const now = Date.now();
    const row: FileManagerDriveRecord = {
      driveId,
      createdAt: now,
      updatedAt: now,
      ...(meta !== undefined ? { meta: cloneMeta(meta) } : {}),
    };
    try {
      await idbRequest(
        this.db!.transaction(FILE_MANAGER_DRIVE_STORE, "readwrite").objectStore(FILE_MANAGER_DRIVE_STORE).put(
          row,
        ),
      );
    } catch (e) {
      throw mapIdbWriteError(e);
    }
    return driveId;
  }

  async copyDrive(sourceDriveId: string): Promise<string> {
    await this.assertDriveRegistered(sourceDriveId);
    const sourceDrive = await this.getDriveRow(sourceDriveId);
    if (!sourceDrive) throw new FileManagerUnknownDriveError(sourceDriveId);

    const records = await this.listRecords(sourceDriveId);
    const newDriveId = crypto.randomUUID();
    const now = Date.now();

    const newDriveRow: FileManagerDriveRecord = {
      driveId: newDriveId,
      createdAt: now,
      updatedAt: now,
      ...(sourceDrive.meta !== undefined ? { meta: cloneMeta(sourceDrive.meta as Record<string, unknown>) } : {}),
    };

    try {
      const tx = this.db!.transaction(
        [FILE_MANAGER_DRIVE_STORE, FILE_MANAGER_TREE_STORE],
        "readwrite",
      );
      const driveOs = tx.objectStore(FILE_MANAGER_DRIVE_STORE);
      const treeOs = tx.objectStore(FILE_MANAGER_TREE_STORE);

      await idbRequest(driveOs.put(newDriveRow));

      for (const r of records) {
        const copy: FileManagerTreeRecord = {
          ...r,
          recordId: crypto.randomUUID(),
          driveId: newDriveId,
        };
        await idbRequest(treeOs.put(copy));
      }

      await transactionDone(tx);
    } catch (e) {
      throw mapIdbWriteError(e);
    }

    return newDriveId;
  }

  async deleteDrive(driveId: string): Promise<void> {
    await this.assertDriveRegistered(driveId);

    const current = await this.getCurrentDriveId();
    if (current === driveId) {
      await this.setCurrentDriveId(null);
    }

    try {
      const tx = this.db!.transaction(
        [FILE_MANAGER_DRIVE_STORE, FILE_MANAGER_TREE_STORE],
        "readwrite",
      );
      const driveOs = tx.objectStore(FILE_MANAGER_DRIVE_STORE);
      const treeOs = tx.objectStore(FILE_MANAGER_TREE_STORE);
      const idx = treeOs.index("driveId");
      const rows = await idbRequest<FileManagerTreeRecord[]>(idx.getAll(driveId));
      for (const r of rows) {
        await idbRequest(treeOs.delete(r.recordId));
      }
      await idbRequest(driveOs.delete(driveId));
      await transactionDone(tx);
    } catch (e) {
      throw mapIdbWriteError(e);
    }
  }

  async listDrives(): Promise<FileManagerDriveRecord[]> {
    await this.open();
    const store = this.db!.transaction(FILE_MANAGER_DRIVE_STORE, "readonly").objectStore(
      FILE_MANAGER_DRIVE_STORE,
    );
    const all = await idbRequest<FileManagerDriveRecord[]>(store.getAll());
    return [...all].sort(
      (a, b) => b.updatedAt - a.updatedAt || a.driveId.localeCompare(b.driveId),
    );
  }

  async patchDriveMeta(driveId: string, meta: Record<string, unknown>): Promise<void> {
    await this.assertDriveRegistered(driveId);
    const prev = await this.getDriveRow(driveId);
    if (!prev) throw new FileManagerUnknownDriveError(driveId);
    const row: FileManagerDriveRecord = {
      ...prev,
      meta: cloneMeta(meta),
      updatedAt: Date.now(),
    };
    try {
      await idbRequest(
        this.db!.transaction(FILE_MANAGER_DRIVE_STORE, "readwrite").objectStore(FILE_MANAGER_DRIVE_STORE).put(
          row,
        ),
      );
    } catch (e) {
      throw mapIdbWriteError(e);
    }
  }

  async getCurrentDriveId(): Promise<string | null> {
    await this.open();
    const store = this.db!.transaction(FILE_MANAGER_SETTINGS_STORE, "readonly").objectStore(
      FILE_MANAGER_SETTINGS_STORE,
    );
    const row = await idbRequest<FileManagerSettingsKv | undefined>(
      store.get(FILE_MANAGER_SETTINGS_KEY_CURRENT_DRIVE),
    );
    return row?.value ?? null;
  }

  async setCurrentDriveId(driveId: string | null): Promise<void> {
    await this.open();
    const store = this.db!.transaction(FILE_MANAGER_SETTINGS_STORE, "readwrite").objectStore(
      FILE_MANAGER_SETTINGS_STORE,
    );
    try {
      if (driveId === null) {
        await idbRequest(store.delete(FILE_MANAGER_SETTINGS_KEY_CURRENT_DRIVE));
        return;
      }
      await this.assertDriveRegistered(driveId);
      await idbRequest(
        store.put({
          key: FILE_MANAGER_SETTINGS_KEY_CURRENT_DRIVE,
          value: driveId,
        } satisfies FileManagerSettingsKv),
      );
    } catch (e) {
      if (e instanceof FileManagerUnknownDriveError) throw e;
      throw mapIdbWriteError(e);
    }
  }

  async listRecords(driveId: string): Promise<FileManagerTreeRecord[]> {
    await this.assertDriveRegistered(driveId);
    const store = this.db!.transaction(FILE_MANAGER_TREE_STORE, "readonly").objectStore(
      FILE_MANAGER_TREE_STORE,
    );
    const idx = store.index("driveId");
    const rows = await idbRequest<FileManagerTreeRecord[]>(idx.getAll(driveId));
    return FileSystemTreeMerge.sortRecordsBySchemaVersion(rows);
  }

  async pushTreeRecord(driveId: string, tree: FileSystemTree): Promise<string> {
    assertValidFileSystemTree(tree);
    await this.assertDriveRegistered(driveId);

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
      const tx = this.db!.transaction(
        [FILE_MANAGER_TREE_STORE, FILE_MANAGER_DRIVE_STORE],
        "readwrite",
      );
      const treeOs = tx.objectStore(FILE_MANAGER_TREE_STORE);
      const driveOs = tx.objectStore(FILE_MANAGER_DRIVE_STORE);

      await idbRequest(treeOs.put(record));

      const driveRow = await idbRequest<FileManagerDriveRecord | undefined>(driveOs.get(driveId));
      if (!driveRow) throw new FileManagerUnknownDriveError(driveId);
      await idbRequest(
        driveOs.put({
          ...driveRow,
          updatedAt: Date.now(),
        }),
      );

      await transactionDone(tx);
    } catch (e) {
      if (e instanceof FileManagerUnknownDriveError) throw e;
      throw mapIdbWriteError(e);
    }
    return recordId;
  }

  /**
   * 挂载用树（Spec §4.2）：tip 快路径则只读；否则计算后在返回前 §4.2 写回，避免下次重复折叠。
   */
  async resolveMountTreeForDrive(driveId: string): Promise<FileSystemTree> {
    await this.assertDriveRegistered(driveId);
    const records = await this.listRecords(driveId);
    const { tree, usedTipMergedTreeCache } =
      FileSystemTreeMerge.resolveMountTreeWithCacheInfo(records);
    if (!usedTipMergedTreeCache && records.length > 0) {
      assertValidFileSystemTree(tree);
      await this.writeMergedToTip(records, tree);
    }
    return tree;
  }

  /** §4.2：将 `merged` 写到当前 tip，并轮换 `isCurrent`。 */
  private async writeMergedToTip(
    records: FileManagerTreeRecord[],
    merged: FileSystemTree,
  ): Promise<void> {
    const sorted = FileSystemTreeMerge.sortRecordsBySchemaVersion(records);
    const tip = FileSystemTreeMerge.findTipRecord(sorted);
    if (!tip) return;

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
  }
}
