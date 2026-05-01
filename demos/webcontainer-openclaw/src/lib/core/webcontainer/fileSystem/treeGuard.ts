import type { FileSystemTree } from "@webcontainer/api";
import { InvalidSnapshotError } from "./errors";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * 校验与 `export(..., { format: 'json' })` / `mount` 兼容的树（对齐 `@webcontainer/api` 节点形状）。
 */
export function assertValidFileSystemTree(tree: unknown): asserts tree is FileSystemTree {
  if (!isPlainObject(tree)) {
    throw new InvalidSnapshotError("文件树根须为非数组对象");
  }
  for (const name of Object.keys(tree)) {
    if (name === "" || name.includes("/")) {
      throw new InvalidSnapshotError(`非法路径段: ${JSON.stringify(name)}`);
    }
    walkEntry((tree as Record<string, unknown>)[name], `/${name}`);
  }
}

function walkEntry(entry: unknown, path: string): void {
  if (!isPlainObject(entry)) {
    throw new InvalidSnapshotError(`节点须为对象: ${path}`);
  }
  const keys = Object.keys(entry);
  if (keys.includes("directory")) {
    if (keys.length !== 1) {
      throw new InvalidSnapshotError(`directory 节点须仅含 directory 键: ${path}`);
    }
    const d = entry.directory;
    if (!isPlainObject(d)) {
      throw new InvalidSnapshotError(`directory 须为对象: ${path}`);
    }
    for (const name of Object.keys(d)) {
      if (name === "" || name.includes("/")) {
        throw new InvalidSnapshotError(`非法路径段: ${path}/${name}`);
      }
      walkEntry((d as Record<string, unknown>)[name], `${path}/${name}`);
    }
    return;
  }
  if (!keys.includes("file")) {
    throw new InvalidSnapshotError(`节点须含 directory 或 file: ${path}`);
  }
  if (keys.length !== 1) {
    throw new InvalidSnapshotError(`file 类节点须仅含 file 键: ${path}`);
  }
  const f = entry.file;
  if (!isPlainObject(f)) {
    throw new InvalidSnapshotError(`file 须为对象: ${path}`);
  }
  if (typeof f.symlink === "string") {
    const extra = Object.keys(f).filter((k) => k !== "symlink");
    if (extra.length > 0) {
      throw new InvalidSnapshotError(`symlink 含未定义字段: ${path}`);
    }
    return;
  }
  const contents = f.contents;
  if (typeof contents !== "string" && !(contents instanceof Uint8Array)) {
    throw new InvalidSnapshotError(`file.contents 须为 string 或 Uint8Array: ${path}`);
  }
  const extra = Object.keys(f).filter((k) => k !== "contents");
  if (extra.length > 0) {
    throw new InvalidSnapshotError(`file 含未定义字段: ${path}`);
  }
}
