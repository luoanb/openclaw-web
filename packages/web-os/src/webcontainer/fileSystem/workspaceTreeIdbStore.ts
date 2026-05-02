import type { FileSystemTree } from "@webcontainer/api";
import { WORKSPACE_IDB_NAME } from "../workspaceConstants";
import { IdbQuotaError, InvalidSnapshotError } from "./errors";
import type { WorkspaceTreeSnapshotRecord } from "./types";
import { assertValidFileSystemTree } from "./treeGuard";
import { assertSnapshotRecordPayload } from "./snapshotPayload";

const DB_VERSION = 2;
const STORE = "snapshots";

export type PutSnapshotInput =
  | {
      workspaceKey: string;
      exportRootPath: string;
      exportKind: "json-tree";
      tree: FileSystemTree;
    }
  | {
      workspaceKey: string;
      exportRootPath: string;
      exportKind: "binary-snapshot" | "zip-archive";
      binaryPayload: ArrayBuffer;
    };

export class WorkspaceTreeIdbStore {
  private db: IDBDatabase | null = null;

  constructor(private readonly dbName: string = WORKSPACE_IDB_NAME) {}

  async open(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION);
      req.onerror = () => reject(req.error ?? new Error("indexedDB.open failed"));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: "snapshotId" });
          os.createIndex("workspaceKey", "workspaceKey", { unique: false });
          os.createIndex("savedAt", "savedAt", { unique: false });
        }
      };
    });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  async putSnapshot(input: PutSnapshotInput): Promise<string> {
    const snapshotId = crypto.randomUUID();
    let record: WorkspaceTreeSnapshotRecord;

    if (input.exportKind === "json-tree") {
      assertValidFileSystemTree(input.tree);
      record = {
        schemaVersion: 2,
        snapshotId,
        workspaceKey: input.workspaceKey,
        exportRootPath: input.exportRootPath,
        exportKind: input.exportKind,
        tree: input.tree,
        savedAt: Date.now(),
      };
    } else {
      if (!input.binaryPayload || input.binaryPayload.byteLength === 0) {
        throw new InvalidSnapshotError("binaryPayload 无效或为空");
      }
      record = {
        schemaVersion: 2,
        snapshotId,
        workspaceKey: input.workspaceKey,
        exportRootPath: input.exportRootPath,
        exportKind: input.exportKind,
        binaryPayload: input.binaryPayload,
        savedAt: Date.now(),
      };
    }

    assertSnapshotRecordPayload(record);

    await this.open();
    try {
      await idbRequest(this.db!.transaction(STORE, "readwrite").objectStore(STORE).put(record));
    } catch (e) {
      throw mapIdbWriteError(e);
    }
    return snapshotId;
  }

  async getSnapshot(snapshotId: string): Promise<WorkspaceTreeSnapshotRecord> {
    await this.open();
    const raw = await idbRequest<WorkspaceTreeSnapshotRecord | undefined>(
      this.db!.transaction(STORE, "readonly").objectStore(STORE).get(snapshotId),
    );
    if (!raw) {
      throw new InvalidSnapshotError(`快照不存在: ${snapshotId}`);
    }
    if (raw.schemaVersion !== 2) {
      throw new InvalidSnapshotError(`不支持的 schemaVersion: ${raw.schemaVersion}`);
    }
    assertSnapshotRecordPayload(raw);
    return raw;
  }

  async listSnapshots(workspaceKey: string): Promise<WorkspaceTreeSnapshotRecord[]> {
    await this.open();
    const store = this.db!.transaction(STORE, "readonly").objectStore(STORE);
    const idx = store.index("workspaceKey");
    const rows = await idbRequest<WorkspaceTreeSnapshotRecord[]>(idx.getAll(workspaceKey));
    rows.sort((a, b) => b.savedAt - a.savedAt);
    return rows;
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.open();
    await idbRequest(this.db!.transaction(STORE, "readwrite").objectStore(STORE).delete(snapshotId));
  }
}

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
