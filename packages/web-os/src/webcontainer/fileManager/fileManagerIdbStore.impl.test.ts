import "fake-indexeddb/auto";

import type { FileSystemTree } from "@webcontainer/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileManagerUnknownDriveError } from "./fileManager.errors";
import { FileManagerIdbStore } from "./fileManagerIdbStore.impl";

function makeTree(label: string): FileSystemTree {
  return { [`${label}.txt`]: { file: { contents: label } } };
}

describe("FileManagerIdbStore", () => {
  let dbName: string;
  let store: FileManagerIdbStore;

  beforeEach(() => {
    dbName = `openclaw-fm-unit-${crypto.randomUUID()}`;
    store = new FileManagerIdbStore(dbName);
  });

  afterEach(async () => {
    store.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("deleteDatabase failed"));
    });
  });

  it("createDrive registers drive and listDrives returns it", async () => {
    const id = await store.createDrive({ label: "a" });
    const drives = await store.listDrives();
    expect(drives.some((d) => d.driveId === id)).toBe(true);
    expect(drives[0]!.meta).toEqual({ label: "a" });
  });

  it("pushTreeRecord rejects unknown driveId", async () => {
    await expect(store.pushTreeRecord("no-such-drive", {})).rejects.toThrow(
      FileManagerUnknownDriveError,
    );
  });

  it("pushTreeRecord increments schemaVersion and listRecords sorts", async () => {
    const d = await store.createDrive();
    await store.pushTreeRecord(d, makeTree("v1"));
    await store.pushTreeRecord(d, makeTree("v2"));
    const rows = await store.listRecords(d);
    expect(rows.map((r) => r.schemaVersion)).toEqual([1, 2]);
  });

  it("setCurrentDriveId requires registered drive", async () => {
    await expect(store.setCurrentDriveId("missing")).rejects.toThrow(FileManagerUnknownDriveError);
  });

  it("setCurrentDriveId null clears settings row", async () => {
    const d = await store.createDrive();
    await store.setCurrentDriveId(d);
    expect(await store.getCurrentDriveId()).toBe(d);
    await store.setCurrentDriveId(null);
    expect(await store.getCurrentDriveId()).toBeNull();
  });

  it("resolveMountTreeForDrive writes tip then second resolve hits merged cache", async () => {
    const d = await store.createDrive();
    await store.pushTreeRecord(d, makeTree("a"));
    await store.pushTreeRecord(d, makeTree("b"));

    const first = await store.resolveMountTreeForDrive(d);
    const rowsAfter = await store.listRecords(d);
    const tip = rowsAfter[rowsAfter.length - 1]!;
    expect(tip.isCurrent).toBe(true);
    expect(tip.mergedTree).toBeDefined();

    const second = await store.resolveMountTreeForDrive(d);
    expect(second).toEqual(first);
  });

  it("copyDrive clones records to new driveId", async () => {
    const a = await store.createDrive();
    await store.pushTreeRecord(a, makeTree("x"));
    const b = await store.copyDrive(a);
    expect(b).not.toBe(a);
    const rows = await store.listRecords(b);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tree).toEqual(makeTree("x"));
  });

  it("deleteDrive removes drive rows and clears current if needed", async () => {
    const d = await store.createDrive();
    await store.setCurrentDriveId(d);
    await store.pushTreeRecord(d, makeTree("z"));
    await store.deleteDrive(d);
    expect(await store.getCurrentDriveId()).toBeNull();
    await expect(store.listRecords(d)).rejects.toThrow(FileManagerUnknownDriveError);
  });

  it("patchDriveMeta updates meta", async () => {
    const d = await store.createDrive({ v: 1 });
    await store.patchDriveMeta(d, { v: 2 });
    const drives = await store.listDrives();
    const row = drives.find((x) => x.driveId === d);
    expect(row?.meta).toEqual({ v: 2 });
  });

  it("open is idempotent", async () => {
    await store.open();
    await store.open();
    expect(await store.createDrive()).toBeTruthy();
  });
});
