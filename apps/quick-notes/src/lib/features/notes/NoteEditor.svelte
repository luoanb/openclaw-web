<script lang="ts">
  import { untrack } from "svelte";
  import { Crepe } from "@milkdown/crepe";
  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/frame.css";
  import { DiffAutoSaver } from "$lib/core/autosave/diff-auto-saver";
import { formatDateTime } from "$lib/utils";
  import type { QuickNote } from "$lib/core/quick-notes-types";

  const AUTOSAVE_INTERVAL_MS = 3000;

  let {
    note,
    title,
    creating,
    viewKey = 0,
    onCreateNote,
    onUpdateNote,
    onDeleteNote,
  }: {
    note: QuickNote | null;
    title: string;
    creating: boolean;
    viewKey: number;
    onCreateNote: (content: string) => void;
    onUpdateNote: (noteId: string, content: string) => void;
    onDeleteNote: (noteId: string) => void;
  } = $props();

  let draft = $state("");
  let editorRoot = $state<HTMLDivElement | null>(null);
  let crepeEditor: Crepe | null = null;
  let autoSaver: DiffAutoSaver<string> | null = null;

  // ── Editor lifecycle: only responds to viewKey ────────────────────────
  // viewKey is incremented ONLY on explicit user actions (select note, new).
  // Auto-save creating→saved does NOT change viewKey, so the editor survives
  // and the user's cursor stays intact.
  //
  // All other reactive reads (note, creating, etc.) are wrapped in untrack()
  // to prevent Svelte 5's auto-tracking from making the effect re-run on
  // every prop change.
  let currentCleanup: (() => void) | null = null;

  $effect(() => {
    // Track ONLY viewKey and editorRoot
    const _viewKey = viewKey;
    const root = editorRoot;

    untrack(() => {
      // Clear any previous setup
      disposeEditor();

      if (!root) {
        return;
      }

      const isCreating = creating;
      const currentNote = note;
      const shouldHaveEditor = isCreating || currentNote !== null;

      if (!shouldHaveEditor) {
        return;
      }

      // Create editor
      const initialContent = isCreating ? "" : (currentNote?.content ?? "");
      const activeNoteId = currentNote?.id ?? null;
      let disposed = false;
      draft = initialContent;

      const editor = new Crepe({
        root,
        defaultValue: initialContent,
        features: {
          [Crepe.Feature.ImageBlock]: false,
          [Crepe.Feature.AI]: false,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: {
            text: "写下速记...",
            mode: "block",
          },
        },
      });

      crepeEditor = editor;

      const saver = new DiffAutoSaver(initialContent, {
        intervalMs: AUTOSAVE_INTERVAL_MS,
        readSnapshot: getEditorContent,
        submitSnapshot: (content) => {
          submitNoteContent(content, isCreating, activeNoteId);
        },
        normalizeSnapshot: (content) => content.trim(),
        canSubmit: (content) => content.length > 0,
      });
      autoSaver = saver;

      editor.on((listener) => {
        listener.markdownUpdated((_, markdown) => {
          if (!disposed) {
            draft = markdown;
          }
        });
      });

      void editor.create().catch((error: unknown) => {
        console.error("Failed to create Milkdown Crepe editor", error);
      });
      saver.start();

      // Register cleanup for component destroy
      currentCleanup = () => {
        if (autoSaver === saver) {
          autoSaver = null;
        }

        if (crepeEditor === editor) {
          crepeEditor = null;
        }

        saver.dispose({ flush: true });
        disposed = true;
        void editor.destroy().catch((error: unknown) => {
          console.error("Failed to destroy Milkdown Crepe editor", error);
        });
      };
    });

    // Return cleanup for $effect lifecycle (dep changes + component destroy)
    return () => {
      const fn = currentCleanup;
      currentCleanup = null;
      fn?.();
    };
  });

  // ── Handle creating→saved transition ──────────────────────────────────
  // When auto-save creates the note (creating becomes false, note is set),
  // update the auto-saver's committed snapshot so it doesn't re-submit
  // the same content. Does NOT recreate the editor.
  $effect(() => {
    const isCreating = creating;
    const currentNote = note;

    untrack(() => {
      if (!isCreating && currentNote && crepeEditor && autoSaver) {
        autoSaver.markCommitted(currentNote.content ?? "");
      }
    });
  });

  function getEditorContent() {
    try {
      return crepeEditor?.getMarkdown() ?? draft;
    } catch {
      return draft;
    }
  }

  function submitNoteContent(content: string, isCreatingNote: boolean, noteId: string | null) {
    const nextContent = content.trim();

    if (!nextContent) {
      return;
    }

    if (isCreatingNote) {
      onCreateNote(nextContent);
      draft = "";
      return;
    }

    if (noteId) {
      onUpdateNote(noteId, nextContent);
    }
  }

  function saveNote() {
    const nextContent = getEditorContent().trim();
    submitNoteContent(nextContent, creating, note?.id ?? null);
    autoSaver?.markCommitted(nextContent);
  }

  function disposeEditor() {
    autoSaver?.dispose({ flush: true });
    autoSaver = null;

    if (crepeEditor) {
      const editor = crepeEditor;
      crepeEditor = null;
      void editor.destroy().catch((error: unknown) => {
        console.error("Failed to destroy Milkdown Crepe editor", error);
      });
    }
  }
</script>

<!-- Crepe's frame theme is roomy by default; keep note-editor density scoped here. -->

<section class="flex min-w-0 flex-1 flex-col bg-background">
  {#if note || creating}
    <div class="flex items-center justify-between border-b p-4">
      <div class="min-w-0">
        <h2 class="truncate text-sm font-semibold">{creating ? "新增速记" : title}</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          {formatDateTime(note?.updatedAt ?? "")}
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
      {#key viewKey}
        <div
          class="quick-note-crepe-editor h-full overflow-hidden rounded-lg border bg-card text-sm leading-6"
          bind:this={editorRoot}
        ></div>
      {/key}
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

<style>
  :global(.quick-note-crepe-editor .milkdown) {
    height: 100%;
    overflow: auto;
    --crepe-font-default:
      "Inter Variable", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
    --crepe-font-title:
      "Inter Variable", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror) {
    min-height: 100%;
    padding: 16px 20px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror p) {
    font-size: 14px;
    line-height: 22px;
    padding: 2px 0;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror h1) {
    margin-top: 12px;
    font-size: 24px;
    line-height: 32px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror h2) {
    margin-top: 10px;
    font-size: 21px;
    line-height: 28px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror h3) {
    margin-top: 8px;
    font-size: 18px;
    line-height: 26px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror h4),
  :global(.quick-note-crepe-editor .milkdown .ProseMirror h5),
  :global(.quick-note-crepe-editor .milkdown .ProseMirror h6) {
    margin-top: 8px;
    font-size: 16px;
    line-height: 24px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror blockquote) {
    margin: 2px 0;
    padding-left: 16px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror li) {
    gap: 6px;
  }

  :global(.quick-note-crepe-editor .milkdown .milkdown-list-item-block li .label-wrapper) {
    height: 24px;
  }

  :global(.quick-note-crepe-editor .milkdown .milkdown-toolbar .toolbar-item),
  :global(.quick-note-crepe-editor .milkdown .milkdown-block-handle .operation-item) {
    width: 28px;
    height: 28px;
    margin: 4px;
  }

  :global(.quick-note-crepe-editor .milkdown .milkdown-toolbar .toolbar-item svg),
  :global(.quick-note-crepe-editor .milkdown .milkdown-block-handle .operation-item svg) {
    width: 20px;
    height: 20px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror pre) {
    margin: 4px 0;
    padding: 8px;
  }
</style>
