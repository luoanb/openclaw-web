<script lang="ts">
  import Tabs from "$lib/components/ui/tabs/tabs.svelte";
  import TabsList from "$lib/components/ui/tabs/tabs-list.svelte";
  import TabsTrigger from "$lib/components/ui/tabs/tabs-trigger.svelte";
  import TabsContent from "$lib/components/ui/tabs/tabs-content.svelte";
  import type { WebContainer } from "@webcontainer/api";
  import { attachPreview } from "web-os";
  import TerminalPanel from "$lib/features/terminal/components/TerminalPanel.svelte";
  import PreviewPanel from "$lib/features/preview/components/PreviewPanel.svelte";
  import StatusBanner from "$lib/ui/components/StatusBanner.svelte";
  import IconCircleLink from "$lib/ui/components/IconCircleLink.svelte";
  import { toast } from "$lib/ui/toast/toast.svelte";
  import { escapeHtml } from "$lib/ui-old/utils/html";
  import { cn } from "$lib/utils.js";

  const isolated = globalThis.crossOriginIsolated;

  let tabValue = $state("terminal");
  let previewIframe = $state<HTMLIFrameElement | null>(null);
  let previewWc = $state<WebContainer | null>(null);
  let previewUrl = $state<string | null>(null);
  let previewStatusHtml = $state(
    '<span class="text-muted-foreground">启动 HTTP 服务后由 server-ready 填充。</span>',
  );

  $effect(() => {
    const iframe = previewIframe;
    const wc = previewWc;
    if (!iframe || !wc) return;

    const unsub = attachPreview(wc, iframe, (ev) => {
      if (ev.status === "waiting") {
        previewStatusHtml =
          "已订阅 <code>server-ready</code>；终端执行如 <code>npx serve -l 3000</code> …";
        previewUrl = null;
        return;
      }
      if (ev.status === "ready" && ev.url) {
        previewStatusHtml = `端口 <strong>${String(ev.port ?? "?")}</strong> → <code>${escapeHtml(ev.url)}</code>`;
        previewUrl = ev.url;
      }
    });

    return () => {
      unsub();
    };
  });

  function wirePreview(wc: WebContainer): void {
    if (previewWc !== wc) previewWc = wc;
  }

  function onIframeError(): void {
    previewStatusHtml =
      '<span class="text-destructive">iframe 加载异常（COEP/混合内容）。可用「新标签」。</span>';
    toast("iframe 加载异常（COEP/混合内容）。可尝试「新标签」打开预览。", {
      variant: "warning",
    });
  }

  const tabPanelClass = cn(
    "flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-2",
  );
</script>

<Tabs bind:value={tabValue} class="flex min-h-dvh flex-col">
  <header
    class="flex shrink-0 flex-wrap items-center gap-3 border-b bg-background px-3 py-2"
  >
    <TabsList>
      <TabsTrigger value="terminal">运行</TabsTrigger>
      <TabsTrigger value="preview">预览</TabsTrigger>
    </TabsList>
    <div class="ml-auto flex items-center gap-2">
      <IconCircleLink href="https://webcontainers.io/" title="WebContainers"
        >?</IconCircleLink
      >
    </div>
  </header>

  {#if !isolated}
    <StatusBanner variant="warning">
      未处于 crossOriginIsolated：请通过本 demo 的 Vite dev/preview
      访问并硬刷新。
    </StatusBanner>
  {/if}

  <div class="relative flex min-h-0 flex-1 flex-col">
    <TabsContent value="terminal" class={tabPanelClass}>
      <TerminalPanel {isolated} {wirePreview} />
    </TabsContent>
    <TabsContent value="preview" class={tabPanelClass}>
      <PreviewPanel
        bind:iframeRef={previewIframe}
        {previewUrl}
        statusHtml={previewStatusHtml}
        {onIframeError}
      />
    </TabsContent>
  </div>
</Tabs>
