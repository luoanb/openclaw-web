<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Drawer from "$lib/components/ui/drawer";
  import { Icon, type IconName } from "$lib/components/icon";
  import { RuntimeManagerProvider } from "$lib/core/runtime";
  import * as Tabs from "$lib/components/ui/tabs";
  import FilesPanel from "$lib/features/files/components/FilesPanel.svelte";
  import PreviewPanel from "$lib/features/preview/components/PreviewPanel.svelte";
  import RuntimeStatusPanel from "$lib/features/runtime/components/RuntimeStatusPanel.svelte";
  import TerminalPanel from "$lib/features/terminal/components/TerminalPanel.svelte";
  import StatusBanner from "$lib/ui/components/StatusBanner.svelte";
  import ToastRegion from "$lib/ui/components/ToastRegion.svelte";
  import type { RuntimeSnapshot, RuntimeStatus } from "os-core";

  const runtimeManager = RuntimeManagerProvider.getRuntimeManager();

  let runtimeSnapshot: RuntimeSnapshot = $state(runtimeManager.getSnapshot());
  let runtimeDrawerOpen = $state(false);
  let bootInFlight: Promise<void> | null = null;

  onMount(() => {
    const unsubscribe = runtimeManager.onEvent(() => {
      runtimeSnapshot = runtimeManager.getSnapshot();
    });

    void startRuntimeOnAppOpen();

    return unsubscribe;
  });

  async function startRuntimeOnAppOpen() {
    if (bootInFlight) return bootInFlight;

    bootInFlight = runStartupFlow().finally(() => {
      bootInFlight = null;
      runtimeSnapshot = runtimeManager.getSnapshot();
    });

    return bootInFlight;
  }

  async function runStartupFlow() {
    let status = runtimeManager.getSnapshot().status;
    if (status === "running" || status === "checking" || status === "booting" || status === "unsupported") {
      return;
    }

    if (runtimeManager.check && (status === "idle" || status === "stopped" || status === "failed")) {
      const check = await runtimeManager.check({ reason: "app-open" });
      runtimeSnapshot = runtimeManager.getSnapshot();
      if (!check.ok) return;
      status = runtimeManager.getSnapshot().status;
    }

    if (status === "supported" || status === "idle" || status === "stopped" || status === "failed") {
      await runtimeManager.boot({ reason: "app-open" });
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
    if (status === "failed" || status === "unsupported") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
    if (status === "checking" || status === "booting" || status === "stopping") return "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300";
    return "border-border bg-muted text-muted-foreground";
  }

  function statusIconName(status: RuntimeStatus): IconName {
    if (status === "running" || status === "supported") return "checkCircle";
    if (status === "failed" || status === "unsupported") return "errorCircle";
    if (status === "checking" || status === "booting" || status === "stopping") return "loading";
    return "info";
  }
</script>

<svelte:head>
  <title>Web Claw</title>
</svelte:head>

<Drawer.Root direction="right" bind:open={runtimeDrawerOpen}>
  <main class="flex h-dvh w-dvw min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <StatusBanner variant="neutral">
      Web Claw runtime manager is wired through os-core and the BrowserPod adapter.
    </StatusBanner>

    <section class="flex min-h-0 flex-1 flex-col">
      <Tabs.Root value="terminal" class="min-h-0 flex-1 gap-0 overflow-hidden">
        <div class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          <div class="mr-2 text-xs font-medium">Web Claw</div>
          <Tabs.List variant="line" class="h-8">
            <Tabs.Trigger value="terminal">
              <Icon name="terminal" class="size-3.5" />
              Terminal
            </Tabs.Trigger>
            <Tabs.Trigger value="files">
              <Icon name="folder" class="size-3.5" />
              Files
            </Tabs.Trigger>
            <Tabs.Trigger value="preview">
              <Icon name="browser" class="size-3.5" />
              Preview
            </Tabs.Trigger>
          </Tabs.List>
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              class={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[0.625rem] font-medium ${statusBadgeClass(runtimeSnapshot.status)}`}
              onclick={() => (runtimeDrawerOpen = true)}
            >
              <Icon
                name={statusIconName(runtimeSnapshot.status)}
                class={`size-3 ${runtimeSnapshot.status === "checking" || runtimeSnapshot.status === "booting" || runtimeSnapshot.status === "stopping" ? "animate-spin" : ""}`}
              />
              {statusLabel(runtimeSnapshot.status)}
            </button>
            <Button variant="outline" size="sm" onclick={() => (runtimeDrawerOpen = true)}>
              <Icon name="info" class="size-3" />
              More
            </Button>
          </div>
        </div>

        <Tabs.Content value="terminal" class="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
          <TerminalPanel />
        </Tabs.Content>

        <Tabs.Content value="files" class="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
          <FilesPanel onOpenRuntime={() => (runtimeDrawerOpen = true)} />
        </Tabs.Content>

        <Tabs.Content value="preview" class="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
          <PreviewPanel onOpenRuntime={() => (runtimeDrawerOpen = true)} />
        </Tabs.Content>
      </Tabs.Root>
    </section>

    <ToastRegion />
  </main>

  <Drawer.Content class="w-[24rem] sm:max-w-md">
    <Drawer.Header>
      <Drawer.Title>Runtime status</Drawer.Title>
      <Drawer.Description>
        容器状态、依赖检查、能力摘要和当前会话。
      </Drawer.Description>
    </Drawer.Header>
    <div class="min-h-0 overflow-y-auto px-4 pb-4">
      <RuntimeStatusPanel />
    </div>
  </Drawer.Content>
</Drawer.Root>
