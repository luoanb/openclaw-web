<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { HugeiconsIcon } from "@hugeicons/svelte";
	import { Loading03Icon } from "@hugeicons/core-free-icons";

	let {
		class: className,
		role = "status",
		"aria-label": ariaLabel = "Loading",
	}: {
		class?: string | null;
		role?: string;
		"aria-label"?: string;
	} = $props();
</script>

<HugeiconsIcon
	icon={Loading03Icon}
	strokeWidth={2}
	{role}
	aria-label={ariaLabel}
	class={cn("size-4 animate-spin", className ?? undefined)}
/>
