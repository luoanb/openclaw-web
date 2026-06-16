<script lang="ts">
  import type { QuickNote } from "$lib/core/quick-notes-types";

  let {
    note,
    title,
    creating,
    onCreateNote,
    onUpdateNote,
    onDeleteNote,
  }: {
    note: QuickNote | null;
    title: string;
    creating: boolean;
    onCreateNote: (content: string) => void;
    onUpdateNote: (noteId: string, content: string) => void;
    onDeleteNote: (noteId: string) => void;
  } = $props();

  let draft = $state("");
  let currentNoteId = $state<string | null>(null);

  $effect(() => {
    if (creating && currentNoteId !== "new") {
      currentNoteId = "new";
      draft = "";
      return;
    }

    if (!creating && note?.id !== currentNoteId) {
      currentNoteId = note?.id ?? null;
      draft = note?.content ?? "";
    }
  });

  function saveNote() {
    const nextContent = draft.trim();

    if (!nextContent) {
      return;
    }

    if (creating) {
      onCreateNote(nextContent);
      draft = "";
      return;
    }

    if (note) {
      onUpdateNote(note.id, nextContent);
    }
  }
</script>

<section class="flex min-w-0 flex-1 flex-col bg-background">
  {#if note || creating}
    <div class="flex items-center justify-between border-b p-4">
      <div class="min-w-0">
        <h2 class="truncate text-sm font-semibold">{creating ? "新增速记" : title}</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          {creating ? "正文第一行会自动成为左侧标题" : `更新于 ${note?.updatedAt}`}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          type="button"
          disabled={!draft.trim()}
          onclick={saveNote}
        >
          保存
        </button>
        {#if note}
          <button
            class="h-8 rounded-md border px-3 text-xs text-muted-foreground hover:text-destructive"
            type="button"
            onclick={() => onDeleteNote(note.id)}
          >
            删除
          </button>
        {/if}
      </div>
    </div>

    <div class="min-h-0 flex-1 p-4">
      <textarea
        class="h-full w-full resize-none rounded-lg border bg-card p-4 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        bind:value={draft}
        placeholder="写下速记..."
      ></textarea>
    </div>
  {:else}
    <div class="grid h-full place-items-center p-8 text-center">
      <div>
        <h2 class="text-sm font-semibold">选择或新增一条速记</h2>
        <p class="mt-2 max-w-sm text-sm text-muted-foreground">
          左侧会自动用正文第一行生成标题和摘要，不需要单独维护标题。
        </p>
      </div>
    </div>
  {/if}
</section>
