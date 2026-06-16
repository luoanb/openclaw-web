<script lang="ts">
  import { Icon } from "$lib/components/icon";
  import { cn } from "$lib/utils";

  const iframeServices = [
    { label: "管理后台", icon: "dashboard" as const, page: "admin", url: "/proxy/admin/" },
    { label: "Code", icon: "code" as const, page: "code-server", url: "https://192.168.1.2:8080/" },
  ];

  const navItems = iframeServices.map((s) => ({ label: s.label, icon: s.icon, page: s.page }));

  let activePage = $state(iframeServices[0].page);
  let isFullscreen = $state(false);

  function navigate(page: string) {
    activePage = page;
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  function onFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
  }

  // 夜间主题
  $effect(() => {
    document.documentElement.classList.add("dark");
  });
</script>

<svelte:head>
  <title>OpenClaw 管理器</title>
</svelte:head>

<svelte:window onfullscreenchange={onFullscreenChange} />

<div class="flex h-dvh w-dvw min-h-0 flex-col bg-background text-foreground">
  <header class="flex h-11 shrink-0 items-center gap-3 border-b px-3">
    <div class="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="4" />
      </svg>
      <span>OpenClaw 管理器</span>
    </div>

    <nav class="flex items-center gap-1">
      {#each navItems as item}
        <button
          type="button"
          onclick={() => navigate(item.page)}
          class={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs/relaxed transition-colors",
            activePage === item.page
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Icon name={item.icon} class="size-4 shrink-0" />
          <span class="truncate">{item.label}</span>
        </button>
      {/each}
    </nav>

    <div class="ml-auto flex items-center gap-1">
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
        onclick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        <Icon name={isFullscreen ? "collapse" : "fullscreen"} class="size-3.5" />
      </button>
    </div>
  </header>

  {#each iframeServices as service}
    <iframe
      src={service.url}
      title={service.label}
      class="h-full w-full border-0"
      class:hidden={activePage !== service.page}
    ></iframe>
  {/each}
</div>
