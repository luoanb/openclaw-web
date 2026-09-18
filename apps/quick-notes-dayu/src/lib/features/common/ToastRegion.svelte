<script lang="ts">
  import { dismissToast, toastItems, type ToastVariant } from "$lib/core/toast/toast.svelte";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import Icons from "$lib/features/common/Icons.svelte";

  const { t } = getLocaleStore();

  const VARIANT_CLASS: Record<ToastVariant, string> = {
    info: "border-border bg-card text-foreground",
    success: "border-emerald-600 bg-emerald-50 text-emerald-800",
    warning: "border-amber-600 bg-amber-50 text-amber-800",
    error: "border-red-600 bg-red-50 text-red-800",
  };
</script>

<div
  class="pointer-events-none fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
  aria-live="polite"
  aria-relevant="additions text"
>
  {#each toastItems as item (item.id)}
    <div
      class="pointer-events-auto flex w-fit max-w-[min(24rem,calc(100vw-2rem))] items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-md {VARIANT_CLASS[
        item.variant
      ]}"
      role={item.variant === "error" ? "alert" : "status"}
    >
      <p class="min-w-0 flex-1 whitespace-pre-wrap break-words">{item.message}</p>
      <button
        class="shrink-0 rounded p-0.5 hover:bg-muted"
        type="button"
        aria-label={t("common.close")}
        onclick={() => dismissToast(item.id)}
      >
        <Icons name="close" class="size-3.5" />
      </button>
    </div>
  {/each}
</div>
