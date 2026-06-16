<script lang="ts">
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";

  let {
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  } = $props();

  const localeStore = getLocaleStore();
  const { t, setLocale } = localeStore;

  function handleEsc(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      onClose();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleEsc} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onclick={handleOverlayClick}
  >
    <div
      class="w-80 rounded-lg border bg-popover p-0 shadow-lg"
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

      <!-- Body -->
      <div class="p-4">
        <label class="mb-1 block text-xs font-medium text-muted-foreground">
          {t("settings.language")}
        </label>
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
      </div>
    </div>
  </div>
{/if}
