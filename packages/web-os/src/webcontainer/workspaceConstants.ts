import type { WorkspaceExportKind } from "./fileSystem/types";

/** 与 Spec §4.1 / §4.10 对齐：单一工作区键与导出根路径（MVP）。 */
export const WORKSPACE_KEY = "wc-openclaw-demo";

export const EXPORT_ROOT_PATH = ".";

/** IndexedDB 数据库名（Spec §4.10.3）；非 Cache Storage。 */
export const WORKSPACE_IDB_NAME = "openclaw-wc-workspace-file-system";

/** Dropdown：`exportKind` → 展示文案（对齐 `ExportOptions.format`）。 */
export const EXPORT_KIND_LABELS: Record<WorkspaceExportKind, string> = {
  "json-tree": "JSON 树（export json）",
  "binary-snapshot": "二进制快照（export binary）",
  "zip-archive": "ZIP 归档（export zip）",
};
