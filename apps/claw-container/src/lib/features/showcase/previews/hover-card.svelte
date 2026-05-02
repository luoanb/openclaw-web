<script lang="ts">
	import { HoverCard, HoverCardContent, HoverCardTrigger } from "$lib/components/ui/hover-card";
	import { Button } from "$lib/components/ui/button";
</script>

<HoverCard>
	<HoverCardTrigger>
		<Button type="button" variant="link" size="sm" class="h-auto p-0">悬停查看</Button>
	</HoverCardTrigger>
	<HoverCardContent>
		<div class="text-xs">
			<p class="font-medium">提示标题</p>
			<p class="text-muted-foreground">这是 Hover Card 的内容区域。</p>
		</div>
	</HoverCardContent>
</HoverCard>