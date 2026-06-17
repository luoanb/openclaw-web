<script lang="ts">
  import type { QuickNote } from "$lib/core/quick-notes-types";
  import { formatDateTime } from "$lib/utils";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";

  const { t } = getLocaleStore();

  let {
    note,
    selected = false,
    getNoteTitle,
    onSelectNote,
    onDeleteNote,
    onPinNote,
    onUnpinNote,
  }: {
    note: QuickNote;
    selected?: boolean;
    getNoteTitle: (note: QuickNote) => string;
    onSelectNote: (noteId: string) => void;
    onDeleteNote: (noteId: string) => void;
    onPinNote: (noteId: string) => void;
    onUnpinNote: (noteId: string) => void;
  } = $props();

  function pinOrUnpin(event: MouseEvent) {
    event.stopPropagation();
    if (note.pinnedAt) {
      onUnpinNote(note.id);
      return;
    }

    onPinNote(note.id);
  }

  function deleteNote(event: MouseEvent) {
    event.stopPropagation();
    onDeleteNote(note.id);
  }
</script>

<div
  class="group flex items-center rounded-md border pr-2 transition-colors hover:bg-muted focus-within:bg-muted"
  class:border-border={selected}
  class:border-transparent={!selected}
  class:bg-muted={selected}
>
  <button
    class="min-w-0 flex-1 px-3 py-2 text-left"
    type="button"
    onclick={() => onSelectNote(note.id)}
  >
    <span class="block truncate text-sm font-medium">{getNoteTitle(note)}</span>
    <span class="mt-2 block text-[0.6875rem] text-muted-foreground">
      {formatDateTime(note.updatedAt)}
    </span>
  </button>

  <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
    <button
      class="rounded p-1 text-muted-foreground hover:text-foreground"
      type="button"
      title={note.pinnedAt ? t("common.unpin") : t("common.pin")}
      aria-label={note.pinnedAt ? t("common.unpin") : t("common.pin")}
      onclick={pinOrUnpin}
    >
      <Icons name={note.pinnedAt ? "pin-off" : "pin"} class="size-3.5" />
    </button>
    <button
      class="rounded p-1 text-muted-foreground hover:text-destructive"
      type="button"
      title={t("common.delete")}
      aria-label={t("common.delete")}
      onclick={deleteNote}
    >
      <Icons name="trash" class="size-3.5" />
    </button>
  </div>
</div>
