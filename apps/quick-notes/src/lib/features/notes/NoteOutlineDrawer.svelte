<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { NoteOutlineItem } from "$lib/core/notes/note-outline-service";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icon from "$lib/features/common/Icons.svelte";
  import NoteOutlinePanel from "./NoteOutlinePanel.svelte";

  const { t } = getLocaleStore();

  let {
    open = $bindable(false),
    items,
    onSelect,
  }: {
    open: boolean;
    items: NoteOutlineItem[];
    onSelect: (item: NoteOutlineItem) => void;
  } = $props();

  function selectItem(item: NoteOutlineItem) {
    onSelect(item);
    open = false;
  }
</script>

<DialogPrimitive.Root bind:open>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0"
    />
    <DialogPrimitive.Content
      class="fixed inset-y-0 right-0 z-50 flex w-[min(85vw,20rem)] flex-col border-l bg-card text-card-foreground shadow-lg outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-10 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-10"
    >
      <DialogPrimitive.Title class="sr-only">{t("notes.outline")}</DialogPrimitive.Title>
      <DialogPrimitive.Close
        class="absolute right-2 top-2 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label={t("common.close")}
      >
        <Icon name="close" class="size-4" />
      </DialogPrimitive.Close>
      <NoteOutlinePanel
        items={items}
        headerInsetEnd
        onSelect={selectItem}
        class="h-full border-l-0"
      />
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
