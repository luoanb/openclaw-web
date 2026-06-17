<script lang="ts">
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible";
  import type { QuickTask } from "$lib/core/quick-notes-types";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";
  import TaskRow from "./TaskRow.svelte";

  const { t } = getLocaleStore();

  let {
    tasks,
    onCompleteTask,
    onRestoreTask,
    onUpdateTask,
    onDeleteTask,
    onPinTask,
    onUnpinTask,
  }: {
    tasks: QuickTask[];
    onCompleteTask: (taskId: string) => void;
    onRestoreTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, content: string) => void;
    onDeleteTask: (taskId: string) => void;
    onPinTask: (taskId: string) => void;
    onUnpinTask: (taskId: string) => void;
  } = $props();

  let open = $state(false);
</script>

<Collapsible bind:open class="overflow-hidden rounded-lg border bg-card">
  <CollapsibleTrigger class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
    <span>
      {t("common.pinned")}
      <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{tasks.length}</span>
    </span>
    <Icons name={open ? "chevron-up" : "chevron-down"} class="size-4 text-muted-foreground" />
  </CollapsibleTrigger>
  <CollapsibleContent class="border-t">
    {#if tasks.length > 0}
      {#each tasks as task (task.id)}
        <TaskRow
          {task}
          onCompleteTask={onCompleteTask}
          onRestoreTask={onRestoreTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onPinTask={onPinTask}
          onUnpinTask={onUnpinTask}
        />
      {/each}
    {:else}
      <div class="px-4 py-6 text-sm text-muted-foreground">{t("tasks.empty.pinned")}</div>
    {/if}
  </CollapsibleContent>
</Collapsible>
