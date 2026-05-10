import { describe, expect, it } from "vitest";
import type { WorkspaceTreeSnapshotRecord } from "./types";
import { InvalidSnapshotError } from "./errors";
import {
  assertSnapshotRecordPayload,
  exportKindIsImportable,
} from "./snapshotPayload";

function base(
  overrides: Partial<WorkspaceTreeSnapshotRecord> &
    Pick<WorkspaceTreeSnapshotRecord, "exportKind">,
): WorkspaceTreeSnapshotRecord {
  return {
    schemaVersion: 2,
    snapshotId: "snap-1",
    workspaceKey: "wk",
    exportRootPath: ".",
    savedAt: Date.now(),
    ...overrides,
  };
}

describe("exportKindIsImportable", () => {
  it("marks json-tree and binary-snapshot as importable", () => {
    expect(exportKindIsImportable("json-tree")).toBe(true);
    expect(exportKindIsImportable("binary-snapshot")).toBe(true);
  });

  it("marks zip-archive as not importable via mount", () => {
    expect(exportKindIsImportable("zip-archive")).toBe(false);
  });
});

describe("assertSnapshotRecordPayload", () => {
  it("accepts json-tree with tree only", () => {
    const r = base({
      exportKind: "json-tree",
      tree: { "a.txt": { file: { contents: "x" } } },
    });
    expect(() => assertSnapshotRecordPayload(r)).not.toThrow();
  });

  it("rejects json-tree with non-empty binaryPayload", () => {
    const r = base({
      exportKind: "json-tree",
      tree: {},
      binaryPayload: new ArrayBuffer(1),
    });
    expect(() => assertSnapshotRecordPayload(r)).toThrow(InvalidSnapshotError);
    expect(() => assertSnapshotRecordPayload(r)).toThrow("json-tree 快照不应包含 binaryPayload");
  });

  it("rejects json-tree without tree", () => {
    const r = base({ exportKind: "json-tree" });
    expect(() => assertSnapshotRecordPayload(r)).toThrow("json-tree 快照缺少 tree");
  });

  it("accepts binary-snapshot with binaryPayload only", () => {
    const r = base({
      exportKind: "binary-snapshot",
      binaryPayload: new ArrayBuffer(8),
    });
    expect(() => assertSnapshotRecordPayload(r)).not.toThrow();
  });

  it("accepts zip-archive with binaryPayload only", () => {
    const r = base({
      exportKind: "zip-archive",
      binaryPayload: new ArrayBuffer(4),
    });
    expect(() => assertSnapshotRecordPayload(r)).not.toThrow();
  });

  it("rejects binary-snapshot with tree field", () => {
    const r = base({
      exportKind: "binary-snapshot",
      binaryPayload: new ArrayBuffer(1),
      tree: {},
    });
    expect(() => assertSnapshotRecordPayload(r)).toThrow("binary-snapshot 快照不应包含 tree");
  });

  it("rejects binary-snapshot without payload", () => {
    const r = base({ exportKind: "binary-snapshot" });
    expect(() => assertSnapshotRecordPayload(r)).toThrow("binary-snapshot 快照缺少有效 binaryPayload");
  });

  it("rejects unknown exportKind", () => {
    const r = {
      ...base({ exportKind: "json-tree", tree: {} }),
      exportKind: "unknown",
    } as unknown as WorkspaceTreeSnapshotRecord;
    expect(() => assertSnapshotRecordPayload(r)).toThrow("未知 exportKind");
  });
});
