<script lang="ts">
	import { Calendar } from "$lib/components/ui/calendar";
	import { today, getLocalTimeZone } from "@internationalized/date";

	let placeholder = $state(today(getLocalTimeZone()));
</script>

<div class="max-w-md rounded-md border p-4">
	<Calendar bind:placeholder type="single" />
</div>