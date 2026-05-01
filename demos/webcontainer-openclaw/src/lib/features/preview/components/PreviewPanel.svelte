<script lang="ts">
  import Button from "$lib/ui/components/Button.svelte";
  import PanelFrame from "$lib/ui/components/PanelFrame.svelte";
  import { toast } from "$lib/ui/toast/toast.svelte";

  type Props = {
    statusHtml?: string;
    previewUrl?: string | null;
    onIframeError?: () => void;
    iframeRef?: HTMLIFrameElement | null;
  };

  let {
    statusHtml = "",
    previewUrl = null,
    iframeRef = $bindable<HTMLIFrameElement | null>(null),
    onIframeError,
  }: Props = $props();

  function resolvePreviewHref(): string {
    const fromProp = previewUrl?.trim() ?? "";
    const fromIframe = iframeRef?.src?.trim() ?? "";
    return fromProp || fromIframe;
  }

  function onOpenInNewTab(): void {
    const u = resolvePreviewHref();
    if (!u) {
      toast("暂无预览地址。请先在终端启动 HTTP 服务（例如 npx serve -l 3000）。", {
        variant: "warning",
      });
      return;
    }
    const win = window.open(u, "_blank", "noopener,noreferrer");
    if (!win) {
      toast("未能打开新标签，可能被浏览器拦截弹窗。请允许本站弹出窗口后重试。", {
        variant: "warning",
      });
      return;
    }
    toast("已在新标签打开预览。", { variant: "success" });
  }

  function onRefreshPreview(): void {
    const el = iframeRef;
    const u = resolvePreviewHref();
    if (!el) {
      toast("预览区域尚未就绪，请稍后再试。", { variant: "warning" });
      return;
    }
    if (!u) {
      toast("暂无预览地址。请先在终端启动 HTTP 服务（例如 npx serve -l 3000）。", {
        variant: "warning",
      });
      return;
    }
    el.src = u;
    toast("已请求刷新预览。", { variant: "info" });
  }
</script>

<div class="preview-status" aria-live="polite">
  {@html statusHtml}
</div>

<PanelFrame class="flex min-h-48 flex-1 flex-col overflow-hidden p-0">
  <iframe
    bind:this={iframeRef}
    class="h-full min-h-[12rem] w-full flex-1 border-0 bg-[color:var(--preview-iframe-bg)]"
    title="WebContainer 预览"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    onerror={onIframeError}
  ></iframe>
</PanelFrame>

<div class="mt-3 flex shrink-0 flex-wrap gap-2">
  <Button variant="secondary" onclick={onOpenInNewTab}>新标签打开</Button>
  <Button variant="secondary" onclick={onRefreshPreview}>刷新</Button>
</div>
