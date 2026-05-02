<script lang="ts">
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
	import { Button } from "$lib/components/ui/button";

	let open = $state(false);
</script>

<Collapsible bind:open>
	<div class="flex flex-col gap-2">
		<CollapsibleTrigger>
			<Button type="button" variant="ghost" size="sm" class="justify-start">{open ? "收起" : "展开"}</Button>
		</CollapsibleTrigger>
		<CollapsibleContent>
			<div class="bg-muted rounded-md p-3 text-xs text-muted-foreground">这是可折叠的内容区域。</div>
		</CollapsibleContent>
	</div>
</Collapsible>