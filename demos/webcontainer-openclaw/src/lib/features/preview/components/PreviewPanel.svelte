<script lang="ts">
  import { cn } from "$lib/ui/utils/cn";

  type Props = {
    statusHtml?: string;
    onIframeError?: () => void;
    iframeRef?: HTMLIFrameElement | null;
  };

  let {
    statusHtml = "",
    iframeRef = $bindable<HTMLIFrameElement | null>(null),
    onIframeError,
  }: Props = $props();

  const btnToolbar = cn(
    "rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]",
    "hover:bg-[var(--surface-elevated)]"
  );
</script>

<div
  class={cn(
    "preview-status mb-2 min-h-8 shrink-0 text-[0.8rem] leading-normal text-[var(--text-muted)]"
  )}
  aria-live="polite"
>
  {@html statusHtml}
</div>

<iframe
  bind:this={iframeRef}
  class="min-h-48 w-full flex-1 rounded-lg border border-[var(--border-subtle)] bg-white"
  title="WebContainer 预览"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  onerror={onIframeError}
></iframe>

<div class="mt-2 flex shrink-0 flex-wrap gap-2">
  <button
    type="button"
    onclick={() => {
      const u = iframeRef?.src;
      if (u) window.open(u, "_blank", "noopener,noreferrer");
    }}
  >
    新标签打开
  </button>
  <button
    type="button"
    class={btnToolbar}
    onclick={() => {
      const el = iframeRef;
      if (el?.src) el.src = el.src;
    }}
  >
    刷新
  </button>
</div>
