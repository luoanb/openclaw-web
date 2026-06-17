<script lang="ts">
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible";
  import type { QuickNote } from "$lib/core/quick-notes-types";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";
  import NoteListItem from "./NoteListItem.svelte";

  const { t } = getLocaleStore();

  let {
    notes,
    selectedNoteId,
    getNoteTitle,
    onSelectNote,
    onDeleteNote,
    onPinNote,
    onUnpinNote,
  }: {
    notes: QuickNote[];
    selectedNoteId: string | null;
    getNoteTitle: (note: QuickNote) => string;
    onSelectNote: (noteId: string) => void;
    onDeleteNote: (noteId: string) => void;
    onPinNote: (noteId: string) => void;
    onUnpinNote: (noteId: string) => void;
  } = $props();

  let open = $state(false);
</script>

<Collapsible bind:open class="overflow-hidden rounded-lg border bg-card">
  <CollapsibleTrigger class="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium">
    <span>
      {t("common.pinned")}
      <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{notes.length}</span>
    </span>
    <Icons name={open ? "chevron-up" : "chevron-down"} class="size-4 text-muted-foreground" />
  </CollapsibleTrigger>
  <CollapsibleContent class="border-t p-1">
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
      <div class="px-3 py-5 text-sm text-muted-foreground">{t("notes.empty.pinned")}</div>
    {/if}
  </CollapsibleContent>
</Collapsible>
