<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { dismissToast, items, type ToastVariant } from "$lib/ui/toast/toast.svelte";

  const variantClass: Record<ToastVariant, string> = {
    info: "border-border bg-background text-foreground",
    success: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300",
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
  };
</script>

<div
  class="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
  aria-live="polite"
  aria-relevant="additions text"
>
  {#each items as item (item.id)}
    <div
      class={cn(
        "pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs/relaxed shadow-sm",
        variantClass[item.variant]
      )}
      role={item.variant === "error" ? "alert" : "status"}
    >
      <p class="min-w-0 flex-1">{item.message}</p>
      <button
        type="button"
        class="shrink-0 rounded px-1.5 py-0.5 text-base leading-none hover:bg-muted"
        aria-label="Close notification"
        onclick={() => dismissToast(item.id)}
      >
        x
      </button>
    </div>
  {/each}
</div>
