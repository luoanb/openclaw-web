<script lang="ts">
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import { invoke } from "@tauri-apps/api/core";
  import Icons from "./Icons.svelte";

  let {
    onOpenSettings,
  }: {
    onOpenSettings: () => void;
  } = $props();

  const { t } = getLocaleStore();
  const isDev = import.meta.env.DEV;

  let isOpen = $state(false);
  let menuRef: HTMLDivElement | null = $state(null);
  let message = $state<{ text: string; type: "success" | "error" } | null>(null);
  let messageTimeout: ReturnType<typeof setTimeout> | null = null;

  async function toggleDevTools() {
    try {
      message = null;
      await invoke("toggle_devtools");
      message = { text: t("devtools.openHint"), type: "success" };
      if (messageTimeout) clearTimeout(messageTimeout);
      messageTimeout = setTimeout(() => {
        message = null;
      }, 3000);
    } catch (err) {
      message = { text: t("error.devtoolsFailed"), type: "error" };
      console.error("Failed to toggle devtools:", err);
      if (messageTimeout) clearTimeout(messageTimeout);
      messageTimeout = setTimeout(() => {
        message = null;
      }, 3000);
    }
  }

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

  function handleMenuKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if message}
  {#if message.type === "error"}
    <div class="fixed top-4 right-4 z-50 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-sm">
      {message.text}
    </div>
  {:else}
    <div class="fixed top-4 right-4 z-50 rounded-md border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-800 shadow-sm">
      {message.text}
    </div>
  {/if}
{/if}

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
    <div
      class="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border bg-popover py-1 shadow-md"
      role="menu"
      tabindex="-1"
      onclick={(e: MouseEvent) => e.stopPropagation()}
      onkeydown={handleMenuKeydown}
    >
      <button
        class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
        type="button"
        onclick={handleItemClick(onOpenSettings)}
      >
        <Icons name="settings" class="size-4" />
        {t("common.settings")}
      </button>
      {#if isDev}
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
          type="button"
          onclick={handleItemClick(toggleDevTools)}
        >
          <Icons name="code" class="size-4" />
          {t("common.devtools")}
        </button>
      {/if}
    </div>
  {/if}
</div>
