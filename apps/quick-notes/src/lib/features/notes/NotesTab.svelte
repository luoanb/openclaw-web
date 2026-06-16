<script lang="ts">
  import type { QuickNote } from "$lib/core/quick-notes-types";
  import NoteEditor from "./NoteEditor.svelte";
  import NotesSidebar from "./NotesSidebar.svelte";

  let {
    notes,
    selectedNoteId,
    hasQuery,
    getNoteTitle,
    onCreateNote,
    onSelectNote,
    onUpdateNote,
    onDeleteNote,
  }: {
    notes: QuickNote[];
    selectedNoteId: string | null;
    hasQuery: boolean;
    getNoteTitle: (note: QuickNote) => string;
    onCreateNote: (content: string) => void;
    onSelectNote: (noteId: string) => void;
    onUpdateNote: (noteId: string, content: string) => void;
    onDeleteNote: (noteId: string) => void;
  } = $props();

  let creating = $state(false);
  const selectedNote = $derived(notes.find((note) => note.id === selectedNoteId) ?? null);

  // ── Editor view key ───────────────────────────────────────────────────
  // Incremented ONLY on explicit user actions (click "新增", select a note).
  // NOT on auto-save transitions (creating→saved).
  // This is passed to NoteEditor to control editor lifecycle separately
  // from reactive prop changes.
  let editorViewKey = $state(0);

  function startCreating() {
    creating = true;
    editorViewKey++;
  }

  function selectNote(noteId: string) {
    creating = false;
    editorViewKey++;
    onSelectNote(noteId);
  }

  function createNote(content: string) {
    creating = false;
    onCreateNote(content);
    // editorViewKey stays unchanged → editor survives across creating→saved
  }
</script>

<section class="flex h-full min-h-0">
  <NotesSidebar
    {notes}
    {selectedNoteId}
    getNoteTitle={getNoteTitle}
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
      viewKey={editorViewKey}
      onCreateNote={createNote}
      onUpdateNote={onUpdateNote}
      onDeleteNote={onDeleteNote}
    />
  {/if}
</section>
