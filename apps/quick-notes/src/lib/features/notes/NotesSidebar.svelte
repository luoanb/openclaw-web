<script lang="ts">
  import type { QuickNote } from "$lib/core/quick-notes-types";
import { formatDateTime } from "$lib/utils";

  let {
    notes,
    selectedNoteId,
    getNoteTitle,
    onCreateNote,
    onSelectNote,
  }: {
    notes: QuickNote[];
    selectedNoteId: string | null;
    getNoteTitle: (note: QuickNote) => string;
    onCreateNote: () => void;
    onSelectNote: (noteId: string) => void;
  } = $props();
</script>

<aside class="flex w-80 shrink-0 flex-col border-r bg-card/60">
  <div class="flex items-center justify-between border-b p-3">
    <div>
      <h2 class="text-sm font-semibold">速记</h2>
      <p class="text-xs text-muted-foreground">{notes.length} 条记录</p>
    </div>
    <button
      class="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/80"
      type="button"
      onclick={onCreateNote}
    >
      新增
    </button>
  </div>

  <div class="min-h-0 flex-1 overflow-auto p-2">
    {#if notes.length > 0}
      <div class="flex flex-col gap-1">
        {#each notes as note (note.id)}
          <button
            class="rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted"
            class:border-border={selectedNoteId === note.id}
            class:border-transparent={selectedNoteId !== note.id}
            class:bg-muted={selectedNoteId === note.id}
            type="button"
            onclick={() => onSelectNote(note.id)}
          >
            <span class="block truncate text-sm font-medium">{getNoteTitle(note)}</span>
            <span class="mt-2 block text-[0.6875rem] text-muted-foreground">{formatDateTime(note.updatedAt)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <div class="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        还没有速记。
      </div>
    {/if}
  </div>
</aside>
