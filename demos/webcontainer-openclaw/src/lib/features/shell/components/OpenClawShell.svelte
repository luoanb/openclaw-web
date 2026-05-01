<script lang="ts">
  import { Tabs } from "bits-ui";
  import type { WebContainer } from "@webcontainer/api";
  import { attachPreview } from "$lib/features/preview/preview";
  import TerminalPanel from "$lib/features/terminal/components/TerminalPanel.svelte";
  import PreviewPanel from "$lib/features/preview/components/PreviewPanel.svelte";
  import { cn } from "$lib/ui/utils/cn";

  const isolated = globalThis.crossOriginIsolated;

  let tabValue = $state("terminal");
  let previewIframe = $state<HTMLIFrameElement | null>(null);
  let detachPreview = $state<(() => void) | null>(null);
  let previewStatusHtml = $state(
    '<span class="preview-muted">启动 HTTP 服务后由 server-ready 填充。</span>',
  );

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wirePreview(wc: WebContainer): void {
    const iframe = previewIframe;
    if (!iframe || detachPreview != null) return;
    detachPreview = attachPreview(wc, iframe, (ev) => {
      if (ev.status === "waiting") {
        previewStatusHtml =
          "已订阅 <code>server-ready</code>；终端执行如 <code>npx serve -l 3000</code> …";
        return;
      }
      if (ev.status === "ready" && ev.url) {
        previewStatusHtml = `端口 <strong>${String(ev.port ?? "?")}</strong> → <code>${escapeHtml(ev.url)}</code>`;
      }
    });
  }

  function onIframeError(): void {
    previewStatusHtml =
      '<span class="preview-warn">iframe 加载异常（COEP/混合内容）。可用「新标签」。</span>';
  }

  const triggerClass = cn(
    "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] outline-none transition-colors",
    "hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--shell-bg)]",
    "data-[state=active]:bg-[var(--surface-muted)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-sm",
  );
</script>

<Tabs.Root bind:value={tabValue} class="flex min-h-dvh flex-col bg-[var(--shell-bg)]">
  <div
    class="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2 py-1.5"
  >
    <Tabs.List class="flex flex-wrap items-center gap-1">
      <Tabs.Trigger value="terminal" class={triggerClass}>终端</Tabs.Trigger>
      <Tabs.Trigger value="preview" class={triggerClass}>预览</Tabs.Trigger>
    </Tabs.List>
    <a
      class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-muted)] no-underline hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
      href="https://webcontainers.io/"
      title="WebContainers"
      target="_blank"
      rel="noreferrer"
    >
      ?
    </a>
  </div>

  <div
    class={cn(
      "shrink-0 border-b px-3 py-1.5 text-[0.78rem] leading-snug",
      isolated
        ? "border-[var(--banner-ok-border)] bg-[var(--banner-ok-bg)] text-[var(--banner-ok-fg)]"
        : "border-[var(--banner-warn-border)] bg-[var(--banner-warn-bg)] text-[var(--banner-warn-fg)]",
    )}
    role="status"
  >
    {isolated
      ? "crossOriginIsolated 已就绪。"
      : "未处于 crossOriginIsolated：请通过本 demo 的 Vite dev/preview 访问并硬刷新。"}
  </div>

  <div class="relative flex min-h-0 flex-1 flex-col">
    <Tabs.Content
      value="terminal"
      class="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pb-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
    >
      <TerminalPanel {isolated} {wirePreview} />
    </Tabs.Content>
    <Tabs.Content
      value="preview"
      class="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pb-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
    >
      <PreviewPanel bind:iframeRef={previewIframe} statusHtml={previewStatusHtml} {onIframeError} />
    </Tabs.Content>
  </div>
</Tabs.Root>
