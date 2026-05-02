<script lang="ts">
	import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "$lib/components/ui/empty";
</script>

<Empty>
	<EmptyMedia>
		<div class="bg-muted flex h-16 w-16 items-center justify-center rounded-full text-muted-foreground text-2xl">📭</div>
	</EmptyMedia>
	<EmptyHeader>
		<EmptyTitle>暂无数据</EmptyTitle>
		<EmptyDescription>当前没有可显示的内容，请稍后再试。</EmptyDescription>
	</EmptyHeader>
	<EmptyContent>可在此放置操作按钮</EmptyContent>
</Empty>