<script lang="ts">
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "./Icons.svelte";

  let {
    onOpenSettings,
  }: {
    onOpenSettings: () => void;
  } = $props();

  const { t } = getLocaleStore();

  let isOpen = $state(false);
  let menuRef: HTMLDivElement | null = $state(null);

  function toggle() {
    isOpen = !isOpen;
  }

  function handleItemClick(fn: () => void) {
    return () => {
      fn();
      isOpen = false;
    };
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={menuRef}>
  <button
    class="flex size-8 items-center justify-center rounded-md hover:bg-muted"
    type="button"
    onclick={toggle}
    aria-label="menu"
  >
    <Icons name="more-horizontal" class="size-5" />
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border bg-popover py-1 shadow-md"
      onclick={(e: MouseEvent) => e.stopPropagation()}
    >
      <button
        class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
        type="button"
        onclick={handleItemClick(onOpenSettings)}
      >
        <Icons name="settings" class="size-4" />
        {t("common.settings")}
      </button>
    </div>
  {/if}
</div>
