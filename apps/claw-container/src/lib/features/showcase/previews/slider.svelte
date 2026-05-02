<script lang="ts">
	import { Slider } from "$lib/components/ui/slider";

	let value = $state(50);
</script>

<div class="flex max-w-xs flex-col gap-2">
	<Slider bind:value type="single" />
	<p class="text-muted-foreground text-xs">当前值：{value}</p>
</div>