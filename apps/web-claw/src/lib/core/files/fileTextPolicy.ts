const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".conf",
  ".cpp",
  ".css",
  ".csv",
  ".env",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".md",
  ".mjs",
  ".py",
  ".rs",
  ".sh",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const TEXT_FILE_NAMES = new Set(["dockerfile", "makefile", "readme", "license", "gitignore"]);

export class FileTextPolicy {
  static readonly maxEditableBytes = 1024 * 1024;

  static isTextPath(path: string): boolean {
    const fileName = FileTextPolicy.getFileName(path).toLowerCase();
    if (TEXT_FILE_NAMES.has(fileName)) return true;
    return TEXT_EXTENSIONS.has(FileTextPolicy.getExtension(fileName));
  }

  static canReadSize(size?: number): boolean {
    return size === undefined || size <= FileTextPolicy.maxEditableBytes;
  }

  private static getFileName(path: string): string {
    return path.split("/").filter(Boolean).at(-1) ?? path;
  }

  private static getExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0) return "";
    return fileName.slice(dotIndex);
  }
}
