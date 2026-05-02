<script lang="ts">
	import { RangeCalendar } from "$lib/components/ui/range-calendar";
	import { today, getLocalTimeZone } from "@internationalized/date";

	let value = $state({ start: today(getLocalTimeZone()), end: today(getLocalTimeZone()).add({ weeks: 1 }) });
</script>

<RangeCalendar bind:value class="max-w-md rounded-md border" />