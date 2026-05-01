<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/ui/utils/cn";

  type Props = {
    class?: string;
    children: Snippet;
  };

  let { class: className = "", children }: Props = $props();
</script>

<div
  class={cn(
    "panel-frame overflow-hidden border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] shadow-[var(--panel-shadow)]",
    "rounded-[var(--panel-radius)]",
    className,
  )}
>
  {@render children()}
</div>
