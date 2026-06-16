<script lang="ts">
  import type { QuickTask } from "$lib/core/quick-notes-types";

  let {
    task,
    done = false,
    position,
    onCompleteTask,
    onRestoreTask,
    onUpdateTask,
    onDeleteTask,
  }: {
    task: QuickTask;
    done?: boolean;
    position?: number;
    onCompleteTask: (taskId: string) => void;
    onRestoreTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, content: string) => void;
    onDeleteTask: (taskId: string) => void;
  } = $props();

  let editing = $state(false);
  let draft = $state("");
  let currentTaskId = $state<string | null>(null);

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
  class="grid items-center gap-3 border-b px-4 py-3 last:border-b-0 {done
    ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
    : 'grid-cols-[auto_auto_minmax(0,1fr)_auto]'}"
>
  <input
    class="size-4 rounded border-input accent-primary"
    type="checkbox"
    checked={done}
    aria-label={done ? "恢复任务" : "完成任务"}
    onchange={() => (done ? onRestoreTask(task.id) : onCompleteTask(task.id))}
  />

  {#if !done}
    <span class="w-6 text-right text-xs tabular-nums text-muted-foreground" aria-label={`第 ${position} 项`}>
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
          aria-label="编辑任务"
        />
        <button class="text-xs font-medium text-foreground hover:underline" type="submit">
          保存
        </button>
        <button
          class="text-xs text-muted-foreground hover:text-foreground"
          type="button"
          onclick={() => (editing = false)}
        >
          取消
        </button>
      </form>
    {:else}
      <p class="truncate text-sm {done ? 'text-muted-foreground line-through' : 'text-foreground'}">
        {task.content}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        {done ? `完成于 ${task.completedAt ?? task.updatedAt}` : `更新于 ${task.updatedAt}`}
      </p>
    {/if}
  </div>

  {#if !editing}
    <div class="flex items-center gap-3 text-xs">
      {#if !done}
        <button
          class="font-medium text-foreground hover:underline"
          type="button"
          onclick={() => onCompleteTask(task.id)}
        >
          完成
        </button>
      {/if}
      <button class="text-muted-foreground hover:text-foreground" type="button" onclick={startEditing}>
        编辑
      </button>
      <button
        class="text-muted-foreground hover:text-destructive"
        type="button"
        onclick={() => onDeleteTask(task.id)}
      >
        删除
      </button>
    </div>
  {/if}
</div>
