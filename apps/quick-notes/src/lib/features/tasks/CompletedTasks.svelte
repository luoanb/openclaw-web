<script lang="ts">
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible";
  import type { QuickTask } from "$lib/core/quick-notes-types";
  import TaskRow from "./TaskRow.svelte";

  let {
    tasks,
    onCompleteTask,
    onRestoreTask,
    onUpdateTask,
    onDeleteTask,
  }: {
    tasks: QuickTask[];
    onCompleteTask: (taskId: string) => void;
    onRestoreTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, content: string) => void;
    onDeleteTask: (taskId: string) => void;
  } = $props();

  let open = $state(false);
</script>

<Collapsible bind:open class="overflow-hidden rounded-lg border bg-card">
  <CollapsibleTrigger class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
    <span>已完成 <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{tasks.length}</span></span>
    <span class="text-muted-foreground">{open ? "收起" : "展开"}</span>
  </CollapsibleTrigger>
  <CollapsibleContent class="border-t">
    {#if tasks.length > 0}
      {#each tasks as task (task.id)}
        <TaskRow
          {task}
          done
          onCompleteTask={onCompleteTask}
          onRestoreTask={onRestoreTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />
      {/each}
    {:else}
      <div class="px-4 py-6 text-sm text-muted-foreground">还没有完成的任务。</div>
    {/if}
  </CollapsibleContent>
</Collapsible>
