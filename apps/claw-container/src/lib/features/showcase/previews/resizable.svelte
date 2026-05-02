<script lang="ts">
	import { ResizablePaneGroup, ResizablePane, ResizableHandle } from "$lib/components/ui/resizable";
</script>

<ResizablePaneGroup direction="horizontal" class="min-h-32 max-w-md">
	<ResizablePane defaultSize={50}>
		<div class="bg-muted flex h-full items-center justify-center rounded-l-md text-xs">左侧面板</div>
	</ResizablePane>
	<ResizableHandle />
	<ResizablePane defaultSize={50}>
		<div class="bg-muted flex h-full items-center justify-center rounded-r-md text-xs">右侧面板</div>
	</ResizablePane>
</ResizablePaneGroup>