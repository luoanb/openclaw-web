<script lang="ts">
	import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "$lib/components/ui/menubar";
	import { Button } from "$lib/components/ui/button";
</script>

<Menubar>
	<MenubarMenu>
		<MenubarTrigger>文件</MenubarTrigger>
		<MenubarContent>
			<MenubarItem>新建</MenubarItem>
			<MenubarItem>打开</MenubarItem>
			<MenubarSeparator />
			<MenubarItem>保存</MenubarItem>
		</MenubarContent>
	</MenubarMenu>
	<MenubarMenu>
		<MenubarTrigger>编辑</MenubarTrigger>
		<MenubarContent>
			<MenubarItem>撤销</MenubarItem>
			<MenubarItem>重做</MenubarItem>
		</MenubarContent>
	</MenubarMenu>
</Menubar>