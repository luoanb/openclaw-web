import type { FileSystemTree } from "@webcontainer/api";
import { describe, expect, it } from "vitest";
import type { FileManagerTreeRecord } from "./fileManager.interfaces";
import { InvalidSnapshotError } from "../fileSystem/errors";
import { FileSystemTreeMerge } from "./mergeTrees.impl";

function rec(
  partial: Omit<FileManagerTreeRecord, "driveId" | "savedAt"> &
    Partial<Pick<FileManagerTreeRecord, "driveId" | "savedAt">>,
): FileManagerTreeRecord {
  return {
    driveId: "d1",
    savedAt: 0,
    ...partial,
  };
}

describe("FileSystemTreeMerge.mergeFileSystemTrees", () => {
  it("returns empty for empty input list", () => {
    expect(FileSystemTreeMerge.mergeFileSystemTrees([])).toEqual({});
  });

  it("returns clone of single tree", () => {
    const t: FileSystemTree = { "a.txt": { file: { contents: "1" } } };
    const out = FileSystemTreeMerge.mergeFileSystemTrees([t]);
    expect(out).toEqual(t);
    expect(out).not.toBe(t);
  });

  it("later tree overlays earlier on name conflict at root", () => {
    const a: FileSystemTree = { "x.txt": { file: { contents: "a" } } };
    const b: FileSystemTree = { "x.txt": { file: { contents: "b" } } };
    const out = FileSystemTreeMerge.mergeFileSystemTrees([a, b]);
    expect(out["x.txt"]).toEqual({ file: { contents: "b" } });
  });

  it("merges directories recursively", () => {
    const a: FileSystemTree = {
      src: { directory: { "a.ts": { file: { contents: "a" } } } },
    };
    const b: FileSystemTree = {
      src: { directory: { "b.ts": { file: { contents: "b" } } } },
    };
    const out = FileSystemTreeMerge.mergeFileSystemTrees([a, b]);
    expect(out.src).toEqual({
      directory: {
        "a.ts": { file: { contents: "a" } },
        "b.ts": { file: { contents: "b" } },
      },
    });
  });

  it("replaces file with directory when later tree has directory at same name", () => {
    const a: FileSystemTree = { x: { file: { contents: "f" } } };
    const b: FileSystemTree = {
      x: { directory: { "y.txt": { file: { contents: "d" } } } },
    };
    expect(FileSystemTreeMerge.mergeFileSystemTrees([a, b]).x).toEqual({
      directory: { "y.txt": { file: { contents: "d" } } },
    });
  });
});

describe("FileSystemTreeMerge.sortRecordsBySchemaVersion", () => {
  it("sorts by schemaVersion then recordId", () => {
    const records = [
      rec({ recordId: "c", tree: {}, isCurrent: false, schemaVersion: 2 }),
      rec({ recordId: "a", tree: {}, isCurrent: false, schemaVersion: 1 }),
      rec({ recordId: "b", tree: {}, isCurrent: false, schemaVersion: 1 }),
    ];
    const sorted = FileSystemTreeMerge.sortRecordsBySchemaVersion(records);
    expect(sorted.map((r) => r.recordId)).toEqual(["a", "b", "c"]);
  });
});

describe("FileSystemTreeMerge.findTipRecord", () => {
  it("returns null for empty list", () => {
    expect(FileSystemTreeMerge.findTipRecord([])).toBeNull();
  });

  it("picks max schemaVersion and lexicographically smallest recordId on tie", () => {
    const records = [
      rec({ recordId: "z", tree: {}, isCurrent: false, schemaVersion: 2 }),
      rec({ recordId: "m", tree: {}, isCurrent: false, schemaVersion: 3 }),
      rec({ recordId: "a", tree: {}, isCurrent: false, schemaVersion: 3 }),
    ];
    const tip = FileSystemTreeMerge.findTipRecord(records);
    expect(tip?.recordId).toBe("a");
  });
});

describe("FileSystemTreeMerge.resolveMountTreeWithCacheInfo", () => {
  it("returns empty tree when no records", () => {
    expect(FileSystemTreeMerge.resolveMountTreeWithCacheInfo([])).toEqual({
      tree: {},
      usedTipMergedTreeCache: false,
    });
  });

  it("uses tip mergedTree when anchor matches tip with valid cache", () => {
    const merged: FileSystemTree = { "cached.txt": { file: { contents: "ok" } } };
    const records = [
      rec({
        recordId: "tip",
        tree: { "other.txt": { file: { contents: "x" } } },
        mergedTree: merged,
        isCurrent: true,
        schemaVersion: 2,
      }),
    ];
    const r = FileSystemTreeMerge.resolveMountTreeWithCacheInfo(records);
    expect(r.usedTipMergedTreeCache).toBe(true);
    expect(r.tree).toEqual(merged);
  });

  it("throws when fast-path mergedTree is invalid", () => {
    const records = [
      rec({
        recordId: "tip",
        tree: {},
        mergedTree: { bad: "x" } as unknown as FileSystemTree,
        isCurrent: true,
        schemaVersion: 1,
      }),
    ];
    expect(() => FileSystemTreeMerge.resolveMountTreeWithCacheInfo(records)).toThrow(
      InvalidSnapshotError,
    );
  });

  it("computes merge without cache when tip is not the isCurrent anchor", () => {
    const records = [
      rec({
        recordId: "r1",
        tree: { "a.txt": { file: { contents: "1" } } },
        mergedTree: { "a.txt": { file: { contents: "old" } } },
        isCurrent: true,
        schemaVersion: 1,
      }),
      rec({
        recordId: "r2",
        tree: { "a.txt": { file: { contents: "2" } } },
        isCurrent: false,
        schemaVersion: 2,
      }),
    ];
    const r = FileSystemTreeMerge.resolveMountTreeWithCacheInfo(records);
    expect(r.usedTipMergedTreeCache).toBe(false);
    expect(r.tree["a.txt"]).toEqual({ file: { contents: "2" } });
  });

  it("merges anchor mergedTree with tail records (§4.1.1 incremental path)", () => {
    const mergedBase: FileSystemTree = { "base.txt": { file: { contents: "m" } } };
    const records = [
      rec({
        recordId: "r1",
        tree: { "only-r1.txt": { file: { contents: "ignored-in-this-path" } } },
        mergedTree: mergedBase,
        isCurrent: true,
        schemaVersion: 1,
      }),
      rec({
        recordId: "r2",
        tree: { "base.txt": { file: { contents: "tail" } } },
        isCurrent: false,
        schemaVersion: 2,
      }),
    ];
    const r = FileSystemTreeMerge.resolveMountTreeWithCacheInfo(records);
    expect(r.usedTipMergedTreeCache).toBe(false);
    expect(r.tree).toEqual({
      "base.txt": { file: { contents: "tail" } },
    });
  });

  it("falls back to full merge when anchor mergedTree is invalid", () => {
    const records = [
      rec({
        recordId: "r1",
        tree: { "a.txt": { file: { contents: "1" } } },
        mergedTree: { bad: true } as unknown as FileSystemTree,
        isCurrent: true,
        schemaVersion: 1,
      }),
      rec({
        recordId: "r2",
        tree: { "a.txt": { file: { contents: "2" } } },
        isCurrent: false,
        schemaVersion: 2,
      }),
    ];
    const r = FileSystemTreeMerge.resolveMountTreeWithCacheInfo(records);
    expect(r.usedTipMergedTreeCache).toBe(false);
    expect(r.tree["a.txt"]).toEqual({ file: { contents: "2" } });
  });
});
