<script lang="ts">
  import type { QuickNote } from "$lib/core/quick-notes-types";
  import NoteEditor from "./NoteEditor.svelte";
  import NotesSidebar from "./NotesSidebar.svelte";

  let {
    notes,
    selectedNoteId,
    hasQuery,
    getNoteTitle,
    getNoteSummary,
    onCreateNote,
    onSelectNote,
    onUpdateNote,
    onDeleteNote,
  }: {
    notes: QuickNote[];
    selectedNoteId: string | null;
    hasQuery: boolean;
    getNoteTitle: (note: QuickNote) => string;
    getNoteSummary: (note: QuickNote) => string;
    onCreateNote: (content: string) => void;
    onSelectNote: (noteId: string) => void;
    onUpdateNote: (noteId: string, content: string) => void;
    onDeleteNote: (noteId: string) => void;
  } = $props();

  let creating = $state(false);
  const selectedNote = $derived(notes.find((note) => note.id === selectedNoteId) ?? null);

  function startCreating() {
    creating = true;
  }

  function selectNote(noteId: string) {
    creating = false;
    onSelectNote(noteId);
  }

  function createNote(content: string) {
    creating = false;
    onCreateNote(content);
  }
</script>

<section class="flex h-full min-h-0">
  <NotesSidebar
    {notes}
    {selectedNoteId}
    getNoteTitle={getNoteTitle}
    getNoteSummary={getNoteSummary}
    onCreateNote={startCreating}
    onSelectNote={selectNote}
  />

  {#if hasQuery && notes.length === 0}
    <div class="grid min-w-0 flex-1 place-items-center p-8 text-center">
      <div>
        <h2 class="text-sm font-semibold">没有匹配的速记</h2>
        <p class="mt-2 text-sm text-muted-foreground">清空搜索后会恢复全部速记。</p>
      </div>
    </div>
  {:else}
    <NoteEditor
      note={selectedNote}
      title={selectedNote ? getNoteTitle(selectedNote) : ""}
      {creating}
      onCreateNote={createNote}
      onUpdateNote={onUpdateNote}
      onDeleteNote={onDeleteNote}
    />
  {/if}
</section>
