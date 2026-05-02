<script lang="ts">
	import { link } from "svelte-spa-router";
	import ShowcasePage from "$lib/features/showcase/ShowcasePage.svelte";
</script>

<div class="bg-background text-foreground min-h-dvh">
	<header
		class="border-border bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-20 border-b backdrop-blur-md"
	>
		<div
			class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4"
		>
			<div class="flex min-w-0 flex-col gap-0">
				<h1 class="truncate text-sm font-semibold tracking-tight">组件展示</h1>
				<p class="text-muted-foreground text-[11px] leading-tight">$lib/components/ui · v1</p>
			</div>
			<nav class="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
				<a href="/" use:link class="text-primary hover:underline">首页</a>
				<span class="text-border" aria-hidden="true">|</span>
				<a href="/about" use:link class="text-primary hover:underline">About</a>
				<span class="text-border" aria-hidden="true">|</span>
				<span class="text-foreground font-medium" aria-current="page">Demo</span>
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-5">
		<ShowcasePage />
	</main>
</div>
