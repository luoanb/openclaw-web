<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/ui/utils/cn";

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
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--icon-link-border)]",
    "bg-[color:var(--icon-link-bg)] text-sm font-semibold text-[color:var(--icon-link-fg)] no-underline",
    "shadow-[0_1px_0_1px_rgba(0,0,0,0.04)] transition-colors",
    "hover:border-[color:var(--icon-link-border-hover)] hover:bg-[color:var(--icon-link-bg-hover)] hover:text-[color:var(--text-primary)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-topbar)]",
    className,
  )}
>
  {@render children()}
</a>
