<script lang="ts">
	import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";

	let value = $state<string[]>(["a"]);
</script>

<div class="flex flex-col gap-2">
	<ToggleGroup bind:value type="multiple" class="justify-start">
		<ToggleGroupItem value="a">A</ToggleGroupItem>
		<ToggleGroupItem value="b">B</ToggleGroupItem>
		<ToggleGroupItem value="c">C</ToggleGroupItem>
	</ToggleGroup>
	<p class="text-muted-foreground text-xs">当前选中：{value.join(", ")}</p>
</div>