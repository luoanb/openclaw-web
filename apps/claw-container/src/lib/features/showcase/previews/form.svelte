<script lang="ts">
	import { FormLabel } from "$lib/components/ui/form";
	import { Input } from "$lib/components/ui/input";
	import { Button } from "$lib/components/ui/button";

	let email = $state("");
</script>

<div class="max-w-sm space-y-4">
	<div class="space-y-2">
		<FormLabel for="form-email">邮箱</FormLabel>
		<Input id="form-email" type="email" bind:value={email} placeholder="example@domain.com" />
	</div>
	<Button type="submit" size="sm">提交</Button>
</div>