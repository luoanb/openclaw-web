<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RuntimeManagerProvider } from "$lib/core/runtime";
  import type { RuntimeSnapshot, RuntimeStatus } from "os-core";

  const manager = RuntimeManagerProvider.getRuntimeManager();

  let snapshot: RuntimeSnapshot = $state(manager.getSnapshot());
  let busy = $state(false);
  let actionError: string | null = $state(null);

  onMount(() => {
    const unsubscribe = manager.onEvent(() => {
      snapshot = manager.getSnapshot();
    });

    return unsubscribe;
  });

  async function bootRuntime() {
    await runAction(() => manager.boot({ reason: snapshot.status === "failed" ? "retry" : "manual" }));
  }

  async function stopRuntime() {
    await runAction(() => manager.stop({ reason: "manual" }));
  }

  async function runAction(action: () => Promise<unknown> | undefined) {
    busy = true;
    actionError = null;
    try {
      await action();
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally {
      snapshot = manager.getSnapshot();
      busy = false;
    }
  }

  function statusLabel(status: RuntimeStatus) {
    const labels: Record<RuntimeStatus, string> = {
      idle: "未启动",
      checking: "检查中",
      supported: "检查通过",
      booting: "启动中",
      running: "运行中",
      stopping: "关机中",
      stopped: "已关机",
      failed: "启动失败",
      unsupported: "环境不支持",
    };
    return labels[status];
  }

  function statusBadgeClass(status: RuntimeStatus) {
    if (status === "running") return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300";
    if (status === "supported") return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300";
    if (status === "failed" || status === "unsupported") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
    if (status === "checking" || status === "booting" || status === "stopping") return "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300";
    return "border-border bg-muted text-muted-foreground";
  }

  function capabilityText(value: boolean | string) {
    if (value === true || value === "supported") return "可用";
    if (value === "partial") return "部分支持";
    if (value === "unknown") return "未知";
    return "不可用";
  }
</script>

<section class="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
  <div class="flex flex-wrap items-start gap-3">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold">Runtime status</h2>
        <span class={`rounded-md border px-2 py-0.5 text-[0.625rem] font-medium ${statusBadgeClass(snapshot.status)}`}>
          {statusLabel(snapshot.status)}
        </span>
      </div>
      <p class="mt-1 text-xs/relaxed text-muted-foreground">
        容器会话由 runtime manager 统一启动、检查和关机；终端、文件与预览只消费已运行的 session。
      </p>
    </div>

    <div class="flex gap-2">
      {#if snapshot.status === "running"}
        <Button variant="outline" size="sm" disabled={busy} onclick={stopRuntime}>容器关机</Button>
      {:else if snapshot.status !== "unsupported"}
        <Button size="sm" disabled={busy || snapshot.status === "checking" || snapshot.status === "booting" || snapshot.status === "stopping"} onclick={bootRuntime}>
          {snapshot.status === "failed" ? "重试启动" : "启动容器"}
        </Button>
      {/if}
    </div>
  </div>

  {#if snapshot.session}
    <div class="mt-4 rounded-md border bg-muted/40 p-3 text-xs">
      <div class="font-medium">当前会话</div>
      <div class="mt-1 text-muted-foreground">
        {snapshot.session.kind} / {snapshot.session.id}
      </div>
    </div>
  {/if}

  <div class="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
    <div class="rounded-md border p-3">
      <div class="font-medium">多终端</div>
      <div class="mt-1 text-muted-foreground">{capabilityText(snapshot.capabilities.multipleTerminals)}</div>
    </div>
    <div class="rounded-md border p-3">
      <div class="font-medium">命令运行</div>
      <div class="mt-1 text-muted-foreground">{capabilityText(snapshot.capabilities.commandRun)}</div>
    </div>
    <div class="rounded-md border p-3">
      <div class="font-medium">运行中输入</div>
      <div class="mt-1 text-muted-foreground">{capabilityText(snapshot.capabilities.processStdin)}</div>
    </div>
    <div class="rounded-md border p-3">
      <div class="font-medium">容器关机</div>
      <div class="mt-1 text-muted-foreground">{capabilityText(snapshot.capabilities.shutdown)}</div>
    </div>
    <div class="rounded-md border p-3">
      <div class="font-medium">文件持久化</div>
      <div class="mt-1 text-muted-foreground">{capabilityText(snapshot.capabilities.filePersistence)}</div>
    </div>
    <div class="rounded-md border p-3">
      <div class="font-medium">服务预览</div>
      <div class="mt-1 text-muted-foreground">{capabilityText(snapshot.capabilities.servicePreview)}</div>
    </div>
  </div>

  {#if snapshot.lastCheck && !snapshot.lastCheck.ok}
    <div class="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
      <div class="font-medium">依赖检查未通过</div>
      <ul class="mt-2 list-disc space-y-1 pl-4">
        {#each snapshot.lastCheck.issues as issue}
          <li>{issue.message}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if snapshot.lastError || actionError}
    <div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
      {snapshot.lastError?.message ?? actionError}
    </div>
  {/if}
</section>
