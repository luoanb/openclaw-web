<script lang="ts">
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible";

  const frameworkItems = ["Svelte 5", "Vite", "Tauri v2", "Tailwind CSS"];

  let detailsOpen = $state(true);
</script>

<svelte:head>
  <title>quick-notes</title>
</svelte:head>

<main class="flex h-dvh w-dvw items-center justify-center bg-background p-6 text-foreground">
  <section class="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
    <p class="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
      Desktop app scaffold
    </p>
    <h1 class="mt-3 text-3xl font-semibold tracking-tight">quick-notes</h1>
    <p class="mt-3 max-w-xl text-sm/6 text-muted-foreground">
      框架已搭建完成。业务功能会在规格审核通过后再实现。
    </p>

    <div class="mt-6 grid gap-2 sm:grid-cols-2">
      {#each frameworkItems as item}
        <div class="rounded-lg border bg-background px-3 py-2 text-sm font-medium">{item}</div>
      {/each}
    </div>

    <Collapsible bind:open={detailsOpen} class="mt-6 rounded-lg border bg-background">
      <CollapsibleTrigger
        class="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
      >
        <span>Bits UI scaffold check</span>
        <span class="text-xs text-muted-foreground">{detailsOpen ? "Hide" : "Show"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-3 py-3 text-sm/6 text-muted-foreground">
        已接入 Bits UI 的 Collapsible 基础封装。这里仅用于框架验证，不承载 TODO 或速记业务。
      </CollapsibleContent>
    </Collapsible>
  </section>
</main>
