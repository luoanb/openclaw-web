<script lang="ts">
	import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "$lib/components/ui/sheet";
	import { Button } from "$lib/components/ui/button";
</script>

<Sheet>
	<SheetTrigger>
		<Button type="button" variant="outline">打开侧边栏</Button>
	</SheetTrigger>
	<SheetContent>
		<SheetHeader>
			<SheetTitle>侧边栏标题</SheetTitle>
			<SheetDescription>侧边栏描述内容。</SheetDescription>
		</SheetHeader>
		<div class="text-muted-foreground py-4 text-xs">侧边栏内容区域</div>
		<SheetFooter>
			<SheetClose>
				<Button type="button" variant="outline" size="sm">关闭</Button>
			</SheetClose>
		</SheetFooter>
	</SheetContent>
</Sheet>