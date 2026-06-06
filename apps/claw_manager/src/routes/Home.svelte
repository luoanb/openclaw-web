<script lang="ts">
  import { Icon } from "$lib/components/icon";
</script>

<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
  <div>
    <h1 class="text-lg font-semibold">Dashboard</h1>
    <p class="text-xs text-muted-foreground mt-1">Welcome to Claw Manager. This is a base admin template.</p>
  </div>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <div class="rounded-lg border p-4">
      <div class="flex items-center gap-2">
        <Icon name="info" class="size-4 text-muted-foreground" />
        <span class="text-xs font-medium">Total Users</span>
      </div>
      <p class="mt-2 text-2xl font-semibold">--</p>
      <p class="mt-1 text-[0.625rem] text-muted-foreground">Placeholder statistic</p>
    </div>
    <div class="rounded-lg border p-4">
      <div class="flex items-center gap-2">
        <Icon name="folder" class="size-4 text-muted-foreground" />
        <span class="text-xs font-medium">Projects</span>
      </div>
      <p class="mt-2 text-2xl font-semibold">--</p>
      <p class="mt-1 text-[0.625rem] text-muted-foreground">Placeholder statistic</p>
    </div>
    <div class="rounded-lg border p-4">
      <div class="flex items-center gap-2">
        <Icon name="checkCircle" class="size-4 text-muted-foreground" />
        <span class="text-xs font-medium">Active Tasks</span>
      </div>
      <p class="mt-2 text-2xl font-semibold">--</p>
      <p class="mt-1 text-[0.625rem] text-muted-foreground">Placeholder statistic</p>
    </div>
  </div>

  <div class="rounded-lg border p-4">
    <h2 class="text-sm font-medium mb-3">Getting Started</h2>
    <ol class="list-inside list-decimal space-y-2 text-xs text-muted-foreground">
      <li>Replace placeholder pages with your own content</li>
      <li>Add your navigation items to the sidebar</li>
      <li>Wire up your data sources and API endpoints</li>
      <li>Remove this readme once you're up and running</li>
    </ol>
  </div>
</div>
