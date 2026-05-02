<script lang="ts">
	import { ChartContainer, ChartTooltip } from "$lib/components/ui/chart";
	import type { ChartConfig } from "$lib/components/ui/chart/chart-utils";

	const chartConfig = {
		desktop: { label: "桌面端", color: "hsl(var(--chart-1))" },
		mobile: { label: "移动端", color: "hsl(var(--chart-2))" },
	} satisfies ChartConfig;
</script>

<ChartContainer config={chartConfig} class="max-w-sm text-xs">
	<ChartTooltip />
	<div class="text-muted-foreground">图表组件（需配合 Recharts 使用）</div>
</ChartContainer>