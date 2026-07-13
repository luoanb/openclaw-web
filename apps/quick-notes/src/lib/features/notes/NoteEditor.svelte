<script lang="ts">
  import { untrack } from "svelte";
  import { Crepe } from "@milkdown/crepe";
  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/frame.css";
  import { DiffAutoSaver } from "$lib/core/autosave/diff-auto-saver";
  import { formatDateTime } from "$lib/utils";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import { NoteOutlineService, type NoteOutlineItem } from "$lib/core/notes/note-outline-service";
  import type { QuickNote } from "$lib/core/quick-notes-types";
  import NoteOutlineDrawer from "./NoteOutlineDrawer.svelte";
  import NoteOutlinePanel from "./NoteOutlinePanel.svelte";

  const { t } = getLocaleStore();

  const AUTOSAVE_INTERVAL_MS = 3000;
  const MAX_EXPORT_FILENAME_LENGTH = 64;

  type SaveTarget =
    | { mode: "create" }
    | {
        mode: "update";
        noteId: string;
      };

  let {
    note,
    title,
    creating,
    viewKey = 0,
    onCreateNote,
    onUpdateNote,
  }: {
    note: QuickNote | null;
    title: string;
    creating: boolean;
    viewKey: number;
    onCreateNote: (content: string) => void;
    onUpdateNote: (noteId: string, content: string) => void;
  } = $props();

  let draft = $state("");
  let editorRoot = $state<HTMLDivElement | null>(null);
  let crepeEditor: Crepe | null = null;
  let autoSaver: DiffAutoSaver<string> | null = null;
  let saveTarget: SaveTarget = { mode: "create" };
  let actionFeedback = $state<{ text: string; type: "success" | "error" } | null>(null);
  let outlineDrawerOpen = $state(false);
  const outlineItems = $derived(NoteOutlineService.extract(draft));

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
    // Force-track viewKey and editorRoot only
    void viewKey;
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
      saveTarget = getInitialSaveTarget(isCreating, currentNote);
      let disposed = false;
      draft = initialContent;

      const editor = new Crepe({
        root,
        defaultValue: initialContent,
        features: {
          [Crepe.Feature.TopBar]: true,
          [Crepe.Feature.Toolbar]: true,
          [Crepe.Feature.BlockEdit]: true,
          [Crepe.Feature.Table]: true,
          [Crepe.Feature.Latex]: true,
          [Crepe.Feature.CodeMirror]: true,
          [Crepe.Feature.LinkTooltip]: true,
          [Crepe.Feature.ListItem]: true,
          [Crepe.Feature.ImageBlock]: false,
          [Crepe.Feature.AI]: false,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: {
            text: t("notes.placeholder"),
            mode: "block",
          },
        },
      });

      crepeEditor = editor;

      const saver = new DiffAutoSaver(initialContent, {
        intervalMs: AUTOSAVE_INTERVAL_MS,
        readSnapshot: getEditorContent,
        submitSnapshot: (content) => {
          submitNoteContent(content);
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
        saveTarget = { mode: "update", noteId: currentNote.id };
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

  function getInitialSaveTarget(isCreatingNote: boolean, currentNote: QuickNote | null): SaveTarget {
    return !isCreatingNote && currentNote
      ? { mode: "update", noteId: currentNote.id }
      : { mode: "create" };
  }

  function submitNoteContent(content: string) {
    const nextContent = content.trim();

    if (!nextContent) {
      return;
    }

    if (saveTarget.mode === "create") {
      onCreateNote(nextContent);
      draft = "";
      return;
    }

    onUpdateNote(saveTarget.noteId, nextContent);
  }

  function saveNote() {
    const nextContent = getEditorContent().trim();
    submitNoteContent(nextContent);
    autoSaver?.markCommitted(nextContent);
  }

  async function copyNoteContent() {
    const content = getEditorContent();

    if (!content.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      actionFeedback = { text: t("notes.copySuccess"), type: "success" };
    } catch {
      actionFeedback = { text: t("notes.copyFailed"), type: "error" };
    }
  }

  function exportNoteMarkdown() {
    const content = getEditorContent();

    if (!content.trim()) {
      return;
    }

    try {
      const filename = getExportFilename(content);
      downloadMarkdown(content, filename);
      actionFeedback = {
        text: t("notes.exportSuccess", { filename }),
        type: "success",
      };
    } catch {
      actionFeedback = { text: t("notes.exportFailed"), type: "error" };
    }
  }

  function downloadMarkdown(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function getExportFilename(content: string) {
    const source = title || content.split(/\r?\n/).find((line) => line.trim()) || t("notes.exportDefaultName");
    const sanitized = source
      .replace(/^#+\s*/, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_EXPORT_FILENAME_LENGTH)
      .replace(/[.\s-]+$/g, "");

    return `${sanitized || t("notes.exportDefaultName")}.md`;
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

  function scrollToOutlineItem(item: NoteOutlineItem) {
    const headings = Array.from(editorRoot?.querySelectorAll<HTMLElement>(
      ".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6",
    ) ?? []).filter((heading) => heading.textContent?.trim());
    const target = headings[item.index];
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";

    target?.scrollIntoView({ block: "start", behavior });
  }
</script>

<!-- Crepe's frame theme is roomy by default; keep note-editor density scoped here. -->

<section class="flex min-w-0 flex-1 flex-col bg-background">
  {#if note || creating}
    <div class="flex items-center justify-between border-b p-4">
      <div class="min-w-0">
        <h2 class="truncate text-sm font-semibold">{creating ? t("notes.addNote") : title}</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          {formatDateTime(note?.updatedAt ?? "")}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 xl:hidden"
          type="button"
          onclick={() => {
            outlineDrawerOpen = true;
          }}
        >
          {t("notes.outline")}
        </button>
        <button
          class="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          type="button"
          disabled={!draft.trim()}
          onclick={() => void copyNoteContent()}
        >
          {t("common.copyContent")}
        </button>
        <button
          class="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          type="button"
          disabled={!draft.trim()}
          onclick={exportNoteMarkdown}
        >
          {t("common.export")}
        </button>
        <button
          class="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          type="button"
          disabled={!draft.trim()}
          onclick={saveNote}
        >
          {t("common.save")}
        </button>
      </div>
    </div>
    {#if actionFeedback}
      <p
        class="border-b px-4 py-2 text-xs"
        class:text-destructive={actionFeedback.type === "error"}
        class:text-green-700={actionFeedback.type === "success"}
      >
        {actionFeedback.text}
      </p>
    {/if}

    <div class="flex min-h-0 flex-1 gap-0 p-4">
      <div class="min-w-0 flex-1">
        {#key viewKey}
          <div
            class="quick-note-crepe-editor h-full overflow-hidden rounded-lg border bg-card text-sm leading-6 xl:rounded-r-none"
            bind:this={editorRoot}
          ></div>
        {/key}
      </div>
      <NoteOutlinePanel
        items={outlineItems}
        onSelect={scrollToOutlineItem}
        class="hidden w-60 rounded-r-lg border-y border-r xl:flex"
      />
    </div>
    <NoteOutlineDrawer
      bind:open={outlineDrawerOpen}
      items={outlineItems}
      onSelect={scrollToOutlineItem}
    />
  {:else}
    <div class="grid h-full place-items-center p-8 text-center">
      <div>
        <h2 class="text-sm font-semibold">{t("notes.selectorEmpty")}</h2>
        <p class="mt-2 max-w-sm text-sm text-muted-foreground">
          {t("notes.selectorHint")}
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
    scroll-margin-top: 56px;
    font-size: 24px;
    line-height: 32px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror h2) {
    margin-top: 10px;
    scroll-margin-top: 56px;
    font-size: 21px;
    line-height: 28px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror h3) {
    margin-top: 8px;
    scroll-margin-top: 56px;
    font-size: 18px;
    line-height: 26px;
  }

  :global(.quick-note-crepe-editor .milkdown .ProseMirror h4),
  :global(.quick-note-crepe-editor .milkdown .ProseMirror h5),
  :global(.quick-note-crepe-editor .milkdown .ProseMirror h6) {
    margin-top: 8px;
    scroll-margin-top: 56px;
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
