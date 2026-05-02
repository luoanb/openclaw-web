<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select";

	let value = $state("");
</script>

<div class="max-w-xs space-y-2">
	<Select bind:value type="single">
		<SelectTrigger>
			<span class="text-xs">{value || "请选择"}</span>
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="a">选项 A</SelectItem>
			<SelectItem value="b">选项 B</SelectItem>
			<SelectItem value="c">选项 C</SelectItem>
		</SelectContent>
	</Select>
	<p class="text-muted-foreground text-xs">当前值：{value || "无"}</p>
</div>