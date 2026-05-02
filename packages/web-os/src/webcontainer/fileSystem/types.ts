import type { FileSystemTree } from "@webcontainer/api";

/** 与 `WebContainer#export` 的 `format` 对应：`json` | `binary` | `zip`（见 spec §4.10.2）。 */
export type WorkspaceExportKind = "json-tree" | "binary-snapshot" | "zip-archive";

export interface WorkspaceTreeSnapshotRecord {
  schemaVersion: 2;
  snapshotId: string;
  workspaceKey: string;
  exportRootPath: string;
  exportKind: WorkspaceExportKind;
  /** `json-tree` 必填 */
  tree?: FileSystemTree;
  /** `binary-snapshot` / `zip-archive` 必填 */
  binaryPayload?: ArrayBuffer;
  savedAt: number;
  contentRevision?: string;
}
