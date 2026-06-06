<script lang="ts">
  import { Button } from "$lib/components/ui/button";
</script>

<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
  <div>
    <h1 class="text-lg font-semibold">Settings</h1>
    <p class="text-xs text-muted-foreground mt-1">Application settings (placeholder).</p>
  </div>

  <div class="flex flex-col gap-4 max-w-lg">
    <div class="rounded-lg border p-4">
      <h2 class="text-sm font-medium mb-3">Appearance</h2>
      <p class="text-xs text-muted-foreground mb-3">Theme and display preferences will appear here.</p>
      <div class="flex gap-2">
        <Button variant="outline" size="sm">Light</Button>
        <Button variant="outline" size="sm">Dark</Button>
        <Button variant="outline" size="sm">System</Button>
      </div>
    </div>

    <div class="rounded-lg border p-4">
      <h2 class="text-sm font-medium mb-3">Notifications</h2>
      <p class="text-xs text-muted-foreground mb-3">Notification preferences will appear here.</p>
      <Button variant="outline" size="sm" disabled>Configure</Button>
    </div>

    <div class="rounded-lg border p-4">
      <h2 class="text-sm font-medium mb-3">About</h2>
      <p class="text-xs text-muted-foreground">Claw Manager v0.0.0</p>
      <p class="text-xs text-muted-foreground">Svelte 5 + Tailwind CSS 4 + shadcn-svelte</p>
    </div>
  </div>
</div>
