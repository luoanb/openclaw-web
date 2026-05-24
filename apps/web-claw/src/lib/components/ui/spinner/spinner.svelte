<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { SVGAttributes } from "svelte/elements";

	let {
		class: className,
		role = "status",
		"aria-label": ariaLabel = "Loading",
		...restProps
	}: SVGAttributes<SVGSVGElement> = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	{role}
	aria-label={ariaLabel}
	class={cn("size-4 animate-spin", className)}
	{...restProps}
>
	<path d="M21 12a9 9 0 1 1-6.64-8.69" />
</svg>
