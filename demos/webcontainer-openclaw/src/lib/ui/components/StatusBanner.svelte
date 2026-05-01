<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/ui/utils/cn";

  type Variant = "success" | "warning";

  type Props = {
    variant: Variant;
    class?: string;
    children: Snippet;
  };

  let { variant, class: className = "", children }: Props = $props();

  const styles: Record<Variant, string> = {
    success: cn(
      "border-[color:var(--banner-ok-border)] bg-[color:var(--banner-ok-bg)] text-[color:var(--banner-ok-fg)]",
    ),
    warning: cn(
      "border-[color:var(--banner-warn-border)] bg-[color:var(--banner-warn-bg)] text-[color:var(--banner-warn-fg)]",
    ),
  };
</script>

<div
  class={cn(
    "shrink-0 border-b px-3 py-2 text-sm leading-snug",
    styles[variant],
    className,
  )}
  role="status"
>
  {@render children()}
</div>
