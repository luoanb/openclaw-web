<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Variant = "secondary" | "danger" | "ghost";

  type Props = {
    variant?: Variant;
    class?: string;
    disabled?: boolean;
    type?: "button" | "submit";
    title?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  };

  let {
    variant = "secondary",
    class: className = "",
    disabled = false,
    type = "button",
    title,
    onclick,
    children,
  }: Props = $props();

  const base = cn(
    "inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium tracking-wide transition-colors outline-none",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  const variants: Record<Variant, string> = {
    secondary: cn(
      "rounded-[9px] border border-border bg-secondary text-secondary-foreground px-3 py-2 text-[15px] leading-none",
      "shadow-[0_1px_0_1px_rgba(0,0,0,0.04)] hover:bg-secondary/80",
    ),
    danger: cn(
      "rounded-[9px] border border-transparent bg-destructive text-destructive-foreground px-3 py-2 text-[15px] leading-none",
      "shadow-[0_1px_0_1px_rgba(0,0,0,0.08)] hover:bg-destructive/90",
    ),
    ghost: cn(
      "rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-xs text-muted-foreground",
      "hover:bg-muted hover:text-foreground",
    ),
  };
</script>

<button {type} class={cn(base, variants[variant], className)} {disabled} {title} {onclick}>
  {@render children()}
</button>
