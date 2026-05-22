import type { DirectoryNode, FileNode, FileSystemTree, SymlinkNode } from "@webcontainer/api";
import { assertValidFileSystemTree } from "../fileSystem/treeGuard";
import { staticImplements } from "../../utils/staticImplements";
import type {
  FileManagerTreeRecord,
  FileSystemTreeMergeStatic,
  ResolveMountTreeResult,
} from "./fileManager.interfaces";

type TreeEntry = DirectoryNode | FileNode | SymlinkNode;

class FileSystemTreeMerge {
  private static cloneEntry(entry: TreeEntry): TreeEntry {
    return structuredClone(entry) as TreeEntry;
  }

  private static isDirectoryNode(entry: TreeEntry): entry is DirectoryNode {
    return (
      typeof entry === "object" &&
      entry !== null &&
      "directory" in entry &&
      !("file" in entry)
    );
  }

  private static mergeTrees(base: FileSystemTree, overlay: FileSystemTree): FileSystemTree {
    const names = new Set([...Object.keys(base), ...Object.keys(overlay)]);
    const out: FileSystemTree = {};
    for (const name of names) {
      const b = base[name];
      const o = overlay[name];
      if (o === undefined) {
        if (b !== undefined) out[name] = FileSystemTreeMerge.cloneEntry(b);
        continue;
      }
      if (b === undefined) {
        out[name] = FileSystemTreeMerge.cloneEntry(o);
        continue;
      }
      out[name] = FileSystemTreeMerge.mergeEntries(b, o);
    }
    return out;
  }

  /** 后者覆盖前者（Spec §4.1）：目录递归合并；类型冲突或文件类节点取后者。 */
  private static mergeEntries(prev: TreeEntry, next: TreeEntry): TreeEntry {
    if (FileSystemTreeMerge.isDirectoryNode(prev) && FileSystemTreeMerge.isDirectoryNode(next)) {
      return { directory: FileSystemTreeMerge.mergeTrees(prev.directory, next.directory) };
    }
    return FileSystemTreeMerge.cloneEntry(next);
  }

  static mergeFileSystemTrees(trees: FileSystemTree[]): FileSystemTree {
    let acc: FileSystemTree = {};
    for (const t of trees) {
      acc = FileSystemTreeMerge.mergeTrees(acc, t);
    }
    return acc;
  }

  static sortRecordsBySchemaVersion(records: FileManagerTreeRecord[]): FileManagerTreeRecord[] {
    return [...records].sort((a, b) => {
      if (a.schemaVersion !== b.schemaVersion) return a.schemaVersion - b.schemaVersion;
      return a.recordId.localeCompare(b.recordId);
    });
  }

  /** `schemaVersion` 最大者；同世代取 `recordId` 字典序最小（Spec §4.2 tip）。 */
  static findTipRecord(records: FileManagerTreeRecord[]): FileManagerTreeRecord | null {
    if (records.length === 0) return null;
    const maxSv = Math.max(...records.map((r) => r.schemaVersion));
    const candidates = records.filter((r) => r.schemaVersion === maxSv);
    candidates.sort((a, b) => a.recordId.localeCompare(b.recordId));
    return candidates[0] ?? null;
  }

  /**
   * 全量 / 增量合并（Spec §4.1.1），不落库。
   */
  private static computeMergedForDrive(records: FileManagerTreeRecord[]): FileSystemTree {
    const sorted = FileSystemTreeMerge.sortRecordsBySchemaVersion(records);
    if (sorted.length === 0) return {};

    const anchor = sorted.find((r) => r.isCurrent === true && r.mergedTree !== undefined);

    if (!anchor?.mergedTree) {
      return FileSystemTreeMerge.mergeFileSystemTrees(sorted.map((r) => r.tree));
    }

    try {
      assertValidFileSystemTree(anchor.mergedTree);
      const tails = sorted.filter((r) => r.schemaVersion > anchor.schemaVersion);
      let acc: FileSystemTree = structuredClone(anchor.mergedTree) as FileSystemTree;
      for (const r of tails) {
        acc = FileSystemTreeMerge.mergeTrees(acc, r.tree);
      }
      assertValidFileSystemTree(acc);
      return acc;
    } catch {
      return FileSystemTreeMerge.mergeFileSystemTrees(sorted.map((r) => r.tree));
    }
  }

  /**
   * 启动挂载读路径（Spec §4.2）：是否命中 tip.`mergedTree` 由 `usedTipMergedTreeCache` 表明（存储层据此决定是否 §4.2 写回）。
   */
  static resolveMountTreeWithCacheInfo(records: FileManagerTreeRecord[]): ResolveMountTreeResult {
    if (records.length === 0) {
      return { tree: {}, usedTipMergedTreeCache: false };
    }
    const tip = FileSystemTreeMerge.findTipRecord(records);
    if (!tip) {
      return { tree: {}, usedTipMergedTreeCache: false };
    }
    const anchor = records.find((r) => r.isCurrent === true && r.mergedTree !== undefined);
    if (
      anchor &&
      anchor.recordId === tip.recordId &&
      anchor.mergedTree !== undefined
    ) {
      assertValidFileSystemTree(anchor.mergedTree);
      return { tree: anchor.mergedTree, usedTipMergedTreeCache: true };
    }
    const tree = FileSystemTreeMerge.computeMergedForDrive(records);
    return { tree, usedTipMergedTreeCache: false };
  }
}

staticImplements<FileSystemTreeMergeStatic>()(FileSystemTreeMerge);

export { FileSystemTreeMerge };
