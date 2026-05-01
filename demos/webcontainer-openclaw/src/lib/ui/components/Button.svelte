<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/ui/utils/cn";

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
    "focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--shell-bg)]",
  );

  const variants: Record<Variant, string> = {
    secondary: cn(
      "rounded-[9px] border border-[color:var(--btn-secondary-border)] bg-[color:var(--btn-secondary-bg)] px-3 py-2 text-[15px] leading-none text-[color:var(--btn-secondary-fg)]",
      "shadow-[0_1px_0_1px_rgba(0,0,0,0.04)] hover:bg-[color:var(--btn-secondary-hover-bg)]",
    ),
    danger: cn(
      "rounded-[9px] border border-transparent bg-[color:var(--danger)] px-3 py-2 text-[15px] leading-none text-white",
      "shadow-[0_1px_0_1px_rgba(0,0,0,0.08)] hover:bg-[color:var(--danger-hover)]",
    ),
    ghost: cn(
      "rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-xs text-[color:var(--btn-ghost-fg)]",
      "hover:bg-[color:var(--btn-ghost-hover-bg)] hover:text-[color:var(--text-primary)]",
    ),
  };
</script>

<button {type} class={cn(base, variants[variant], className)} {disabled} {title} {onclick}>
  {@render children()}
</button>
