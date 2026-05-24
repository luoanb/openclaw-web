<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Tabs from "$lib/components/ui/tabs";
  import RuntimeStatusPanel from "$lib/features/runtime/components/RuntimeStatusPanel.svelte";
  import TerminalPanel from "$lib/features/terminal/components/TerminalPanel.svelte";
  import StatusBanner from "$lib/ui/components/StatusBanner.svelte";
  import ToastRegion from "$lib/ui/components/ToastRegion.svelte";
</script>

<svelte:head>
  <title>Web Claw</title>
</svelte:head>

<main class="flex min-h-dvh flex-col bg-background text-foreground">
  <StatusBanner variant="neutral">
    Web Claw runtime manager is wired through os-core and the BrowserPod adapter.
  </StatusBanner>

  <section class="flex min-h-0 flex-1 flex-col">
    <Tabs.Root value="terminal" class="min-h-0 flex-1 gap-0">
      <div class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <div class="mr-2 text-xs font-medium">Web Claw</div>
        <Tabs.List variant="line" class="h-8">
          <Tabs.Trigger value="terminal">Terminal</Tabs.Trigger>
          <Tabs.Trigger value="files">Files</Tabs.Trigger>
          <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
        </Tabs.List>
        <div class="ml-auto flex items-center gap-2">
          <span class="rounded-md border px-2 py-1 text-[0.625rem] text-muted-foreground">
            Runtime managed
          </span>
          <Button variant="outline" size="sm">More</Button>
        </div>
      </div>

      <Tabs.Content value="terminal" class="flex min-h-0 flex-1 flex-col p-4">
        <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <TerminalPanel />
          <RuntimeStatusPanel />
        </div>
      </Tabs.Content>

      <Tabs.Content value="files" class="p-4 text-muted-foreground">
        Files tab placeholder.
      </Tabs.Content>

      <Tabs.Content value="preview" class="p-4 text-muted-foreground">
        Preview tab placeholder.
      </Tabs.Content>
    </Tabs.Root>
  </section>

  <ToastRegion />
</main>
