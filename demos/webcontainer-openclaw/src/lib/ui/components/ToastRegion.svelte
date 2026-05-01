<script lang="ts">
  import { cn } from "$lib/ui/utils/cn";
  import { dismissToast, items, type ToastVariant } from "$lib/ui/toast/toast.svelte";

  const variantClass: Record<ToastVariant, string> = {
    info: cn(
      "border-[color:var(--border-subtle)] bg-[color:var(--toast-info-bg)] text-[color:var(--text-primary)]",
    ),
    success: cn(
      "border-[color:var(--banner-ok-border)] bg-[color:var(--toast-success-bg)] text-[color:var(--banner-ok-fg)]",
    ),
    warning: cn(
      "border-[color:var(--banner-warn-border)] bg-[color:var(--toast-warn-bg)] text-[color:var(--banner-warn-fg)]",
    ),
    error: cn(
      "border-[color:rgba(239,68,68,0.55)] bg-[color:var(--toast-error-bg)] text-[color:#fecaca]",
    ),
  };
</script>

<div
  class="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
  aria-live="polite"
  aria-relevant="additions text"
>
  {#each items as t (t.id)}
    <div
      class={cn(
        "pointer-events-auto flex items-start gap-2 rounded-[var(--panel-radius)] border px-3 py-2.5 text-sm leading-snug shadow-[var(--panel-shadow)]",
        variantClass[t.variant],
      )}
      role={t.variant === "error" ? "alert" : "status"}
    >
      <p class="min-w-0 flex-1">{t.message}</p>
      <button
        type="button"
        class="shrink-0 rounded px-1.5 py-0.5 text-base leading-none text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-primary)]"
        aria-label="关闭"
        onclick={() => dismissToast(t.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>
