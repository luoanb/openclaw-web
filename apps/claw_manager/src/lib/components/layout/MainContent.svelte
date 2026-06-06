<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  type Props = {
    class?: string;
    children: Snippet;
    ref?: HTMLElement | null;
    iframeUrl?: string | null;
  };

  let {
    class: className,
    children,
    ref = $bindable(null),
    iframeUrl = null,
  }: Props = $props();
</script>

<main
  bind:this={ref}
  class={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-background", className)}
>
  {#if iframeUrl}
    <iframe
      src={iframeUrl}
      class="h-full w-full border-0"
      title="iframe content"
    ></iframe>
  {:else if children}
    {@render children()}
  {/if}
</main>
