import type { WorkspaceExportKind, WorkspaceTreeSnapshotRecord } from "./types";
import { InvalidSnapshotError } from "./errors";
import { assertValidFileSystemTree } from "./treeGuard";

export function assertSnapshotRecordPayload(raw: WorkspaceTreeSnapshotRecord): void {
  switch (raw.exportKind) {
    case "json-tree": {
      if (raw.binaryPayload != null && raw.binaryPayload.byteLength > 0) {
        throw new InvalidSnapshotError("json-tree 快照不应包含 binaryPayload");
      }
      if (!raw.tree) {
        throw new InvalidSnapshotError("json-tree 快照缺少 tree");
      }
      assertValidFileSystemTree(raw.tree);
      return;
    }
    case "binary-snapshot":
    case "zip-archive": {
      if (raw.tree !== undefined) {
        throw new InvalidSnapshotError(`${raw.exportKind} 快照不应包含 tree`);
      }
      if (!raw.binaryPayload || raw.binaryPayload.byteLength === 0) {
        throw new InvalidSnapshotError(`${raw.exportKind} 快照缺少有效 binaryPayload`);
      }
      return;
    }
    default:
      throw new InvalidSnapshotError(`未知 exportKind: ${String(raw.exportKind)}`);
  }
}

/** 官方文档：`mount` 仅支持 json / binary 产物；ZIP 不可导入。 */
export function exportKindIsImportable(kind: WorkspaceExportKind): boolean {
  return kind === "json-tree" || kind === "binary-snapshot";
}
