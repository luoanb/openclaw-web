<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Icon } from "$lib/components/icon";
  import { RuntimeManagerProvider } from "$lib/core/runtime";
  import { PreviewServiceProvider, PreviewWorkspaceState, type PreviewWorkspaceSnapshot } from "$lib/core/preview";
  import type { PreviewTarget } from "os-core";

  type Props = {
    onOpenRuntime?: () => void;
  };

  const { onOpenRuntime = () => undefined }: Props = $props();
  const previewState = new PreviewWorkspaceState(
    RuntimeManagerProvider.getRuntimeManager(),
    PreviewServiceProvider.getPreviewDiscoveryService(),
  );

  let snapshot: PreviewWorkspaceSnapshot = $state(previewState.getSnapshot());
  let manualUrl = $state("");
  let actionMessage: string | null = $state(null);
  let iframeKey = $state(0);

  onMount(() => {
    const unsubscribePreview = previewState.subscribe((nextSnapshot) => {
      snapshot = nextSnapshot;
    });
    const stop = previewState.start();

    return () => {
      unsubscribePreview();
      stop();
    };
  });

  function selectedTarget(): PreviewTarget | null {
    const selectedId = snapshot.selection.selectedTargetId;
    return snapshot.registry?.targets.find((target) => target.id === selectedId) ?? snapshot.registry?.targets[0] ?? null;
  }

  function targets(): readonly PreviewTarget[] {
    return snapshot.registry?.targets ?? [];
  }

  function isRuntimeRunning(): boolean {
    return snapshot.runtimeStatus === "running";
  }

  function addManualUrl() {
    actionMessage = null;
    const result = previewState.addManualUrl(manualUrl);
    if (!result.ok) {
      actionMessage = result.error.message;
      return;
    }
    manualUrl = "";
    iframeKey += 1;
  }

  function selectTarget(targetId: string) {
    actionMessage = null;
    const result = previewState.select(targetId);
    if (!result.ok) {
      actionMessage = result.error.message;
      return;
    }
    iframeKey += 1;
  }

  function refreshPreview() {
    const target = selectedTarget();
    if (!target) return;

    previewState.markLoading(target.id);
    iframeKey += 1;
  }

  function openExternal() {
    const target = selectedTarget();
    if (!target) return;

    window.open(target.url, "_blank", "noopener,noreferrer");
  }

  function clearSelected() {
    const target = selectedTarget();
    if (!target) return;

    previewState.clear(target.id);
    iframeKey += 1;
  }

  function handleIframeLoad() {
    const target = selectedTarget();
    if (!target) return;

    previewState.markReady(target.id);
  }

  function handleIframeError() {
    const target = selectedTarget();
    if (!target) return;

    previewState.markFailed(target.id, {
      code: "iframe-load-failed",
      message: "Preview failed to load. Try opening it in a new browser tab.",
      recoverable: true,
    });
  }

  function handleManualKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addManualUrl();
  }
</script>

<section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
  <div class="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <Icon name="browser" class="size-3.5 text-muted-foreground" />
      <div class="min-w-0">
        <div class="truncate text-xs font-medium">Service Preview</div>
        <div class="truncate text-[0.6875rem] text-muted-foreground">
          {selectedTarget()?.label ?? "Waiting for a BrowserPod Portal"}
        </div>
      </div>
    </div>

    {#if targets().length > 0}
      <select
        class="h-8 max-w-[16rem] rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
        aria-label="Select service preview"
        value={selectedTarget()?.id ?? ""}
        onchange={(event) => selectTarget(event.currentTarget.value)}
      >
        {#each targets() as target}
          <option value={target.id}>{target.label} · {new URL(target.url).host}</option>
        {/each}
      </select>
    {/if}

    <div class="flex min-w-[16rem] flex-1 items-center gap-2 sm:max-w-[24rem]">
      <input
        class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        aria-label="Manual service preview URL"
        placeholder="Paste Portal URL"
        bind:value={manualUrl}
        onkeydown={handleManualKeydown}
      />
      <Button size="sm" variant="outline" disabled={!manualUrl.trim()} onclick={addManualUrl}>
        <Icon name="add" class="size-3" />
        Add
      </Button>
    </div>

    <Button size="sm" variant="ghost" disabled={!selectedTarget()} onclick={refreshPreview} aria-label="Refresh preview">
      <Icon name="refresh" class="size-3" />
    </Button>
    <Button size="sm" variant="ghost" disabled={!selectedTarget()} onclick={openExternal} aria-label="Open preview in new tab">
      <Icon name="browser" class="size-3" />
    </Button>
    <Button size="sm" variant="ghost" disabled={!selectedTarget()} onclick={clearSelected} aria-label="Clear preview">
      <Icon name="close" class="size-3" />
    </Button>
  </div>

  {#if !isRuntimeRunning()}
    <div class="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
      <div class="max-w-[28rem]">
        <Icon name="alert" class="mx-auto mb-3 size-5 text-muted-foreground" />
        <p class="text-sm font-medium">容器未运行</p>
        <p class="mt-2 text-xs/relaxed text-muted-foreground">
          Preview 只消费已运行的 runtime session，不会自行 boot BrowserPod。
        </p>
        <Button class="mt-4" size="sm" variant="outline" onclick={onOpenRuntime}>打开容器面板</Button>
      </div>
    </div>
  {:else if targets().length === 0}
    <div class="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
      <div class="max-w-[32rem]">
        <Icon name="browser" class="mx-auto mb-3 size-6 text-muted-foreground" />
        <p class="text-sm font-medium">等待服务地址</p>
        <p class="mt-2 text-xs/relaxed text-muted-foreground">
          在终端中启动 HTTP 服务后，BrowserPod Portal URL 会出现在这里。也可以手动粘贴 Portal URL。
        </p>
        {#if snapshot.portalUnavailable}
          <p class="mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
            {snapshot.errorMessage ?? "BrowserPod Portal API is unavailable. Manual URLs are still supported."}
          </p>
        {/if}
        {#if actionMessage}
          <p class="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {actionMessage}
          </p>
        {/if}
      </div>
    </div>
  {:else if selectedTarget()}
    <div class="flex min-h-0 flex-1 flex-col">
      {#if actionMessage || snapshot.render.error}
        <div class="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-1">
            <Icon name="info" class="size-3.5" />
            {actionMessage ?? snapshot.render.error?.message}
          </span>
        </div>
      {/if}
      {#key iframeKey}
        <iframe
          class="min-h-0 flex-1 border-0 bg-background"
          src={selectedTarget()?.url}
          title={`Preview for ${selectedTarget()?.label ?? "service"}`}
          onload={handleIframeLoad}
          onerror={handleIframeError}
        ></iframe>
      {/key}
    </div>
  {/if}
</section>
