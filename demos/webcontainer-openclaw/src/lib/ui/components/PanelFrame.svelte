<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = {
    class?: string;
    children: Snippet;
  };

  let { class: className = "", children }: Props = $props();
</script>

<div
  class={cn(
    "overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
    className,
  )}
>
  {@render children()}
</div>
