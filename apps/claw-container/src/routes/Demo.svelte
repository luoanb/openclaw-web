<script lang="ts">
	import { link } from "svelte-spa-router";
	import ShowcasePage from "$lib/features/showcase/ShowcasePage.svelte";
</script>

<div class="bg-background text-foreground min-h-dvh">
	<header
		class="border-border bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-20 border-b backdrop-blur-md"
	>
		<div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div class="flex min-w-0 flex-col gap-0.5">
				<h1 class="truncate text-base font-semibold tracking-tight">组件展示</h1>
				<p class="text-muted-foreground text-xs">$lib/components/ui 预览与占位（v1）</p>
			</div>
			<nav class="flex flex-wrap items-center gap-3 text-sm">
				<a href="/" use:link class="text-primary hover:underline">首页</a>
				<a href="/about" use:link class="text-primary hover:underline">About</a>
				<span class="text-muted-foreground" aria-current="page">Demo</span>
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-4xl px-4 py-8">
		<ShowcasePage />
	</main>
</div>
