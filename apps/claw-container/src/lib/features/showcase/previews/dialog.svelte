<script lang="ts">
	import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "$lib/components/ui/dialog";
	import { Button } from "$lib/components/ui/button";
</script>

<Dialog>
	<DialogTrigger>
		<Button type="button" variant="outline">打开对话框</Button>
	</DialogTrigger>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>对话框标题</DialogTitle>
			<DialogDescription>这是对话框的描述文字，说明当前操作的内容。</DialogDescription>
		</DialogHeader>
		<div class="text-muted-foreground py-2 text-xs">对话框内容区域</div>
		<DialogFooter>
			<DialogClose>
				<Button type="button" variant="outline" size="sm">取消</Button>
			</DialogClose>
			<Button type="button" size="sm">确认</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>