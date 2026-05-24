<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Variant = "neutral" | "success" | "warning" | "error";

  type Props = {
    variant?: Variant;
    class?: string;
    children: Snippet;
  };

  let { variant = "neutral", class: className = "", children }: Props = $props();

  const styles: Record<Variant, string> = {
    neutral: "border-border bg-muted text-muted-foreground",
    success: "border-border bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300",
    warning: "border-border bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300",
    error: "border-border bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300",
  };
</script>

<div class={cn("shrink-0 border-b px-3 py-2 text-xs/relaxed", styles[variant], className)} role="status">
  {@render children()}
</div>
