<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { QuickNote } from "$lib/core/quick-notes-types";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icon from "$lib/features/common/Icons.svelte";
  import NotesSidebar from "./NotesSidebar.svelte";

  const { t } = getLocaleStore();

  let {
    open = $bindable(false),
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
    open: boolean;
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

  function createNote() {
    onCreateNote();
    open = false;
  }

  function selectNote(noteId: string) {
    onSelectNote(noteId);
    open = false;
  }
</script>

<DialogPrimitive.Root bind:open>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0"
    />
    <DialogPrimitive.Content
      class="fixed inset-y-0 left-0 z-50 flex w-[min(85vw,20rem)] flex-col border-r bg-card text-card-foreground shadow-lg outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left-10 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left-10"
    >
      <DialogPrimitive.Title class="sr-only">{t("tab.notes")}</DialogPrimitive.Title>
      <DialogPrimitive.Close
        class="absolute right-2 top-3 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label={t("common.close")}
      >
        <Icon name="close" class="size-4" />
      </DialogPrimitive.Close>
      <NotesSidebar
        {notes}
        {pinnedNotes}
        {selectedNoteId}
        getNoteTitle={getNoteTitle}
        onCreateNote={createNote}
        onSelectNote={selectNote}
        onDeleteNote={onDeleteNote}
        onPinNote={onPinNote}
        onUnpinNote={onUnpinNote}
        headerInsetEnd
        class="h-full w-full border-r-0"
      />
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
