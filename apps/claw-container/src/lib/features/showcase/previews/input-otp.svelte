<script lang="ts">
	import { InputOTP } from "$lib/components/ui/input-otp";

	let value = $state("");
</script>

<div class="flex flex-col gap-2">
	<InputOTP maxlength={6} bind:value class="justify-center gap-2" />
	<p class="text-muted-foreground text-center text-xs">输入验证码：{value || "______"}</p>
</div>