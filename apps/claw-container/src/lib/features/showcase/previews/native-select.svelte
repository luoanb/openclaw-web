<script lang="ts">
	import { NativeSelect, NativeSelectOption } from "$lib/components/ui/native-select";

	let value = $state("");
</script>

<div class="max-w-xs">
	<NativeSelect bind:value>
		<NativeSelectOption value="">请选择</NativeSelectOption>
		<NativeSelectOption value="a">选项 A</NativeSelectOption>
		<NativeSelectOption value="b">选项 B</NativeSelectOption>
		<NativeSelectOption value="c">选项 C</NativeSelectOption>
	</NativeSelect>
</div>