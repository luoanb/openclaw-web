<script lang="ts">
	import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "$lib/components/ui/input-group";
	import { Button } from "$lib/components/ui/button";
</script>

<div class="flex flex-col gap-2">
	<InputGroup>
		<InputGroupAddon>https://</InputGroupAddon>
		<InputGroupInput placeholder="example.com" />
	</InputGroup>
	<InputGroup>
		<InputGroupInput placeholder="搜索..." />
		<InputGroupButton>
			<Button type="button" size="sm">搜索</Button>
		</InputGroupButton>
	</InputGroup>
</div>