<script lang="ts">
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { cn } from "$lib/utils";
  import { icons, type IconName } from "./icons";

  type Props = {
    name: IconName;
    label?: string;
    class?: string;
    strokeWidth?: number;
  };

  let {
    name,
    label,
    class: className,
    strokeWidth = 2,
  }: Props = $props();
</script>

<HugeiconsIcon
  icon={icons[name]}
  {strokeWidth}
  class={cn("size-4 shrink-0", className)}
  aria-hidden={label ? undefined : "true"}
  aria-label={label}
/>
