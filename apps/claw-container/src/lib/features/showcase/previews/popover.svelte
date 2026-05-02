<script lang="ts">
	import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover";
	import { Button } from "$lib/components/ui/button";
</script>

<Popover>
	<PopoverTrigger>
		<Button type="button" variant="outline">打开 Popover</Button>
	</PopoverTrigger>
	<PopoverContent>
		<div class="text-xs">
			<p class="font-medium">Popover 标题</p>
			<p class="text-muted-foreground">这是 Popover 的内容区域。</p>
		</div>
	</PopoverContent>
</Popover>