<script lang="ts">
  import { onMount } from "svelte";
  import { NoteService } from "$lib/core/notes/note-service";
  import { QuickNotesRepository } from "$lib/core/quick-notes-repository";
  import { QuickNotesStoreService } from "$lib/core/quick-notes-store";
  import type { QuickNotesStore, QuickNotesTab } from "$lib/core/quick-notes-types";
  import { TaskService } from "$lib/core/tasks/task-service";
  import { createLocaleStore, getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";
  import HeaderMenu from "$lib/features/common/HeaderMenu.svelte";
  import SettingsModal from "$lib/features/settings/SettingsModal.svelte";
  import NotesTab from "$lib/features/notes/NotesTab.svelte";
  import TasksTab from "$lib/features/tasks/TasksTab.svelte";

  // ── i18n ──────────────────────────────────────────────────────────────
  createLocaleStore();
  const { t } = getLocaleStore();

  type LoadState = "loading" | "ready" | "error";

  let activeTab = $state<QuickNotesTab>("tasks");
  let searchQuery = $state("");
  let store = $state<QuickNotesStore>(QuickNotesStoreService.createEmptyStore());
  let loadState = $state<LoadState>("loading");
  let loadError = $state<string | null>(null);
  let saveError = $state<string | null>(null);
  let pendingStore = $state<QuickNotesStore | null>(null);
  let selectedNoteId = $state<string | null>(null);
  let settingsOpen = $state(false);

  const activeTasks = $derived(
    TaskService.getActiveTasks(store.tasks, activeTab === "tasks" ? searchQuery : "")
  );
  const pinnedActiveTasks = $derived(
    TaskService.getPinnedActiveTasks(store.tasks, activeTab === "tasks" ? searchQuery : "")
  );
  const doneTasks = $derived(
    TaskService.getDoneTasks(store.tasks, activeTab === "tasks" ? searchQuery : "")
  );
  const visibleNotes = $derived(
    NoteService.getNotes(store.notes, activeTab === "notes" ? searchQuery : "")
  );
  const pinnedNotes = $derived(
    NoteService.getPinnedNotes(store.notes, activeTab === "notes" ? searchQuery : "")
  );
  const hasQuery = $derived(searchQuery.trim().length > 0);

  onMount(() => {
    void loadStore();
  });

  async function loadStore() {
    loadState = "loading";
    loadError = null;

    try {
      store = await QuickNotesRepository.loadStore();
      selectedNoteId = NoteService.getNotes(store.notes, "")[0]?.id ?? null;
      loadState = "ready";
    } catch (error) {
      loadError = getErrorMessage(error, t("error.loadFailed"));
      loadState = "error";
    }
  }

  function selectTab(tab: QuickNotesTab) {
    activeTab = tab;
    searchQuery = "";
  }

  async function persist(nextStore: QuickNotesStore) {
    store = nextStore;
    pendingStore = nextStore;
    saveError = null;

    try {
      store = await QuickNotesRepository.saveStore(nextStore);
      pendingStore = null;
    } catch (error) {
      saveError = getErrorMessage(error, t("error.saveFailed"));
    }
  }

  function retrySave() {
    if (pendingStore) {
      void persist(pendingStore);
    }
  }

  function createTask(content: string) {
    const tasks = TaskService.createTask(store.tasks, content, getNow());
    void persist(QuickNotesStoreService.withTasks(store, tasks));
  }

  function updateTask(taskId: string, content: string) {
    const tasks = TaskService.updateTaskContent(store.tasks, taskId, content, getNow());
    void persist(QuickNotesStoreService.withTasks(store, tasks));
  }

  function completeTask(taskId: string) {
    const tasks = TaskService.completeTask(store.tasks, taskId, getNow());
    void persist(QuickNotesStoreService.withTasks(store, tasks));
  }

  function restoreTask(taskId: string) {
    const tasks = TaskService.restoreTask(store.tasks, taskId, getNow());
    void persist(QuickNotesStoreService.withTasks(store, tasks));
  }

  function deleteTask(taskId: string) {
    const tasks = TaskService.deleteTask(store.tasks, taskId);
    void persist(QuickNotesStoreService.withTasks(store, tasks));
  }

  function pinTask(taskId: string) {
    const tasks = TaskService.pinTask(store.tasks, taskId, getNow());
    void persist(QuickNotesStoreService.withTasks(store, tasks));
  }

  function unpinTask(taskId: string) {
    const tasks = TaskService.unpinTask(store.tasks, taskId);
    void persist(QuickNotesStoreService.withTasks(store, tasks));
  }

  function createNote(content: string) {
    const notes = NoteService.createNote(store.notes, content, getNow());
    selectedNoteId = notes[0]?.id ?? null;
    void persist(QuickNotesStoreService.withNotes(store, notes));
  }

  function updateNote(noteId: string, content: string) {
    const notes = NoteService.updateNoteContent(store.notes, noteId, content, getNow());
    void persist(QuickNotesStoreService.withNotes(store, notes));
  }

  function deleteNote(noteId: string) {
    const notes = NoteService.deleteNote(store.notes, noteId);
    if (selectedNoteId === noteId) {
      selectedNoteId = null;
    }
    void persist(QuickNotesStoreService.withNotes(store, notes));
  }

  function pinNote(noteId: string) {
    const notes = NoteService.pinNote(store.notes, noteId, getNow());
    void persist(QuickNotesStoreService.withNotes(store, notes));
  }

  function unpinNote(noteId: string) {
    const notes = NoteService.unpinNote(store.notes, noteId);
    void persist(QuickNotesStoreService.withNotes(store, notes));
  }

  function getNow(): string {
    return new Date().toISOString();
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
</script>

<svelte:head>
  <title>{t("app.title")}</title>
</svelte:head>

<main class="flex h-dvh w-dvw flex-col bg-background text-foreground">
  <header class="flex h-14 shrink-0 items-center gap-4 border-b px-4">
    <div class="flex min-w-0 items-center gap-4">
      <h1 class="text-sm font-semibold">{t("app.title")}</h1>
      <nav class="flex h-14 items-end gap-1" aria-label={t("tab.tasks")}>
        <button
          class="h-14 border-b-2 px-3 text-sm font-medium transition-colors hover:text-foreground"
          class:border-foreground={activeTab === "tasks"}
          class:text-foreground={activeTab === "tasks"}
          class:border-transparent={activeTab !== "tasks"}
          class:text-muted-foreground={activeTab !== "tasks"}
          type="button"
          aria-current={activeTab === "tasks" ? "page" : undefined}
          onclick={() => selectTab("tasks")}
        >
          {t("tab.tasks")}
        </button>
        <button
          class="h-14 border-b-2 px-3 text-sm font-medium transition-colors hover:text-foreground"
          class:border-foreground={activeTab === "notes"}
          class:text-foreground={activeTab === "notes"}
          class:border-transparent={activeTab !== "notes"}
          class:text-muted-foreground={activeTab !== "notes"}
          type="button"
          aria-current={activeTab === "notes" ? "page" : undefined}
          onclick={() => selectTab("notes")}
        >
          {t("tab.notes")}
        </button>
      </nav>
    </div>

    <div class="relative ml-auto w-72">
      <label class="sr-only" for="current-tab-search">{t("search.placeholder")}</label>
      <Icons
        name="search"
        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id="current-tab-search"
        class="h-8 w-full rounded-md border bg-input/20 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        bind:value={searchQuery}
        placeholder={t("search.placeholder")}
      />
    </div>

    <HeaderMenu onOpenSettings={() => (settingsOpen = true)} />
  </header>

  {#if loadState === "loading"}
    <section class="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
      {t("error.loadFailed")}
    </section>
  {:else if loadState === "error"}
    <section class="grid min-h-0 flex-1 place-items-center p-6 text-center">
      <div class="max-w-sm rounded-lg border bg-card p-5">
        <h2 class="text-sm font-semibold">{t("error.loadFailed")}</h2>
        <p class="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <button
          class="mt-4 h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          type="button"
          onclick={() => void loadStore()}
        >
          {t("error.retry")}
        </button>
      </div>
    </section>
  {:else}
    {#if saveError}
      <div class="flex shrink-0 items-center justify-between border-b bg-destructive/5 px-4 py-2 text-sm">
        <span class="text-destructive">{saveError}</span>
        <button class="font-medium text-destructive hover:underline" type="button" onclick={retrySave}>
          {t("error.retrySave")}
        </button>
      </div>
    {/if}

    <div class="min-h-0 flex-1">
      {#if activeTab === "tasks"}
        <TasksTab
          {activeTasks}
          {pinnedActiveTasks}
          {doneTasks}
          {hasQuery}
          onCreateTask={createTask}
          onCompleteTask={completeTask}
          onRestoreTask={restoreTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onPinTask={pinTask}
          onUnpinTask={unpinTask}
        />
      {:else}
        <NotesTab
          notes={visibleNotes}
          {pinnedNotes}
          {selectedNoteId}
          {hasQuery}
          getNoteTitle={NoteService.getNoteTitle}
          onCreateNote={createNote}
          onSelectNote={(noteId) => (selectedNoteId = noteId)}
          onUpdateNote={updateNote}
          onDeleteNote={deleteNote}
          onPinNote={pinNote}
          onUnpinNote={unpinNote}
        />
      {/if}
    </div>
  {/if}
</main>

<SettingsModal open={settingsOpen} onClose={() => (settingsOpen = false)} />
