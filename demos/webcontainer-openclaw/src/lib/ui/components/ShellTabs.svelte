<script lang="ts">
  import { Tabs } from "bits-ui";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/ui/utils/cn";

  type Props = {
    value?: string;
    children: Snippet;
    actions?: Snippet;
  };

  let { value = $bindable("terminal"), children, actions }: Props = $props();

  /** Figma Tabs `2791:1098` — active pill #fff / #171717, rail `rgba(245,245,245,0.1)`, frame `#171717`→`#27272A`. */
  const triggerClass = cn(
    "inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg px-4 py-1.5 text-sm font-semibold tracking-wide transition-colors outline-none",
    "text-[color:var(--tab-inactive-fg)] hover:text-[color:var(--text-primary)]",
    "focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--tab-rail-bg)]",
    "data-[state=active]:bg-[color:var(--tab-active-bg)] data-[state=active]:text-[color:var(--tab-active-fg)]",
    "data-[state=active]:shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]",
  );
</script>

<Tabs.Root
  bind:value
  class={cn(
    "flex min-h-dvh flex-col bg-[linear-gradient(180deg,var(--shell-bg)_0%,var(--shell-bg-end)_100%)]",
    "text-[color:var(--text-primary)] antialiased",
  )}
>
  <header
    class="flex shrink-0 flex-wrap items-center gap-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-topbar)] px-3 py-2.5"
  >
    <Tabs.List
      class={cn(
        "inline-flex items-center gap-1 rounded-[10px] bg-[color:var(--tab-rail-bg)] p-1",
        "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)]",
      )}
    >
      <Tabs.Trigger value="terminal" class={triggerClass}>终端</Tabs.Trigger>
      <Tabs.Trigger value="preview" class={triggerClass}>预览</Tabs.Trigger>
    </Tabs.List>
    {#if actions}
      <div class="ml-auto flex items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </header>
  {@render children()}
</Tabs.Root>
