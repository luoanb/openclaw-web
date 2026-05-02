<script lang="ts">
	let { libPath }: { libPath: string } = $props();
</script>

<p class="text-muted-foreground text-xs leading-snug">
	预览待补充。请从
	<code class="bg-muted text-foreground rounded px-1 py-px font-mono text-[11px]">{libPath}</code>
	按需引入并组合子组件。
</p>
