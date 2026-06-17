<script lang="ts">
  import type { QuickNote } from "$lib/core/quick-notes-types";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";
  import NoteListItem from "./NoteListItem.svelte";
  import PinnedNotes from "./PinnedNotes.svelte";

  const { t } = getLocaleStore();

  let {
    notes,
    pinnedNotes,
    selectedNoteId,
    getNoteTitle,
    onCreateNote,
    onSelectNote,
    onDeleteNote,
    onPinNote,
    onUnpinNote,
  }: {
    notes: QuickNote[];
    pinnedNotes: QuickNote[];
    selectedNoteId: string | null;
    getNoteTitle: (note: QuickNote) => string;
    onCreateNote: () => void;
    onSelectNote: (noteId: string) => void;
    onDeleteNote: (noteId: string) => void;
    onPinNote: (noteId: string) => void;
    onUnpinNote: (noteId: string) => void;
  } = $props();
</script>

<aside class="flex w-80 shrink-0 flex-col border-r bg-card/60">
  <div class="flex items-center justify-between border-b p-3">
    <div>
      <h2 class="text-sm font-semibold">{t("tab.notes")}</h2>
      <p class="text-xs text-muted-foreground">{notes.length} {t("notes.emptyCount")}</p>
    </div>
    <button
      class="flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/80"
      type="button"
      onclick={onCreateNote}
    >
      <Icons name="plus" class="size-3.5" />
      {t("notes.addNote")}
    </button>
  </div>

  <div class="min-h-0 flex-1 overflow-auto p-2">
    <div class="mb-3">
      <PinnedNotes
        notes={pinnedNotes}
        {selectedNoteId}
        getNoteTitle={getNoteTitle}
        onSelectNote={onSelectNote}
        onDeleteNote={onDeleteNote}
        onPinNote={onPinNote}
        onUnpinNote={onUnpinNote}
      />
    </div>

    {#if notes.length > 0}
      <div class="flex flex-col gap-1">
        {#each notes as note (note.id)}
          <NoteListItem
            {note}
            selected={selectedNoteId === note.id}
            getNoteTitle={getNoteTitle}
            onSelectNote={onSelectNote}
            onDeleteNote={onDeleteNote}
            onPinNote={onPinNote}
            onUnpinNote={onUnpinNote}
          />
        {/each}
      </div>
    {:else}
      <div class="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        {t("notes.empty")}
      </div>
    {/if}
  </div>
</aside>
