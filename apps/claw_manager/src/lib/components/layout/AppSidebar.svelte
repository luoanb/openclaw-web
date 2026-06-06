<script lang="ts">
  import { Icon, type IconName } from "$lib/components/icon";
  import { cn } from "$lib/utils";

  type NavItem = {
    label: string;
    icon: IconName;
    page: string;
  };

  type Props = {
    items: NavItem[];
    active: string;
    onNavigate: (page: string) => void;
    collapsed: boolean;
  };

  let { items, active, onNavigate, collapsed }: Props = $props();
</script>

<aside
  class={cn(
    "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200",
    collapsed ? "w-14" : "w-56"
  )}
>
  <div class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
    {#if !collapsed}
      <span class="text-xs font-semibold tracking-tight">Claw Manager</span>
    {:else}
      <span class="mx-auto text-xs font-bold">CM</span>
    {/if}
  </div>

  <nav class="flex-1 overflow-y-auto p-2">
    <ul class="flex flex-col gap-1">
      {#each items as item}
        <li>
          <button
            type="button"
            onclick={() => onNavigate(item.page)}
            class={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs/relaxed transition-colors",
              active === item.page
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon name={item.icon} class="size-4 shrink-0" />
            {#if !collapsed}
              <span class="truncate">{item.label}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="border-t p-2">
    <button
      type="button"
      onclick={() => onNavigate("settings")}
      class={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs/relaxed transition-colors",
        active === "settings"
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <Icon name="settings" class="size-4 shrink-0" />
      {#if !collapsed}
        <span class="truncate">Settings</span>
      {/if}
    </button>
  </div>
</aside>
