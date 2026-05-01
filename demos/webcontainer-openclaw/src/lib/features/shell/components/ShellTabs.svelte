<script lang="ts">
  import Tabs from "$lib/components/ui/tabs/tabs.svelte";
  import TabsList from "$lib/components/ui/tabs/tabs-list.svelte";
  import TabsTrigger from "$lib/components/ui/tabs/tabs-trigger.svelte";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = {
    value?: string;
    children: Snippet;
    actions?: Snippet;
  };

  let { value = $bindable("terminal"), children, actions }: Props = $props();

  const triggerClass = cn(
    "inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg px-4 py-1.5 text-sm font-semibold tracking-wide transition-colors outline-none",
    "text-muted-foreground hover:text-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]"
  );
</script>

<Tabs
  bind:value
  class={cn(
    "flex min-h-dvh flex-col bg-gradient-to-b from-zinc-950 to-zinc-900",
    "text-foreground antialiased"
  )}
>
  <header
    class="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/10 bg-zinc-900/80 px-3 py-2.5 backdrop-blur-sm"
  >
    <TabsList
      class={cn(
        "inline-flex items-center gap-1 rounded-[10px] bg-zinc-800/50 p-1",
        "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)]"
      )}
    >
      <TabsTrigger value="terminal" class={triggerClass}>运行</TabsTrigger>
      <TabsTrigger value="preview" class={triggerClass}>预览</TabsTrigger>
    </TabsList>
    {#if actions}
      <div class="ml-auto flex items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </header>
  {@render children()}
</Tabs>
