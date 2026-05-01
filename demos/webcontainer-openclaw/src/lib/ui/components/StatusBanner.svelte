<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Variant = "success" | "warning";

  type Props = {
    variant: Variant;
    class?: string;
    children: Snippet;
  };

  let { variant, class: className = "", children }: Props = $props();

  const styles: Record<Variant, string> = {
    success: "border-border bg-green-50 text-green-800",
    warning: "border-border bg-yellow-50 text-yellow-800",
  };
</script>

<div
  class={cn(
    "shrink-0 border-b px-3 py-2 text-sm",
    styles[variant],
    className,
  )}
  role="status"
>
  {@render children()}
</div>
