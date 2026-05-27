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
  import type {
    FileActionResult,
    FileEntry,
    RuntimeSnapshot,
    Unsubscribe,
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

  function debugFiles(event: string, details?: unknown) {
    console.debug("[FilesPanel]", event, details ?? "");
  }

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
    debugFiles("loadDirectory:start", { path, options });
    busyMessage = `Loading ${path}`;
    errorMessage = null;
    try {
      const directory = await fileService.listDirectory(
        runtimeManager.currentSession,
        path
      );
      debugFiles("loadDirectory:result", {
        path: directory.path,
        entries: directory.entries.length,
        options,
      });
      workspace.setDirectory(directory);
      if (options.expand) workspace.setExpanded(directory.path, true);
      if (options.select) workspace.selectPath(directory.path);
      syncSnapshot();
    } catch (error) {
      console.log(error);
      errorMessage = formatError(error);
      debugFiles("loadDirectory:error", { path, error });
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
    debugFiles("toggleDirectory:start", entry);
    if (!workspace || !workspaceSnapshot) return;
    const cached = findDirectory(entry.path);
    if (cached?.expanded) {
      workspace.setExpanded(entry.path, false);
      workspace.selectPath(entry.path);
      syncSnapshot();
      debugFiles("toggleDirectory:collapsed", { path: entry.path });
      return;
    }

    await loadDirectory(entry.path, { expand: true, select: true });
    debugFiles("toggleDirectory:loaded", { path: entry.path });
  }

  async function openFile(entry: FileEntry) {
    debugFiles("openFile:start", entry);
    if (!runtimeManager.currentSession || !workspace) return;
    workspace.selectPath(entry.path);
    syncSnapshot();
    if (!FileTextPolicy.canReadSize(entry.size)) {
      errorMessage =
        "Only text files under the size limit are supported in this preview.";
      debugFiles("openFile:blockedBySize", { path: entry.path, size: entry.size });
      return;
    }

    busyMessage = `Opening ${entry.path}`;
    errorMessage = null;
    try {
      const file = await fileService.readTextFile(
        runtimeManager.currentSession,
        entry.path
      );
      debugFiles("openFile:readTextFile", {
        path: file.path,
        size: file.size,
        contentLength: file.content.length,
      });
      workspace.openTextFile(file, FileLanguageResolver.getLabel(entry.path));
      syncSnapshot();
      debugFiles("openFile:opened", {
        path: file.path,
        activeTabPath: workspace.getSnapshot().activeTabPath,
      });
    } catch (error) {
      errorMessage = formatError(error);
      debugFiles("openFile:error", error);
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
    debugFiles("createFile:click", { parentPath });
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
    if (!directory || !fileInputElement) return;
    uploadTargetDirectory = directory;
    fileInputElement.value = "";
    fileInputElement.click();
  }

  async function handleUploadChange(event: Event) {
    if (!runtimeManager.currentSession || !workspace || !uploadTargetDirectory) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const targetDirectory = uploadTargetDirectory;
    const targetPath = joinPath(targetDirectory, file.name);
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
        return;
      }
      await loadDirectory(targetDirectory);
    } catch (error) {
      errorMessage = formatError(error);
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
    if (!target || target.kind === "workspace") return;
    await deletePath(target.path, target.kind);
  }

  async function downloadPath(path: string) {
    if (!runtimeManager.currentSession) return;
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
    } catch (error) {
      errorMessage = formatError(error);
    } finally {
      busyMessage = null;
    }
  }

  function copyTarget(target = menuTarget) {
    if (!workspace || !target || target.kind === "workspace") return;
    workspace.setCopiedPath(target.path, target.kind);
    syncSnapshot();
  }

  async function pasteIntoTarget(target = menuTarget) {
    if (!runtimeManager.currentSession || !workspace || !target) return;
    const clipboard = workspace.getClipboard();
    const targetDirectory = menuTargetDirectory(target);
    if (!clipboard || !targetDirectory) return;
    const targetPath = joinPath(targetDirectory, clipboard.name);
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
        return;
      }
      await loadDirectory(targetDirectory);
    } catch (error) {
      errorMessage = formatError(error);
    } finally {
      busyMessage = null;
    }
  }

  async function createDirectory(parentPath: string) {
    debugFiles("createDirectory:click", { parentPath });
    await createPath(parentPath, "directory");
  }

  async function createPath(parentPath: string, kind: "file" | "directory") {
    debugFiles("createPath:start", { parentPath, kind });
    if (!runtimeManager.currentSession || !workspace) return;
    const name = window.prompt(
      kind === "file" ? "New file name" : "New folder name"
    );
    debugFiles("createPath:promptResult", { parentPath, kind, name });
    if (!name) return;
    const path = joinPath(parentPath, name);
    const result =
      kind === "file"
        ? await fileService.createFile(runtimeManager.currentSession, path)
        : await fileService.createDirectory(
            runtimeManager.currentSession,
            path
          );
    debugFiles("createPath:serviceResult", { path, kind, result });
    if (!result.ok) {
      errorMessage = result.message;
      return;
    }
    await loadDirectory(parentPath);
    debugFiles("createPath:directoryReloaded", { parentPath, path, kind });
  }

  async function handleEntryClick(entry: FileEntry) {
    debugFiles("entryClick", entry);
    if (entry.kind === "directory") {
      await toggleDirectory(entry);
      return;
    }
    await openFile(entry);
  }

  async function renamePath(path: string) {
    if (!runtimeManager.currentSession || !workspace) return;
    const nextName = window.prompt("Rename to", basename(path));
    if (!nextName) return;
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
    if (!runtimeManager.currentSession || !workspace) return;
    const confirmed = window.confirm(
      `Delete ${path}${kind === "directory" ? " and its contents" : ""}?`
    );
    if (!confirmed) return;
    const result = await fileService.delete(
      runtimeManager.currentSession,
      path,
      { recursive: kind === "directory" }
    );
    if (!result.ok) {
      errorMessage = result.message;
      return;
    }
    workspace.removePathFromCache(path);
    await loadDirectory(workspace.getParentDirectory(path));
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
