<script lang="ts">
  import type { QuickTask } from "$lib/core/quick-notes-types";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import CompletedTasks from "./CompletedTasks.svelte";
  import DeprecatedTasks from "./DeprecatedTasks.svelte";
  import PinnedTasks from "./PinnedTasks.svelte";
  import TaskComposer from "./TaskComposer.svelte";
  import TaskList from "./TaskList.svelte";

  const { t } = getLocaleStore();

  let {
    activeTasks,
    pinnedActiveTasks,
    doneTasks,
    deprecatedTasks,
    hasQuery,
    onCreateTask,
    onCompleteTask,
    onDeprecateTask,
    onRestoreTask,
    onUpdateTask,
    onDeleteTask,
    onPinTask,
    onUnpinTask,
  }: {
    activeTasks: QuickTask[];
    pinnedActiveTasks: QuickTask[];
    doneTasks: QuickTask[];
    deprecatedTasks: QuickTask[];
    hasQuery: boolean;
    onCreateTask: (content: string) => void;
    onCompleteTask: (taskId: string) => void;
    onDeprecateTask: (taskId: string) => void;
    onRestoreTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, content: string) => void;
    onDeleteTask: (taskId: string) => void;
    onPinTask: (taskId: string) => void;
    onUnpinTask: (taskId: string) => void;
  } = $props();
</script>

<section class="flex h-full min-h-0 flex-col">
  <TaskComposer {onCreateTask} />

  <div class="min-h-0 flex-1 overflow-auto p-4">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PinnedTasks
        tasks={pinnedActiveTasks}
        onCompleteTask={onCompleteTask}
        onDeprecateTask={onDeprecateTask}
        onRestoreTask={onRestoreTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onPinTask={onPinTask}
        onUnpinTask={onUnpinTask}
      />

      <div>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">{t("tasks.active")}</h2>
          <span class="text-xs text-muted-foreground">{activeTasks.length}</span>
        </div>
        <TaskList
          tasks={activeTasks}
          emptyText={hasQuery ? t("tasks.empty.search") : t("tasks.empty.active")}
          onCompleteTask={onCompleteTask}
          onDeprecateTask={onDeprecateTask}
          onRestoreTask={onRestoreTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onPinTask={onPinTask}
          onUnpinTask={onUnpinTask}
        />
      </div>

      <CompletedTasks
        tasks={doneTasks}
        onCompleteTask={onCompleteTask}
        onRestoreTask={onRestoreTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />

      <DeprecatedTasks
        tasks={deprecatedTasks}
        onCompleteTask={onCompleteTask}
        onRestoreTask={onRestoreTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    </div>
  </div>
</section>
