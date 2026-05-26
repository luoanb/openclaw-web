<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
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
  import type { FileEntry, RuntimeSnapshot, Unsubscribe } from "os-core";

  type Props = {
    onOpenRuntime?: () => void;
  };

  let { onOpenRuntime }: Props = $props();

  const runtimeManager = RuntimeManagerProvider.getRuntimeManager();
  const fileService = FileServiceProvider.getFileService();

  let runtimeSnapshot: RuntimeSnapshot = $state(runtimeManager.getSnapshot());
  let workspace: FileWorkspaceState | null = null;
  let workspaceSnapshot: FileWorkspaceSnapshot | null = $state(null);
  let pathInput = $state("");
  let busyMessage: string | null = $state(null);
  let errorMessage: string | null = $state(null);
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
      console.log(error);
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
    workspace.selectPath(entry.path);
    syncSnapshot();
    if (
      !FileTextPolicy.isTextPath(entry.path) ||
      !FileTextPolicy.canReadSize(entry.size)
    ) {
      errorMessage =
        "Only text files under the size limit are supported in this preview.";
      return;
    }

    busyMessage = `Opening ${entry.path}`;
    errorMessage = null;
    try {
      const file = await fileService.readTextFile(
        runtimeManager.currentSession,
        entry.path
      );
      workspace.openTextFile(file, FileLanguageResolver.getLabel(entry.path));
      syncSnapshot();
    } catch (error) {
      errorMessage = formatError(error);
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

  async function createDirectory(parentPath: string) {
    await createPath(parentPath, "directory");
  }

  async function createPath(parentPath: string, kind: "file" | "directory") {
    if (!runtimeManager.currentSession || !workspace) return;
    const name = window.prompt(
      kind === "file" ? "New file name" : "New folder name"
    );
    if (!name) return;
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
</script>

{#if runtimeSnapshot.status !== "running"}
  <section
    class="flex min-h-[20rem] flex-col items-center justify-center rounded-lg border bg-muted/30 p-6 text-center"
  >
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
              <Button type="submit" size="sm" variant="outline">Go</Button>
            </form>
            <div class="mt-2 flex items-center justify-between">
              <div class="text-xs font-medium">Explorer</div>
              <Button
                size="sm"
                variant="ghost"
                class="h-7 px-2 text-xs"
                onclick={() => void refreshOpenedDirectories()}
              >
                Refresh
              </Button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto p-1 text-xs">
            {#if !workspaceSnapshot}
              <div class="p-3 text-muted-foreground">Preparing files...</div>
            {:else if visibleRows().length === 0}
              <div class="p-3 text-muted-foreground">
                No files in this directory.
              </div>
            {:else}
              {#each visibleRows() as row (row.entry.path)}
                <ContextMenu.Root>
                  <ContextMenu.Trigger>
                    <button
                      type="button"
                      class={`flex h-7 w-full items-center gap-1 rounded px-2 text-left hover:bg-muted ${workspaceSnapshot.selectedPath === row.entry.path ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                      style={`padding-left: ${row.depth * 0.875 + 0.5}rem`}
                      onclick={() =>
                        row.entry.kind === "directory"
                          ? void toggleDirectory(row.entry)
                          : void openFile(row.entry)}
                    >
                      <span class="w-4 shrink-0"
                        >{row.entry.kind === "directory"
                          ? findDirectory(row.entry.path)?.expanded
                            ? "v"
                            : ">"
                          : "-"}</span
                      >
                      <span class="truncate">{row.entry.name}</span>
                    </button>
                  </ContextMenu.Trigger>
                  <ContextMenu.Content>
                    {#if row.entry.kind === "directory"}
                      <ContextMenu.Item
                        onclick={() => void createFile(row.entry.path)}
                        >New file</ContextMenu.Item
                      >
                      <ContextMenu.Item
                        onclick={() => void createDirectory(row.entry.path)}
                        >New folder</ContextMenu.Item
                      >
                      <ContextMenu.Separator />
                    {/if}
                    <ContextMenu.Item
                      onclick={() => void renamePath(row.entry.path)}
                      >Rename</ContextMenu.Item
                    >
                    <ContextMenu.Item
                      onclick={() =>
                        void deletePath(row.entry.path, row.entry.kind)}
                      >Delete</ContextMenu.Item
                    >
                  </ContextMenu.Content>
                </ContextMenu.Root>
              {/each}
            {/if}
          </div>
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
                      class="rounded px-1 hover:bg-muted-foreground/10"
                      onclick={(event) => {
                        event.stopPropagation();
                        closeTab(tab.path);
                      }}
                      onkeydown={(event) => {
                        if (event.key === "Enter") closeTab(tab.path);
                      }}
                    >
                      x
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
              Save
            </Button>
          </div>

          <div class="min-h-0 flex-1 p-3">
            {#if activeTab()}
              <div
                class="mb-2 flex items-center justify-between text-xs text-muted-foreground"
              >
                <span class="truncate">{activeTab()?.path}</span>
                <span>{activeTab()?.language}</span>
              </div>
              <Textarea
                class="h-full min-h-[24rem] resize-none font-mono text-xs"
                value={activeTab()?.draft}
                oninput={(event) =>
                  updateActiveDraft(event.currentTarget.value)}
              />
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
