<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = {
    href: string;
    title?: string;
    class?: string;
    children: Snippet;
  };

  let { href, title, class: className = "", children }: Props = $props();
</script>

<a
  {href}
  {title}
  target="_blank"
  rel="noreferrer"
  class={cn(
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
    className,
  )}
>
  {@render children()}
</a>
