<script lang="ts">
  import Dialog from "$lib/components/ui/dialog/dialog.svelte";
  import DialogContent from "$lib/components/ui/dialog/dialog-content.svelte";
  import DialogOverlay from "$lib/components/ui/dialog/dialog-overlay.svelte";
  import DialogPortal from "$lib/components/ui/dialog/dialog-portal.svelte";
  import DialogTitle from "$lib/components/ui/dialog/dialog-title.svelte";
  import DialogDescription from "$lib/components/ui/dialog/dialog-description.svelte";
  import DialogClose from "$lib/components/ui/dialog/dialog-close.svelte";
  import DropdownMenu from "$lib/components/ui/dropdown-menu/dropdown-menu.svelte";
  import DropdownMenuContent from "$lib/components/ui/dropdown-menu/dropdown-menu-content.svelte";
  import DropdownMenuItem from "$lib/components/ui/dropdown-menu/dropdown-menu-item.svelte";
  import DropdownMenuPortal from "$lib/components/ui/dropdown-menu/dropdown-menu-portal.svelte";
  import DropdownMenuTrigger from "$lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { WebContainer } from "@webcontainer/api";
  import { toast } from "$lib/ui/toast/toast.svelte";
  import { cn } from "$lib/utils.js";
  import {
    bootWebContainer,
    ensureWorkspace,
    mountImportedWorkspace,
  } from "$lib/core/webcontainer/boot";
  import {
    WorkspaceTreeIdbStore,
    IdbQuotaError,
    InvalidSnapshotError,
    exportKindIsImportable,
    type WorkspaceExportKind,
    type WorkspaceTreeSnapshotRecord,
  } from "$lib/core/webcontainer/fileSystem";
  import {
    EXPORT_KIND_LABELS,
    EXPORT_ROOT_PATH,
    WORKSPACE_KEY,
  } from "$lib/core/webcontainer/workspaceConstants";

  type Props = {
    isolated: boolean;
    busy: boolean;
    open?: boolean;
    wirePreview: (wc: WebContainer) => void;
    restartProjectAfterImport: (wc: WebContainer) => Promise<void>;
  };

  let {
    isolated,
    busy,
    open = $bindable(false),
    wirePreview,
    restartProjectAfterImport,
  }: Props = $props();

  const store = new WorkspaceTreeIdbStore();

  let snapshots = $state<WorkspaceTreeSnapshotRecord[]>([]);
  let exporting = $state(false);
  let importingId = $state<string | null>(null);

  const exportActions = (
    [
      "json-tree",
      "binary-snapshot",
      "zip-archive",
    ] as const satisfies readonly WorkspaceExportKind[]
  ).map((kind) => ({ kind, label: EXPORT_KIND_LABELS[kind] }));

  const actionsLocked = $derived(
    !isolated || busy || exporting || importingId !== null,
  );

  function u8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(u8.byteLength);
    new Uint8Array(out).set(u8);
    return out;
  }

  async function refreshSnapshots(): Promise<void> {
    try {
      snapshots = await store.listSnapshots(WORKSPACE_KEY);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`读取快照列表失败：${msg}`, { variant: "error" });
    }
  }

  $effect(() => {
    if (open) void refreshSnapshots();
  });

  function formatExportKind(k: WorkspaceExportKind): string {
    return EXPORT_KIND_LABELS[k] ?? k;
  }

  async function runExport(kind: WorkspaceExportKind): Promise<void> {
    if (actionsLocked) return;
    exporting = true;
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      await ensureWorkspace(wc);

      if (kind === "json-tree") {
        const tree = await wc.export(EXPORT_ROOT_PATH, { format: "json" });
        await store.putSnapshot({
          workspaceKey: WORKSPACE_KEY,
          exportRootPath: EXPORT_ROOT_PATH,
          exportKind: "json-tree",
          tree,
        });
      } else if (kind === "binary-snapshot") {
        const u8 = await wc.export(EXPORT_ROOT_PATH, { format: "binary" });
        await store.putSnapshot({
          workspaceKey: WORKSPACE_KEY,
          exportRootPath: EXPORT_ROOT_PATH,
          exportKind: "binary-snapshot",
          binaryPayload: u8ToArrayBuffer(u8),
        });
      } else {
        const u8 = await wc.export(EXPORT_ROOT_PATH, { format: "zip" });
        await store.putSnapshot({
          workspaceKey: WORKSPACE_KEY,
          exportRootPath: EXPORT_ROOT_PATH,
          exportKind: "zip-archive",
          binaryPayload: u8ToArrayBuffer(u8),
        });
      }

      toast("已导出并保存到本地列表", { variant: "success" });
      await refreshSnapshots();
    } catch (e) {
      if (e instanceof IdbQuotaError) {
        toast("存储空间不足，无法保存快照（IndexedDB 配额）。", {
          variant: "error",
        });
      } else if (e instanceof InvalidSnapshotError) {
        toast(`导出数据无效：${e.message}`, { variant: "error" });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        toast(`导出失败：${msg}`, { variant: "error" });
      }
    } finally {
      exporting = false;
    }
  }

  async function onImport(snapshotId: string): Promise<void> {
    if (!isolated || busy || exporting) return;
    importingId = snapshotId;
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      const snap = await store.getSnapshot(snapshotId);
      if (!exportKindIsImportable(snap.exportKind)) {
        toast("ZIP 归档无法导入回 WebContainer（仅 json/binary 可 mount）。", {
          variant: "warning",
        });
        return;
      }
      const payload = snap.tree ?? snap.binaryPayload;
      if (!payload) {
        toast("快照缺少可挂载内容。", { variant: "error" });
        return;
      }
      await mountImportedWorkspace(wc, payload);
      await restartProjectAfterImport(wc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`导入或重装失败：${msg}`, { variant: "error" });
    } finally {
      importingId = null;
    }
  }
</script>

<Dialog bind:open>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      class="fixed left-1/2 top-1/2 z-[60] flex max-h-[min(100%-2rem,32rem)] w-[min(100%-2rem,26rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-popover p-4 pb-12 shadow-lg outline-none"
    >
      <DialogTitle
        class="pr-8 text-base font-semibold tracking-wide text-foreground"
      >
        工作区文件
      </DialogTitle>
      <DialogDescription class="sr-only">
        导出或导入 WebContainer 工作区快照；快照保存在本机 IndexedDB。
      </DialogDescription>

      <div class="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={actionsLocked}
            aria-label="导出快照"
            class={cn(
              "inline-flex h-9 min-w-[7.5rem] items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-[13px] font-medium leading-none shadow-sm transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=open]:bg-muted",
              actionsLocked && "pointer-events-none opacity-45",
            )}
          >
            <span>{exporting ? "导出中…" : "导出"}</span>
            <svg
              class="size-[14px] shrink-0"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"
            >
              <path
                d="M3 4.5l3 3 3-3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              class={cn(
                "z-[100] min-w-[8rem] overflow-hidden p-1 outline-none",
                "rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
              )}
              sideOffset={6}
              align="start"
            >
              {#each exportActions as action (action.kind)}
                <DropdownMenuItem
                  textValue={action.label}
                  disabled={actionsLocked}
                  onSelect={() => void runExport(action.kind)}
                  class={cn(
                    "relative flex min-h-8 cursor-pointer select-none items-center rounded-md px-2 py-2 text-[13px] leading-snug text-foreground outline-none",
                    "data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
                  )}
                >
                  {action.label}
                </DropdownMenuItem>
              {/each}
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      </div>

      {#if !isolated}
        <p class="text-xs text-muted-foreground">
          需要 crossOriginIsolated（请通过本 demo 的 dev/preview
          访问）才能导出或导入。
        </p>
      {/if}

      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if snapshots.length === 0}
          <p class="py-6 text-center text-sm text-muted-foreground">
            暂无导出，请点击上方「导出」并在菜单中选择导出方式。
          </p>
        {:else}
          <ul class="flex flex-col gap-1">
            {#each snapshots as row (row.snapshotId)}
              <li
                class={cn(
                  "group relative flex min-h-10 flex-wrap items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                  "hover:bg-muted",
                )}
              >
                <div class="min-w-0 flex-1 text-xs leading-snug">
                  <div class="truncate font-medium text-foreground">
                    {row.exportRootPath}
                  </div>
                  <div class="mt-0.5 text-muted-foreground">
                    {new Date(row.savedAt).toLocaleString()} · {formatExportKind(
                      row.exportKind,
                    )}
                  </div>
                </div>
                {#if exportKindIsImportable(row.exportKind)}
                  <div
                    class={cn(
                      "shrink-0 transition-opacity",
                      "opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100",
                      "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                    )}
                  >
                    <Button
                      variant="ghost"
                      class="text-xs"
                      disabled={actionsLocked}
                      onclick={() => void onImport(row.snapshotId)}
                    >
                      {importingId === row.snapshotId ? "导入中…" : "导入"}
                    </Button>
                  </div>
                {:else}
                  <span
                    class="shrink-0 text-[11px] text-muted-foreground"
                    title="官方 API 仅 json/binary 可 mount"
                  >
                    ZIP 不可导入
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <DialogClose
        class="absolute right-3 top-3 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="关闭"
      >
        <svg class="size-4" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 3l6 6M9 3L3 9"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</Dialog>
