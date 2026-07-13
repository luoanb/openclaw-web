<script lang="ts">
  import type { NoteOutlineItem } from "$lib/core/notes/note-outline-service";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import { cn } from "$lib/utils";

  const { t } = getLocaleStore();

  let {
    items,
    class: className = "",
    headerInsetEnd = false,
    onSelect,
  }: {
    items: NoteOutlineItem[];
    class?: string;
    headerInsetEnd?: boolean;
    onSelect: (item: NoteOutlineItem) => void;
  } = $props();
</script>

<aside
  class={cn("flex min-h-0 flex-col border-l bg-card text-xs/relaxed", className)}
  aria-label={t("notes.outline")}
>
  <div
    class={cn(
      "flex h-11 shrink-0 items-center justify-between gap-3 border-b px-3",
      headerInsetEnd && "pr-12",
    )}
  >
    <h3 class="font-medium text-foreground">{t("notes.outline")}</h3>
    <span class="text-muted-foreground">
      {t("notes.outlineCount", { count: items.length })}
    </span>
  </div>

  {#if items.length > 0}
    <nav class="min-h-0 flex-1 overflow-auto p-2" aria-label={t("notes.outline")}>
      <ol class="space-y-0.5">
        {#each items as item (item.id)}
          <li>
            <button
              type="button"
              class="w-full truncate rounded-md px-2 py-1 text-left text-xs/relaxed text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              style={`padding-left: ${0.5 + (item.level - 1) * 0.75}rem`}
              title={item.text}
              onclick={() => onSelect(item)}
            >
              {item.text}
            </button>
          </li>
        {/each}
      </ol>
    </nav>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col justify-center px-4 text-center">
      <p class="font-medium text-foreground">{t("notes.outlineEmpty")}</p>
      <p class="mt-1 text-muted-foreground">{t("notes.outlineEmptyHint")}</p>
    </div>
  {/if}
</aside>
