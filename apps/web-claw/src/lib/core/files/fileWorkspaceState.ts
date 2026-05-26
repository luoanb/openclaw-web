import type { DirectorySnapshot, FileEntry, TextFileSnapshot } from "os-core";

export type FileTabSnapshot = {
  readonly path: string;
  readonly name: string;
  readonly content: string;
  readonly draft: string;
  readonly dirty: boolean;
  readonly language: string;
  readonly readAt: number;
};

export type CachedDirectorySnapshot = {
  readonly path: string;
  readonly entries: readonly FileEntry[];
  readonly readAt: number;
  readonly expanded: boolean;
};

export type FileWorkspaceSnapshot = {
  readonly rootPath: string;
  readonly selectedPath: string | null;
  readonly activeTabPath: string | null;
  readonly directories: readonly CachedDirectorySnapshot[];
  readonly tabs: readonly FileTabSnapshot[];
};

type FileTabState = FileTabSnapshot;

export class FileWorkspaceState {
  private rootPath: string;
  private selectedPath: string | null = null;
  private activeTabPath: string | null = null;
  private readonly directories = new Map<string, DirectorySnapshot>();
  private readonly expandedPaths = new Set<string>();
  private readonly tabs = new Map<string, FileTabState>();

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.expandedPaths.add(rootPath);
  }

  setRootPath(path: string): void {
    this.rootPath = path;
    this.selectedPath = path;
    this.expandedPaths.add(path);
  }

  setDirectory(snapshot: DirectorySnapshot): void {
    this.directories.set(snapshot.path, snapshot);
  }

  setExpanded(path: string, expanded: boolean): void {
    if (expanded) {
      this.expandedPaths.add(path);
      return;
    }
    this.expandedPaths.delete(path);
  }

  selectPath(path: string): void {
    this.selectedPath = path;
  }

  openTextFile(file: TextFileSnapshot, language: string): void {
    const existing = this.tabs.get(file.path);
    const nextTab: FileTabState = {
      path: file.path,
      name: FileWorkspaceState.basename(file.path),
      content: file.content,
      draft: existing?.dirty ? existing.draft : file.content,
      dirty: existing?.dirty ?? false,
      language,
      readAt: file.readAt,
    };
    this.tabs.set(file.path, nextTab);
    this.activeTabPath = file.path;
    this.selectedPath = file.path;
  }

  updateDraft(path: string, draft: string): void {
    const tab = this.tabs.get(path);
    if (!tab) return;
    this.tabs.set(path, {
      ...tab,
      draft,
      dirty: draft !== tab.content,
    });
  }

  markSaved(path: string, content: string): void {
    const tab = this.tabs.get(path);
    if (!tab) return;
    this.tabs.set(path, {
      ...tab,
      content,
      draft: content,
      dirty: false,
    });
  }

  closeTab(path: string): void {
    this.tabs.delete(path);
    if (this.activeTabPath !== path) return;
    const next = [...this.tabs.keys()].at(-1) ?? null;
    this.activeTabPath = next;
  }

  setActiveTab(path: string): void {
    if (!this.tabs.has(path)) return;
    this.activeTabPath = path;
    this.selectedPath = path;
  }

  removePathFromCache(path: string): void {
    this.directories.delete(path);
    this.expandedPaths.delete(path);
    this.tabs.delete(path);
    for (const tabPath of [...this.tabs.keys()]) {
      if (tabPath.startsWith(`${path}/`)) {
        this.tabs.delete(tabPath);
      }
    }
    if (this.activeTabPath && !this.tabs.has(this.activeTabPath)) {
      this.activeTabPath = [...this.tabs.keys()].at(-1) ?? null;
    }
  }

  getExpandedDirectoryPaths(): readonly string[] {
    return [...this.expandedPaths];
  }

  getParentDirectory(path: string): string {
    const index = path.lastIndexOf("/");
    if (index <= 0) return "/";
    return path.slice(0, index);
  }

  getSnapshot(): FileWorkspaceSnapshot {
    return {
      rootPath: this.rootPath,
      selectedPath: this.selectedPath,
      activeTabPath: this.activeTabPath,
      directories: [...this.directories.values()].map((directory) => ({
        ...directory,
        expanded: this.expandedPaths.has(directory.path),
      })),
      tabs: [...this.tabs.values()],
    };
  }

  private static basename(path: string): string {
    return path.split("/").filter(Boolean).at(-1) ?? path;
  }
}
