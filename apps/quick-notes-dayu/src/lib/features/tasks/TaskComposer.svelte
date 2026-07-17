<script lang="ts">
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";

  const { t } = getLocaleStore();

  let {
    onCreateTask,
    disabled = false,
  }: {
    onCreateTask: (content: string) => void;
    disabled?: boolean;
  } = $props();

  let content = $state("");

  function submitTask() {
    const nextContent = content.trim();

    if (!nextContent) {
      return;
    }

    onCreateTask(nextContent);
    content = "";
  }
</script>

<form
  class="flex gap-2 border-b bg-background/95 p-4"
  onsubmit={(event) => {
    event.preventDefault();
    submitTask();
  }}
>
  <label class="sr-only" for="task-content">{t("tasks.addTask")}</label>
  <input
    id="task-content"
    class="h-9 min-w-0 flex-1 rounded-md border bg-input/20 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
    bind:value={content}
    placeholder={t("tasks.addTask")}
    disabled={disabled}
  />
  <button
    class="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
    type="submit"
    disabled={disabled || !content.trim()}
  >
    {t("common.save")}
  </button>
</form>
