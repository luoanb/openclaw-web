<script lang="ts">
  import type { QuickTask } from "$lib/core/quick-notes-types";
  import { formatDateTime } from "$lib/utils";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";

  const { t } = getLocaleStore();

  let {
    task,
    done = false,
    deprecated = false,
    position,
    onCompleteTask,
    onDeprecateTask,
    onRestoreTask,
    onUpdateTask,
    onDeleteTask,
    onPinTask,
    onUnpinTask,
  }: {
    task: QuickTask;
    done?: boolean;
    deprecated?: boolean;
    position?: number;
    onCompleteTask: (taskId: string) => void;
    onDeprecateTask?: (taskId: string) => void;
    onRestoreTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, content: string) => void;
    onDeleteTask: (taskId: string) => void;
    onPinTask?: (taskId: string) => void;
    onUnpinTask?: (taskId: string) => void;
  } = $props();

  let editing = $state(false);
  let draft = $state("");
  let currentTaskId = $state<string | null>(null);
  const archived = $derived(done || deprecated);
  const showPosition = $derived(!archived && position !== undefined);

  $effect(() => {
    if (task.id !== currentTaskId) {
      currentTaskId = task.id;
      draft = task.content;
      editing = false;
    }
  });

  function startEditing() {
    draft = task.content;
    editing = true;
  }

  function saveEdit() {
    const nextContent = draft.trim();

    if (!nextContent) {
      return;
    }

    onUpdateTask(task.id, nextContent);
    editing = false;
  }
</script>

<div
  class="group grid items-center gap-3 border-b px-4 py-3 last:border-b-0 focus-within:bg-muted/40 hover:bg-muted/40 {archived
    ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
    : showPosition
      ? 'grid-cols-[auto_auto_minmax(0,1fr)_auto]'
      : 'grid-cols-[auto_minmax(0,1fr)_auto]'}"
>
  <input
    class="size-4 rounded border-input accent-primary"
    type="checkbox"
    checked={archived}
    aria-label={archived ? t("tasks.action.restore") : t("tasks.action.complete")}
    onchange={() => (archived ? onRestoreTask(task.id) : onCompleteTask(task.id))}
  />

  {#if showPosition}
    <span class="w-6 text-right text-xs tabular-nums text-muted-foreground">
      {position}
    </span>
  {/if}

  <div class="min-w-0">
    {#if editing}
      <form
        class="flex gap-2"
        onsubmit={(event) => {
          event.preventDefault();
          saveEdit();
        }}
      >
        <input
          class="h-8 min-w-0 flex-1 rounded-md border bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          bind:value={draft}
          aria-label={t("tasks.editPlaceholder")}
        />
        <button class="text-xs font-medium text-foreground hover:underline" type="submit">
          {t("common.save")}
        </button>
        <button
          class="text-xs text-muted-foreground hover:text-foreground"
          type="button"
          onclick={() => (editing = false)}
        >
          {t("common.cancel")}
        </button>
      </form>
    {:else}
      <p class="truncate text-sm {archived ? 'text-muted-foreground line-through' : 'text-foreground'}">
        {task.content}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        {#if done}
          {`${t("time.completedAt")} ${formatDateTime(task.completedAt ?? task.updatedAt)}`}
        {:else if deprecated}
          {`${t("time.deprecatedAt")} ${formatDateTime(task.updatedAt)}`}
        {:else}
          {`${t("time.updatedAt")} ${formatDateTime(task.updatedAt)}`}
        {/if}
      </p>
    {/if}
  </div>

  {#if !editing}
    <div class="flex items-center gap-3 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {#if !archived}
        <button
          class="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          type="button"
          onclick={() => (task.pinnedAt ? onUnpinTask?.(task.id) : onPinTask?.(task.id))}
        >
          <Icons name={task.pinnedAt ? "pin-off" : "pin"} class="size-3.5" />
          {task.pinnedAt ? t("common.unpin") : t("common.pin")}
        </button>
        <button
          class="flex items-center gap-1 font-medium text-foreground hover:underline"
          type="button"
          onclick={() => onCompleteTask(task.id)}
        >
          <Icons name="check" class="size-3.5" />
          {t("tasks.action.complete")}
        </button>
        <button
          class="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          type="button"
          onclick={() => onDeprecateTask?.(task.id)}
        >
          <Icons name="archive" class="size-3.5" />
          {t("tasks.action.deprecate")}
        </button>
      {/if}
      <button class="flex items-center gap-1 text-muted-foreground hover:text-foreground" type="button" onclick={startEditing}>
        <Icons name="edit" class="size-3.5" />
        {t("tasks.action.edit")}
      </button>
      <button
        class="flex items-center gap-1 text-muted-foreground hover:text-destructive"
        type="button"
        onclick={() => onDeleteTask(task.id)}
      >
        <Icons name="trash" class="size-3.5" />
        {t("tasks.action.delete")}
      </button>
    </div>
  {/if}
</div>
