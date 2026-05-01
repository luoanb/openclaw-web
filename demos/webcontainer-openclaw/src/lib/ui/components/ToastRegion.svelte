<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { dismissToast, items, type ToastVariant } from "$lib/ui/toast/toast.svelte";

  const variantClass: Record<ToastVariant, string> = {
    info: "bg-background border-border",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
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
        "pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm leading-snug shadow-lg",
        variantClass[t.variant],
      )}
      role={t.variant === "error" ? "alert" : "status"}
    >
      <p class="min-w-0 flex-1">{t.message}</p>
      <button
        type="button"
        class="shrink-0 rounded px-1.5 py-0.5 text-base leading-none hover:bg-muted"
        aria-label="关闭"
        onclick={() => dismissToast(t.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>
