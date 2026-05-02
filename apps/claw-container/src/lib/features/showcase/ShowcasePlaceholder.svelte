<script lang="ts">
	let { libPath }: { libPath: string } = $props();
</script>

<p class="text-muted-foreground text-sm leading-relaxed">
	预览待补充。请从
	<code class="bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-xs">{libPath}</code>
	按需引入并组合子组件。
</p>
