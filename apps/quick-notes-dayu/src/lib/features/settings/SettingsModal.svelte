<script lang="ts">
  import {
    QuickNotesDataSyncService,
    type ConflictResolution,
    type ImportMode,
  } from "$lib/core/data-sync/quick-notes-data-sync";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import type { QuickNotesStore } from "$lib/core/quick-notes-types";
  import Icons from "$lib/features/common/Icons.svelte";

  let {
    open,
    store,
    onClose,
    onImport,
  }: {
    open: boolean;
    store: QuickNotesStore;
    onClose: () => void;
    onImport: (nextStore: QuickNotesStore) => Promise<void> | void;
  } = $props();

  const localeStore = getLocaleStore();
  const { t, setLocale } = localeStore;

  let importMode = $state<ImportMode>("append");
  let conflictResolution = $state<ConflictResolution>("keepCurrent");
  let feedback = $state<{ text: string; type: "success" | "error" } | null>(null);
  let overwriteConfirmOpen = $state(false);
  let pendingImport = $state<{ merged: QuickNotesStore; imported: QuickNotesStore } | null>(null);
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let importing = $state(false);

  function handleEsc(e: KeyboardEvent) {
    if (e.key === "Escape" && open && !overwriteConfirmOpen) {
      onClose();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !overwriteConfirmOpen) {
      onClose();
    }
  }

  function mapImportError(error: unknown): string {
    if (!(error instanceof Error)) {
      return t("settings.importFailed");
    }

    switch (error.message) {
      case "INVALID_JSON":
      case "INVALID_FORMAT":
        return t("data.invalidFormat");
      case "MISSING_NOTES":
        return t("data.missingNotes");
      default:
        return error.message || t("settings.importFailed");
    }
  }

  function handleExport() {
    try {
      QuickNotesDataSyncService.downloadJson(store);
      feedback = { text: t("settings.exportSuccess"), type: "success" };
    } catch {
      feedback = { text: t("settings.exportFailed"), type: "error" };
    }
  }

  function openFilePicker() {
    fileInputRef?.click();
  }

  async function handleFileSelected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";

    if (!file) {
      return;
    }

    try {
      const imported = QuickNotesDataSyncService.parseImportFile(await file.text());
      const merged = QuickNotesDataSyncService.mergeStore(
        store,
        imported,
        importMode,
        conflictResolution
      );

      if (importMode === "overwrite") {
        pendingImport = { merged, imported };
        overwriteConfirmOpen = true;
        return;
      }

      await applyImport(merged, imported);
    } catch (error) {
      feedback = { text: mapImportError(error), type: "error" };
    }
  }

  async function applyImport(merged: QuickNotesStore, imported: QuickNotesStore) {
    importing = true;
    feedback = null;

    try {
      await onImport(merged);
      feedback = {
        text: t("settings.importSuccess", {
          count: String(QuickNotesDataSyncService.countImportedItems(imported)),
        }),
        type: "success",
      };
      overwriteConfirmOpen = false;
      pendingImport = null;
    } catch (error) {
      feedback = { text: mapImportError(error), type: "error" };
    } finally {
      importing = false;
    }
  }

  async function confirmOverwrite() {
    if (!pendingImport) {
      return;
    }

    await applyImport(pendingImport.merged, pendingImport.imported);
  }

  function cancelOverwrite() {
    overwriteConfirmOpen = false;
    pendingImport = null;
  }
</script>

<svelte:window onkeydown={handleEsc} />

<input
  bind:this={fileInputRef}
  type="file"
  accept=".json,application/json"
  class="hidden"
  onchange={handleFileSelected}
/>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onclick={handleOverlayClick}
  >
    <div
      class="max-h-[90dvh] w-96 overflow-y-auto rounded-lg border bg-popover p-0 shadow-lg"
      onclick={(e: MouseEvent) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold">{t("settings.title")}</h2>
        <button
          class="flex size-6 items-center justify-center rounded hover:bg-muted"
          type="button"
          onclick={onClose}
          aria-label="close"
        >
          <Icons name="close" class="size-4" />
        </button>
      </div>

      <div class="space-y-5 p-4">
        <section>
          <span class="mb-1 block text-xs font-medium text-muted-foreground">
            {t("settings.language")}
          </span>
          <div class="flex flex-col gap-1">
            <label
              class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              class:bg-muted={localeStore.locale === "zh"}
            >
              <input
                type="radio"
                name="language"
                value="zh"
                checked={localeStore.locale === "zh"}
                onchange={() => setLocale("zh")}
                class="size-4 accent-foreground"
              />
              {t("common.chinese")}
            </label>
            <label
              class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              class:bg-muted={localeStore.locale === "en"}
            >
              <input
                type="radio"
                name="language"
                value="en"
                checked={localeStore.locale === "en"}
                onchange={() => setLocale("en")}
                class="size-4 accent-foreground"
              />
              {t("common.english")}
            </label>
          </div>
        </section>

        <section class="border-t pt-4">
          <span class="mb-2 block text-xs font-medium text-muted-foreground">
            {t("settings.data")}
          </span>

          <div class="flex flex-col gap-2">
            <button
              class="h-8 rounded-md border px-3 text-sm hover:bg-muted"
              type="button"
              onclick={handleExport}
            >
              {t("settings.export")}
            </button>

            <div class="space-y-2 rounded-md border p-3">
              <span class="block text-xs text-muted-foreground">{t("settings.importMode.label")}</span>
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="import-mode"
                  value="append"
                  checked={importMode === "append"}
                  onchange={() => (importMode = "append")}
                  class="size-4 accent-foreground"
                />
                {t("settings.importMode.append")}
              </label>
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="import-mode"
                  value="overwrite"
                  checked={importMode === "overwrite"}
                  onchange={() => (importMode = "overwrite")}
                  class="size-4 accent-foreground"
                />
                {t("settings.importMode.overwrite")}
              </label>

              {#if importMode === "append"}
                <span class="mt-2 block text-xs text-muted-foreground">
                  {t("settings.conflict.label")}
                </span>
                <label class="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="conflict-resolution"
                    value="keepCurrent"
                    checked={conflictResolution === "keepCurrent"}
                    onchange={() => (conflictResolution = "keepCurrent")}
                    class="size-4 accent-foreground"
                  />
                  {t("settings.conflict.keepCurrent")}
                </label>
                <label class="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="conflict-resolution"
                    value="preferImported"
                    checked={conflictResolution === "preferImported"}
                    onchange={() => (conflictResolution = "preferImported")}
                    class="size-4 accent-foreground"
                  />
                  {t("settings.conflict.preferImported")}
                </label>
              {/if}
            </div>

            <button
              class="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              type="button"
              disabled={importing}
              onclick={openFilePicker}
            >
              {t("settings.import")}
            </button>
          </div>

          {#if feedback}
            <p
              class="mt-2 text-xs"
              class:text-destructive={feedback.type === "error"}
              class:text-green-700={feedback.type === "success"}
            >
              {feedback.text}
            </p>
          {/if}
        </section>
      </div>
    </div>
  </div>
{/if}

{#if overwriteConfirmOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
    onclick={(e) => e.target === e.currentTarget && cancelOverwrite()}
  >
    <div
      class="w-80 rounded-lg border bg-popover p-4 shadow-lg"
      onclick={(e: MouseEvent) => e.stopPropagation()}
    >
      <h3 class="text-sm font-semibold">{t("settings.confirmOverwrite.title")}</h3>
      <p class="mt-2 text-sm text-muted-foreground">{t("settings.confirmOverwrite.body")}</p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          class="h-8 rounded-md border px-3 text-sm hover:bg-muted"
          type="button"
          disabled={importing}
          onclick={cancelOverwrite}
        >
          {t("common.cancel")}
        </button>
        <button
          class="h-8 rounded-md bg-destructive px-3 text-sm font-medium text-white disabled:opacity-50"
          type="button"
          disabled={importing}
          onclick={() => void confirmOverwrite()}
        >
          {t("settings.confirmOverwrite.confirm")}
        </button>
      </div>
    </div>
  </div>
{/if}
