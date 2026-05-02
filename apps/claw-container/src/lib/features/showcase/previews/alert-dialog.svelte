<script lang="ts">
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger,
	} from "$lib/components/ui/alert-dialog";
	import { Button } from "$lib/components/ui/button";

	let open = $state(false);
</script>

<AlertDialog bind:open>
	<AlertDialogTrigger>
		<Button type="button" variant="outline">打开对话框</Button>
	</AlertDialogTrigger>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>确认操作</AlertDialogTitle>
			<AlertDialogDescription>这是一个 Alert Dialog 示例，确认后将继续执行操作。</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>取消</AlertDialogCancel>
			<AlertDialogAction>确认</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>