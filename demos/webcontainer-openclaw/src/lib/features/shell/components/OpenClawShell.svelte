<script lang="ts">
  import { Tabs } from "bits-ui";
  import type { WebContainer } from "@webcontainer/api";
  import { attachPreview } from "$lib/features/preview/preview";
  import TerminalPanel from "$lib/features/terminal/components/TerminalPanel.svelte";
  import PreviewPanel from "$lib/features/preview/components/PreviewPanel.svelte";
  import ShellTabs from "$lib/ui/components/ShellTabs.svelte";
  import StatusBanner from "$lib/ui/components/StatusBanner.svelte";
  import IconCircleLink from "$lib/ui/components/IconCircleLink.svelte";
  import { toast } from "$lib/ui/toast/toast.svelte";
  import { escapeHtml } from "$lib/ui/utils/html";
  import { cn } from "$lib/ui/utils/cn";

  const isolated = globalThis.crossOriginIsolated;

  let tabValue = $state("terminal");
  let previewIframe = $state<HTMLIFrameElement | null>(null);
  let previewWc = $state<WebContainer | null>(null);
  /** `server-ready` 回调里的权威 URL，避免仅靠 iframe.src（未挂载/时序问题时为空）导致按钮无操作 */
  let previewUrl = $state<string | null>(null);
  let previewStatusHtml = $state(
    '<span class="preview-muted">启动 HTTP 服务后由 server-ready 填充。</span>',
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
      '<span class="preview-warn">iframe 加载异常（COEP/混合内容）。可用「新标签」。</span>';
    toast("iframe 加载异常（COEP/混合内容）。可尝试「新标签」打开预览。", { variant: "warning" });
  }

  const tabPanelClass = cn(
    "flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-2 tab-panel-focus",
  );
</script>

<ShellTabs bind:value={tabValue}>
  {#snippet actions()}
    <IconCircleLink href="https://webcontainers.io/" title="WebContainers">?</IconCircleLink>
  {/snippet}
  {#snippet children()}
    {#if !isolated}
      <StatusBanner variant="warning">
        未处于 crossOriginIsolated：请通过本 demo 的 Vite dev/preview 访问并硬刷新。
      </StatusBanner>
    {/if}
    <div class="relative flex min-h-0 flex-1 flex-col">
      <Tabs.Content value="terminal" class={tabPanelClass}>
        <TerminalPanel {isolated} {wirePreview} />
      </Tabs.Content>
      <Tabs.Content value="preview" class={tabPanelClass}>
        <PreviewPanel
          bind:iframeRef={previewIframe}
          previewUrl={previewUrl}
          statusHtml={previewStatusHtml}
          {onIframeError}
        />
      </Tabs.Content>
    </div>
  {/snippet}
</ShellTabs>
