<script lang="ts">
	import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "$lib/components/ui/command";
	import { Button } from "$lib/components/ui/button";

	let open = $state(false);
</script>

<Button type="button" variant="outline" onclick={() => (open = !open)}>打开命令面板</Button>
<CommandDialog bind:open>
	<CommandInput placeholder="输入命令搜索..." />
	<CommandList>
		<CommandEmpty>无匹配结果</CommandEmpty>
		<CommandGroup heading="操作">
			<CommandItem>新建文件</CommandItem>
			<CommandItem>打开设置</CommandItem>
		</CommandGroup>
		<CommandSeparator />
		<CommandGroup heading="其他">
			<CommandItem>帮助</CommandItem>
		</CommandGroup>
	</CommandList>
</CommandDialog>