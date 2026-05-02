<script lang="ts">
	import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "$lib/components/ui/context-menu";
	import { Button } from "$lib/components/ui/button";
</script>

<ContextMenu>
	<ContextMenuTrigger>
		<div class="bg-muted flex h-24 w-full max-w-md items-center justify-center rounded-md">
			<span class="text-muted-foreground text-xs">右键此处打开上下文菜单</span>
		</div>
	</ContextMenuTrigger>
	<ContextMenuContent>
		<ContextMenuLabel>操作</ContextMenuLabel>
		<ContextMenuItem>复制</ContextMenuItem>
		<ContextMenuItem>粘贴</ContextMenuItem>
		<ContextMenuSeparator />
		<ContextMenuItem>删除</ContextMenuItem>
	</ContextMenuContent>
</ContextMenu>