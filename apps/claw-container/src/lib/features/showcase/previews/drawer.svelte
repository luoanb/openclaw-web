<script lang="ts">
	import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose, DrawerTrigger } from "$lib/components/ui/drawer";
	import { Button } from "$lib/components/ui/button";
</script>

<Drawer>
	<DrawerTrigger>
		<Button type="button" variant="outline">打开抽屉</Button>
	</DrawerTrigger>
	<DrawerContent>
		<DrawerHeader>
			<DrawerTitle>抽屉标题</DrawerTitle>
			<DrawerDescription>抽屉描述内容。</DrawerDescription>
		</DrawerHeader>
		<div class="text-muted-foreground p-4 text-xs">抽屉内容区域</div>
		<DrawerFooter>
			<DrawerClose>
				<Button type="button" variant="outline" size="sm">取消</Button>
			</DrawerClose>
			<Button type="button" size="sm">确认</Button>
		</DrawerFooter>
	</DrawerContent>
</Drawer>