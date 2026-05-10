import type { FileSystemTree } from "@webcontainer/api";
import { describe, expect, it } from "vitest";
import { InvalidSnapshotError } from "./errors";
import { assertValidFileSystemTree } from "./treeGuard";

function expectInvalid(tree: unknown, substring?: string): void {
  expect(() => assertValidFileSystemTree(tree)).toThrow(InvalidSnapshotError);
  if (substring != null) {
    expect(() => assertValidFileSystemTree(tree)).toThrow(substring);
  }
}

describe("assertValidFileSystemTree", () => {
  it("accepts empty tree", () => {
    expect(() => assertValidFileSystemTree({})).not.toThrow();
  });

  it("accepts file with string contents", () => {
    const tree: FileSystemTree = {
      "a.txt": { file: { contents: "hi" } },
    };
    expect(() => assertValidFileSystemTree(tree)).not.toThrow();
  });

  it("accepts file with Uint8Array contents", () => {
    const tree: FileSystemTree = {
      "b.bin": { file: { contents: new Uint8Array([1, 2]) } },
    };
    expect(() => assertValidFileSystemTree(tree)).not.toThrow();
  });

  it("accepts symlink", () => {
    const tree: FileSystemTree = {
      x: { file: { symlink: "/target" } },
    };
    expect(() => assertValidFileSystemTree(tree)).not.toThrow();
  });

  it("accepts nested directory", () => {
    const tree: FileSystemTree = {
      src: {
        directory: {
          "m.ts": { file: { contents: "" } },
        },
      },
    };
    expect(() => assertValidFileSystemTree(tree)).not.toThrow();
  });

  it("rejects non-object root", () => {
    expectInvalid(null, "文件树根须为非数组对象");
    expectInvalid([], "文件树根须为非数组对象");
    expectInvalid("x");
  });

  it("rejects empty name segment", () => {
    expectInvalid({ "": { file: { contents: "a" } } }, "非法路径段");
  });

  it("rejects slash in segment name", () => {
    expectInvalid({ "a/b": { file: { contents: "a" } } }, "非法路径段");
  });

  it("rejects directory node with extra keys", () => {
    expectInvalid(
      {
        x: { directory: {}, extra: true },
      },
      "directory 节点须仅含 directory 键",
    );
  });

  it("rejects non-object directory value", () => {
    expectInvalid(
      {
        x: { directory: [] as unknown as Record<string, unknown> },
      },
      "directory 须为对象",
    );
  });

  it("rejects file node without directory or file", () => {
    expectInvalid({ x: {} }, "节点须含 directory 或 file");
  });

  it("rejects file node with both directory and file keys", () => {
    expectInvalid(
      {
        x: {
          directory: {},
          file: { contents: "a" },
        },
      },
      "directory 节点须仅含 directory 键",
    );
  });

  it("rejects file entry that is not object", () => {
    expectInvalid({ x: "bad" as unknown as Record<string, unknown> }, "节点须为对象");
  });

  it("rejects file with extra fields beside contents", () => {
    expectInvalid(
      {
        x: {
          file: { contents: "a", mode: 0o644 },
        },
      },
      "file 含未定义字段",
    );
  });

  it("rejects symlink with extra fields", () => {
    expectInvalid(
      {
        x: {
          file: { symlink: "/t", x: 1 },
        },
      },
      "symlink 含未定义字段",
    );
  });

  it("rejects invalid file.contents type", () => {
    expectInvalid(
      {
        x: { file: { contents: 123 as unknown as string } },
      },
      "file.contents 须为 string 或 Uint8Array",
    );
  });
});
