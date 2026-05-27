<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Icon } from "$lib/components/icon";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import * as Resizable from "$lib/components/ui/resizable";
  import {
    FileLanguageResolver,
    FileServiceProvider,
    FileTextPolicy,
    FileWorkspaceState,
    type FileWorkspaceSnapshot,
  } from "$lib/core/files";
  import { RuntimeManagerProvider } from "$lib/core/runtime";
  import {
    DebugLogger,
    type FileActionResult,
    type FileEntry,
    type RuntimeSnapshot,
    type Unsubscribe,
  } from "os-core";

  type Props = {
    onOpenRuntime?: () => void;
  };

  type FileMenuTarget =
    | { kind: "workspace"; path: string; name: string }
    | { kind: "directory"; path: string; name: string }
    | { kind: "file"; path: string; name: string };

  let { onOpenRuntime }: Props = $props();

  const runtimeManager = RuntimeManagerProvider.getRuntimeManager();
  const fileService = FileServiceProvider.getFileService();
  const filesLogger = new DebugLogger("files.panel");

  let runtimeSnapshot: RuntimeSnapshot = $state(runtimeManager.getSnapshot());
  let workspace: FileWorkspaceState | null = null;
  let workspaceSnapshot: FileWorkspaceSnapshot | null = $state(null);
  let pathInput = $state("");
  let busyMessage: string | null = $state(null);
  let errorMessage: string | null = $state(null);
  let menuTarget: FileMenuTarget | null = $state(null);
  let uploadTargetDirectory: string | null = $state(null);
  let fileInputElement: HTMLInputElement | null = null;
  let unsubscribe: Unsubscribe | null = null;

  onMount(() => {
    unsubscribe = runtimeManager.onEvent(() => {
      runtimeSnapshot = runtimeManager.getSnapshot();
      if (runtimeSnapshot.status === "running") {
        void ensureWorkspace();
      }
    });

    void ensureWorkspace();

    return () => {
      unsubscribe?.();
    };
  });

  async function ensureWorkspace() {
    if (
      workspace ||
      runtimeSnapshot.status !== "running" ||
      !runtimeManager.currentSession
    )
      return;
    const rootPath = fileService.getDefaultPath(runtimeManager.currentSession);
    workspace = new FileWorkspaceState(rootPath);
    pathInput = rootPath;
    syncSnapshot();
    await loadDirectory(rootPath, { expand: true, select: true });
  }

  function syncSnapshot() {
    workspaceSnapshot = workspace?.getSnapshot() ?? null;
  }

  async function submitPath() {
    if (!workspace || !pathInput.trim()) return;
    const nextPath = normalizePathInput(pathInput);
    workspace.setRootPath(nextPath);
    syncSnapshot();
    await loadDirectory(nextPath, { expand: true, select: true });
  }

  async function loadDirectory(
    path: string,
    options: { expand?: boolean; select?: boolean } = {}
  ) {
    if (!runtimeManager.currentSession || !workspace) return;
    busyMessage = `Loading ${path}`;
    errorMessage = null;
    try {
      const directory = await fileService.listDirectory(
        runtimeManager.currentSession,
        path
      );
      workspace.setDirectory(directory);
      if (options.expand) workspace.setExpanded(directory.path, true);
      if (options.select) workspace.selectPath(directory.path);
      syncSnapshot();
    } catch (error) {
      errorMessage = formatError(error);
    } finally {
      busyMessage = null;
    }
  }

  async function refreshOpenedDirectories() {
    if (!workspace) return;
    for (const path of workspace.getExpandedDirectoryPaths()) {
      await loadDirectory(path);
    }
  }

  async function toggleDirectory(entry: FileEntry) {
    if (!workspace || !workspaceSnapshot) return;
    const cached = findDirectory(entry.path);
    if (cached?.expanded) {
      workspace.setExpanded(entry.path, false);
      workspace.selectPath(entry.path);
      syncSnapshot();
      return;
    }

    await loadDirectory(entry.path, { expand: true, select: true });
  }

  async function openFile(entry: FileEntry) {
    if (!runtimeManager.currentSession || !workspace) return;
    const startedAt = filesLogger.start("openTextFile", {
      path: entry.path,
      size: entry.size,
    });
    workspace.selectPath(entry.path);
    syncSnapshot();

    busyMessage = `Opening ${entry.path}`;
    errorMessage = null;
    try {
      const inspection = await fileService.inspectTextFile(
        runtimeManager.currentSession,
        entry.path
      );
      if (!inspection.ok) {
        errorMessage = inspection.message;
        filesLogger.blocked("openTextFile", inspection.error?.code ?? inspection.reason, {
          path: entry.path,
          size: inspection.size ?? entry.size,
          errorCode: inspection.error?.code,
          reason: inspection.reason,
        });
        return;
      }

      if (!FileTextPolicy.canReadSize(inspection.size ?? entry.size)) {
        errorMessage =
          "Only text files under the size limit are supported in this preview.";
        filesLogger.blocked("openTextFile", "file-too-large", {
          path: entry.path,
          size: inspection.size ?? entry.size,
          maxSize: FileTextPolicy.maxEditableBytes,
          errorCode: "file-too-large",
        });
        return;
      }

      const file = await fileService.readTextFile(
        runtimeManager.currentSession,
        entry.path
      );
      workspace.openTextFile(file, FileLanguageResolver.getLabel(entry.path));
      syncSnapshot();
      filesLogger.success("openTextFile", startedAt, {
        path: file.path,
        size: file.size,
      });
    } catch (error) {
      errorMessage = formatError(error);
      filesLogger.error("openTextFile", error, startedAt, { path: entry.path });
    } finally {
      busyMessage = null;
    }
  }

  async function saveActiveTab() {
    const tab = activeTab();
    if (!tab || !runtimeManager.currentSession || !workspace) return;
    busyMessage = `Saving ${tab.path}`;
    errorMessage = null;
    const result = await fileService.writeTextFile(
      runtimeManager.currentSession,
      tab.path,
      tab.draft
    );
    if (result.ok) {
      workspace.markSaved(tab.path, tab.draft);
      syncSnapshot();
    } else {
      errorMessage = result.message;
    }
    busyMessage = null;
  }

  async function createFile(parentPath: string) {
    await createPath(parentPath, "file");
  }

  function setWorkspaceMenuTarget() {
    if (!workspaceSnapshot) return;
    menuTarget = {
      kind: "workspace",
      path: workspaceSnapshot.rootPath,
      name: basename(workspaceSnapshot.rootPath),
    };
  }

  function handleTreeContextMenu(event: MouseEvent) {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-file-tree-row]")) {
      return;
    }
    setWorkspaceMenuTarget();
  }

  function setEntryMenuTarget(entry: FileEntry) {
    if (entry.kind !== "file" && entry.kind !== "directory") return;
    menuTarget = {
      kind: entry.kind,
      path: entry.path,
      name: entry.name,
    };
  }

  function menuTargetDirectory(target = menuTarget) {
    if (!workspace || !target) return null;
    if (target.kind === "file") return workspace.getParentDirectory(target.path);
    return target.path;
  }

  function canPasteIntoTarget(target = menuTarget) {
    return Boolean(workspaceSnapshot?.clipboard && target && target.kind !== "file");
  }

  function startUpload(target = menuTarget) {
    const directory = menuTargetDirectory(target);
    if (!directory || !fileInputElement) {
      filesLogger.blocked("uploadFile", "missing-upload-target", {
        target,
        hasFileInput: Boolean(fileInputElement),
      });
      return;
    }
    filesLogger.debug("operation:start", {
      operation: "selectUploadFile",
      targetPath: directory,
      targetKind: target?.kind,
    });
    uploadTargetDirectory = directory;
    fileInputElement.value = "";
    fileInputElement.click();
  }

  async function handleUploadChange(event: Event) {
    if (!runtimeManager.currentSession || !workspace || !uploadTargetDirectory) {
      filesLogger.blocked("uploadFile", "runtime-or-target-unavailable");
      return;
    }
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      filesLogger.cancelled("uploadFile", "file-selection-cancelled", {
        targetPath: uploadTargetDirectory,
      });
      uploadTargetDirectory = null;
      return;
    }
    const targetDirectory = uploadTargetDirectory;
    const targetPath = joinPath(targetDirectory, file.name);
    const startedAt = filesLogger.start("uploadFile", {
      targetPath,
      size: file.size,
    });
    busyMessage = `Uploading ${file.name}`;
    errorMessage = null;
    try {
      const content = await file.arrayBuffer();
      let result = await fileService.writeFileBytes(
        runtimeManager.currentSession,
        targetPath,
        content,
        { overwrite: false },
      );
      if (isPathAlreadyExists(result)) {
        const confirmed = window.confirm(`Overwrite ${targetPath}?`);
        if (!confirmed) {
          filesLogger.cancelled("uploadFile", "overwrite-cancelled", {
            targetPath,
            size: file.size,
          });
          busyMessage = null;
          return;
        }
        result = await fileService.writeFileBytes(
          runtimeManager.currentSession,
          targetPath,
          content,
          { overwrite: true },
        );
      }
      if (!result.ok) {
        errorMessage = result.message;
        filesLogger.error("uploadFile", result.error ?? result.message, startedAt, {
          targetPath,
          errorCode: result.error?.code,
        });
        return;
      }
      await loadDirectory(targetDirectory);
      filesLogger.success("uploadFile", startedAt, {
        targetPath,
        size: file.size,
      });
    } catch (error) {
      errorMessage = formatError(error);
      filesLogger.error("uploadFile", error, startedAt, { targetPath, size: file.size });
    } finally {
      busyMessage = null;
      uploadTargetDirectory = null;
    }
  }

  async function createFileFromMenuTarget() {
    const directory = menuTargetDirectory();
    if (!directory) return;
    await createFile(directory);
  }

  async function createDirectoryFromMenuTarget() {
    const directory = menuTargetDirectory();
    if (!directory) return;
    await createDirectory(directory);
  }

  async function downloadMenuTarget() {
    const target = menuTarget;
    if (!target || target.kind !== "file") return;
    await downloadPath(target.path);
  }

  async function renameMenuTarget() {
    const target = menuTarget;
    if (!target || target.kind === "workspace") return;
    await renamePath(target.path);
  }

  async function deleteMenuTarget() {
    const target = menuTarget;
    if (!target || target.kind === "workspace") {
      filesLogger.blocked("deletePath", "invalid-delete-target", { target });
      return;
    }
    await deletePath(target.path, target.kind);
  }

  async function downloadPath(path: string) {
    if (!runtimeManager.currentSession) return;
    const startedAt = filesLogger.start("downloadFile", { path });
    busyMessage = `Downloading ${path}`;
    errorMessage = null;
    try {
      const file = await fileService.readFileBytes(runtimeManager.currentSession, path);
      const url = URL.createObjectURL(new Blob([file.content]));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = basename(path);
      anchor.click();
      URL.revokeObjectURL(url);
      filesLogger.success("downloadFile", startedAt, {
        path,
        size: file.size,
      });
    } catch (error) {
      errorMessage = formatError(error);
      filesLogger.error("downloadFile", error, startedAt, { path });
    } finally {
      busyMessage = null;
    }
  }

  function copyTarget(target = menuTarget) {
    if (!workspace || !target || target.kind === "workspace") {
      filesLogger.blocked("copyPath", "invalid-copy-target", { target });
      return;
    }
    workspace.setCopiedPath(target.path, target.kind);
    syncSnapshot();
    filesLogger.success("copyPath", filesLogger.start("copyPath", {
      sourcePath: target.path,
      kind: target.kind,
    }), {
      sourcePath: target.path,
      kind: target.kind,
    });
  }

  async function pasteIntoTarget(target = menuTarget) {
    if (!runtimeManager.currentSession || !workspace || !target) return;
    const clipboard = workspace.getClipboard();
    const targetDirectory = menuTargetDirectory(target);
    if (!clipboard || !targetDirectory) {
      filesLogger.blocked("pastePath", "clipboard-or-target-unavailable", {
        target,
        hasClipboard: Boolean(clipboard),
      });
      return;
    }
    const targetPath = joinPath(targetDirectory, clipboard.name);
    const startedAt = filesLogger.start("pastePath", {
      sourcePath: clipboard.sourcePath,
      targetPath,
      kind: clipboard.kind,
    });
    busyMessage = `Pasting ${clipboard.name}`;
    errorMessage = null;
    try {
      const result = await fileService.copyPath(
        runtimeManager.currentSession,
        clipboard.sourcePath,
        targetPath,
        clipboard.kind,
        { overwrite: false },
      );
      if (!result.ok) {
        errorMessage = result.message;
        filesLogger.error("pastePath", result.error ?? result.message, startedAt, {
          sourcePath: clipboard.sourcePath,
          targetPath,
          kind: clipboard.kind,
          errorCode: result.error?.code,
        });
        return;
      }
      await loadDirectory(targetDirectory);
      filesLogger.success("pastePath", startedAt, {
        sourcePath: clipboard.sourcePath,
        targetPath,
        kind: clipboard.kind,
      });
    } catch (error) {
      errorMessage = formatError(error);
      filesLogger.error("pastePath", error, startedAt, {
        sourcePath: clipboard.sourcePath,
        targetPath,
        kind: clipboard.kind,
      });
    } finally {
      busyMessage = null;
    }
  }

  async function createDirectory(parentPath: string) {
    await createPath(parentPath, "directory");
  }

  async function createPath(parentPath: string, kind: "file" | "directory") {
    if (!runtimeManager.currentSession || !workspace) return;
    const name = window.prompt(
      kind === "file" ? "New file name" : "New folder name"
    );
    if (!name) {
      return;
    }
    const path = joinPath(parentPath, name);
    const result =
      kind === "file"
        ? await fileService.createFile(runtimeManager.currentSession, path)
        : await fileService.createDirectory(
            runtimeManager.currentSession,
            path
          );
    if (!result.ok) {
      errorMessage = result.message;
      return;
    }
    await loadDirectory(parentPath);
  }

  async function handleEntryClick(entry: FileEntry) {
    if (entry.kind === "directory") {
      await toggleDirectory(entry);
      return;
    }
    await openFile(entry);
  }

  async function renamePath(path: string) {
    if (!runtimeManager.currentSession || !workspace) return;
    const nextName = window.prompt("Rename to", basename(path));
    if (!nextName) {
      return;
    }
    const nextPath = joinPath(workspace.getParentDirectory(path), nextName);
    const result = await fileService.rename(
      runtimeManager.currentSession,
      path,
      nextPath
    );
    if (!result.ok) {
      errorMessage = result.message;
      return;
    }
    workspace.removePathFromCache(path);
    await loadDirectory(workspace.getParentDirectory(path));
  }

  async function deletePath(path: string, kind: FileEntry["kind"]) {
    if (!runtimeManager.currentSession || !workspace) {
      filesLogger.blocked("deletePath", "runtime-or-workspace-unavailable", {
        path,
        kind,
        hasRuntimeSession: Boolean(runtimeManager.currentSession),
        hasWorkspace: Boolean(workspace),
      });
      return;
    }
    const recursive = kind === "directory";
    const parentPath = workspace.getParentDirectory(path);
    const confirmed = window.confirm(
      `Delete ${path}${recursive ? " and its contents" : ""}?`
    );
    if (!confirmed) {
      filesLogger.cancelled("deletePath", "confirm-cancelled", {
        path,
        kind,
        recursive,
      });
      return;
    }
    const startedAt = filesLogger.start("deletePath", {
      path,
      kind,
      recursive,
      parentPath,
    });
    busyMessage = `Deleting ${path}`;
    errorMessage = null;
    try {
      const result = await fileService.delete(runtimeManager.currentSession, path, {
        recursive,
      });
      if (!result.ok) {
        errorMessage = result.message;
        filesLogger.error("deletePath", result.error ?? result.message, startedAt, {
          path,
          kind,
          recursive,
          errorCode: result.error?.code,
        });
        return;
      }
      workspace.removePathFromCache(path);
      await loadDirectory(parentPath);
      filesLogger.success("deletePath", startedAt, {
        path,
        kind,
        recursive,
        parentPath,
      });
    } catch (error) {
      errorMessage = formatError(error);
      filesLogger.error("deletePath", error, startedAt, {
        path,
        kind,
        recursive,
      });
    } finally {
      busyMessage = null;
    }
  }

  function activeTab() {
    if (!workspaceSnapshot?.activeTabPath) return null;
    return (
      workspaceSnapshot.tabs.find(
        (tab) => tab.path === workspaceSnapshot?.activeTabPath
      ) ?? null
    );
  }

  function updateActiveDraft(value: string) {
    const tab = activeTab();
    if (!tab || !workspace) return;
    workspace.updateDraft(tab.path, value);
    syncSnapshot();
  }

  function setActiveTab(path: string) {
    workspace?.setActiveTab(path);
    syncSnapshot();
  }

  function closeTab(path: string) {
    workspace?.closeTab(path);
    syncSnapshot();
  }

  function findDirectory(path: string) {
    return workspaceSnapshot?.directories.find(
      (directory) => directory.path === path
    );
  }

  function visibleRows() {
    if (!workspaceSnapshot) return [];
    const rows: Array<{ entry: FileEntry; depth: number }> = [];
    const appendEntries = (directoryPath: string, depth: number) => {
      const directory = findDirectory(directoryPath);
      if (!directory) return;
      for (const entry of directory.entries) {
        rows.push({ entry, depth });
        if (entry.kind === "directory" && findDirectory(entry.path)?.expanded) {
          appendEntries(entry.path, depth + 1);
        }
      }
    };
    appendEntries(workspaceSnapshot.rootPath, 0);
    return rows;
  }

  function normalizePathInput(path: string) {
    const trimmed = path.trim();
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  function joinPath(parentPath: string, name: string) {
    return `${parentPath.replace(/\/$/, "")}/${name}`.replace(/\/+/g, "/");
  }

  function basename(path: string) {
    return path.split("/").filter(Boolean).at(-1) ?? path;
  }

  function formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function isPathAlreadyExists(result: FileActionResult) {
    return !result.ok && result.error?.code === "path-already-exists";
  }
</script>

{#if runtimeSnapshot.status !== "running"}
  <section
    class="flex min-h-[20rem] flex-col items-center justify-center rounded-lg border bg-muted/30 p-6 text-center"
  >
    <Icon name="folder" class="mb-3 size-5 text-muted-foreground" />
    <h2 class="text-sm font-semibold text-foreground">
      Files need a running container
    </h2>
    <p class="mt-2 max-w-md text-xs text-muted-foreground">
      文件管理复用当前 BrowserPod runtime
      session。容器启动后可读取用户目录、打开文本文件并保存修改。
    </p>
    {#if onOpenRuntime}
      <Button class="mt-4" size="sm" variant="outline" onclick={onOpenRuntime}
        >Open runtime status</Button
      >
    {/if}
  </section>
{:else}
  <section
    class="flex min-h-0 flex-1 flex-col rounded-lg border bg-card text-card-foreground"
  >
    <Resizable.PaneGroup direction="horizontal" class="min-h-0 flex-1">
      <Resizable.Pane defaultSize={32} minSize={22} class="min-h-0 border-r">
        <div class="flex h-full min-h-0 flex-col">
          <div class="border-b p-2">
            <form
              class="flex gap-2"
              onsubmit={(event) => {
                event.preventDefault();
                void submitPath();
              }}
            >
              <Input
                class="h-8 text-xs"
                bind:value={pathInput}
                aria-label="Files path"
              />
              <Button type="submit" size="sm" variant="outline">
                <Icon name="chevronRight" class="size-3" />
                Go
              </Button>
            </form>
            <div class="mt-2 flex items-center justify-between">
              <div class="text-xs font-medium">Explorer</div>
              <Button
                size="sm"
                variant="ghost"
                class="h-7 px-2 text-xs"
                onclick={() => void refreshOpenedDirectories()}
              >
                <Icon name="refresh" class="size-3" />
                Refresh
              </Button>
            </div>
          </div>

          <ContextMenu.Root>
            <ContextMenu.Trigger class="min-h-0 flex flex-1">
              <div
                class="min-h-0 flex-1 overflow-auto p-1 text-xs"
                role="tree"
                aria-label="Files explorer"
                tabindex="0"
                oncontextmenu={handleTreeContextMenu}
              >
                {#if !workspaceSnapshot}
                  <div class="p-3 text-muted-foreground">Preparing files...</div>
                {:else if visibleRows().length === 0}
                  <div class="p-3 text-muted-foreground">
                    No files in this directory.
                  </div>
                {:else}
                  {#each visibleRows() as row (row.entry.path)}
                    <button
                      type="button"
                      data-file-tree-row
                      class={`flex h-7 w-full items-center gap-1 rounded px-2 text-left hover:bg-muted ${workspaceSnapshot.selectedPath === row.entry.path ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                      style={`padding-left: ${row.depth * 0.875 + 0.5}rem`}
                      onclick={() => void handleEntryClick(row.entry)}
                      oncontextmenu={() => setEntryMenuTarget(row.entry)}
                    >
                      {#if row.entry.kind === "directory"}
                        <Icon
                          name={findDirectory(row.entry.path)?.expanded ? "chevronDown" : "chevronRight"}
                          class="size-3 shrink-0"
                        />
                        <Icon
                          name={findDirectory(row.entry.path)?.expanded ? "folderOpen" : "folder"}
                          class="size-3.5 shrink-0"
                        />
                      {:else}
                        <span class="size-3 shrink-0"></span>
                        <Icon name="file" class="size-3.5 shrink-0" />
                      {/if}
                      <span class="truncate">{row.entry.name}</span>
                    </button>
                  {/each}
                {/if}
              </div>
            </ContextMenu.Trigger>
            <ContextMenu.Content>
              {#if menuTarget}
                {#if menuTarget.kind !== "file"}
                  <ContextMenu.Item
                    onclick={() => void createFileFromMenuTarget()}
                  >
                    <Icon name="file" class="mr-2 size-3.5" />
                    New file
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    onclick={() => void createDirectoryFromMenuTarget()}
                  >
                    <Icon name="folder" class="mr-2 size-3.5" />
                    New folder
                  </ContextMenu.Item>
                  <ContextMenu.Item onclick={() => startUpload()}>
                    <Icon name="add" class="mr-2 size-3.5" />
                    Upload file
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    disabled={!canPasteIntoTarget()}
                    onclick={() => void pasteIntoTarget()}
                  >
                    <Icon name="file" class="mr-2 size-3.5" />
                    Paste
                  </ContextMenu.Item>
                  <ContextMenu.Separator />
                {:else}
                  <ContextMenu.Item onclick={() => void downloadMenuTarget()}>
                    <Icon name="file" class="mr-2 size-3.5" />
                    Download
                  </ContextMenu.Item>
                  <ContextMenu.Item onclick={() => startUpload()}>
                    <Icon name="add" class="mr-2 size-3.5" />
                    Upload file to parent
                  </ContextMenu.Item>
                  <ContextMenu.Separator />
                {/if}

                {#if menuTarget.kind !== "workspace"}
                  <ContextMenu.Item onclick={() => copyTarget()}>
                    <Icon name={menuTarget.kind === "directory" ? "folder" : "file"} class="mr-2 size-3.5" />
                    Copy
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    onclick={() => void renameMenuTarget()}
                  >
                    <Icon name="edit" class="mr-2 size-3.5" />
                    Rename
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    onclick={() => void deleteMenuTarget()}
                  >
                    <Icon name="delete" class="mr-2 size-3.5" />
                    Delete
                  </ContextMenu.Item>
                {:else}
                  <ContextMenu.Item onclick={() => void refreshOpenedDirectories()}>
                    <Icon name="refresh" class="mr-2 size-3.5" />
                    Refresh
                  </ContextMenu.Item>
                {/if}
              {/if}
            </ContextMenu.Content>
          </ContextMenu.Root>
        </div>
      </Resizable.Pane>

      <Resizable.Handle />

      <Resizable.Pane defaultSize={68} minSize={35} class="min-h-0">
        <div class="flex h-full min-h-0 flex-col">
          <div class="flex h-10 shrink-0 items-center border-b">
            <div class="flex min-w-0 flex-1 items-center overflow-x-auto">
              {#if workspaceSnapshot?.tabs.length}
                {#each workspaceSnapshot.tabs as tab (tab.path)}
                  <button
                    type="button"
                    class={`flex h-10 min-w-32 items-center gap-2 border-r px-3 text-xs ${workspaceSnapshot.activeTabPath === tab.path ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    onclick={() => setActiveTab(tab.path)}
                  >
                    <span class="truncate"
                      >{tab.name}{tab.dirty ? " *" : ""}</span
                    >
                    <span
                      role="button"
                      tabindex="0"
                      aria-label={`Close ${tab.name}`}
                      class="rounded p-0.5 hover:bg-muted-foreground/10"
                      onclick={(event) => {
                        event.stopPropagation();
                        closeTab(tab.path);
                      }}
                      onkeydown={(event) => {
                        if (event.key === "Enter") closeTab(tab.path);
                      }}
                    >
                      <Icon name="close" class="size-3" />
                    </span>
                  </button>
                {/each}
              {:else}
                <div class="px-3 text-xs text-muted-foreground">
                  No file opened
                </div>
              {/if}
            </div>
            <Button
              class="mr-2 h-7 px-2 text-xs"
              size="sm"
              variant="outline"
              disabled={!activeTab()?.dirty || Boolean(busyMessage)}
              aria-label="Save active file"
              onclick={() => void saveActiveTab()}
            >
              <Icon name="save" class="size-3" />
              Save
            </Button>
          </div>

          <div class="min-h-0 flex-1 p-3">
            {#if activeTab()}
              <div
                class="flex h-full min-h-0 flex-col"
              >
                <div
                  class="mb-2 flex shrink-0 items-center justify-between text-xs text-muted-foreground"
                >
                  <span class="truncate">{activeTab()?.path}</span>
                  <span>{activeTab()?.language}</span>
                </div>
                <Textarea
                  class="min-h-0 flex-1 resize-none overflow-auto font-mono text-xs"
                  value={activeTab()?.draft}
                  oninput={(event) =>
                    updateActiveDraft(event.currentTarget.value)}
                />
              </div>
            {:else}
              <div
                class="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
              >
                Open a text file from the explorer.
              </div>
            {/if}
          </div>
        </div>
      </Resizable.Pane>
    </Resizable.PaneGroup>

    {#if busyMessage || errorMessage}
      <div class="border-t px-3 py-2 text-xs">
        {#if busyMessage}
          <span class="text-muted-foreground">{busyMessage}</span>
        {/if}
        {#if errorMessage}
          <span class="text-red-600">{errorMessage}</span>
        {/if}
      </div>
    {/if}
  </section>
{/if}

<input
  bind:this={fileInputElement}
  type="file"
  class="hidden"
  onchange={(event) => void handleUploadChange(event)}
/>
