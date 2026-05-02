<script lang="ts">
	import { Toaster } from "$lib/components/ui/sonner";
	import { toast } from "svelte-sonner";
	import { Button } from "$lib/components/ui/button";
</script>

<div class="flex flex-wrap gap-2">
	<Button type="button" variant="outline" size="sm" onclick={() => toast("这是一条通知消息")}>显示 Toast</Button>
	<Button type="button" variant="outline" size="sm" onclick={() => toast.success("操作成功")}>成功提示</Button>
	<Button type="button" variant="outline" size="sm" onclick={() => toast.error("操作失败")}>错误提示</Button>
</div>
<Toaster />