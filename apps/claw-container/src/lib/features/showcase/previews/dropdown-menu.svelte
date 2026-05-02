<script lang="ts">
	import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu";
	import { Button } from "$lib/components/ui/button";
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		<Button type="button" variant="outline">打开下拉菜单</Button>
	</DropdownMenuTrigger>
	<DropdownMenuContent>
		<DropdownMenuLabel>操作</DropdownMenuLabel>
		<DropdownMenuItem>新建</DropdownMenuItem>
		<DropdownMenuItem>编辑</DropdownMenuItem>
		<DropdownMenuSeparator />
		<DropdownMenuItem>删除</DropdownMenuItem>
	</DropdownMenuContent>
</DropdownMenu>