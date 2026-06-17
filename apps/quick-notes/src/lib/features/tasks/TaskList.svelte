<script lang="ts">
  import type { QuickTask } from "$lib/core/quick-notes-types";
  import TaskRow from "./TaskRow.svelte";

  let {
    tasks,
    emptyText,
    onCompleteTask,
    onRestoreTask,
    onUpdateTask,
    onDeleteTask,
    onPinTask,
    onUnpinTask,
  }: {
    tasks: QuickTask[];
    emptyText: string;
    onCompleteTask: (taskId: string) => void;
    onRestoreTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, content: string) => void;
    onDeleteTask: (taskId: string) => void;
    onPinTask: (taskId: string) => void;
    onUnpinTask: (taskId: string) => void;
  } = $props();
</script>

{#if tasks.length > 0}
  <div class="overflow-hidden rounded-lg border bg-card">
    {#each tasks as task, index (task.id)}
      <TaskRow
        {task}
        position={index + 1}
        onCompleteTask={onCompleteTask}
        onRestoreTask={onRestoreTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onPinTask={onPinTask}
        onUnpinTask={onUnpinTask}
      />
    {/each}
  </div>
{:else}
  <div class="rounded-lg border border-dashed bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
    {emptyText}
  </div>
{/if}
