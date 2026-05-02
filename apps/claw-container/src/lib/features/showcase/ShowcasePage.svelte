<script lang="ts">
	import { SHOWCASE_ENTRIES, LIVE_PREVIEW_SLUGS } from "./showcase-registry";
	import ShowcaseLiveBlock from "./ShowcaseLiveBlock.svelte";
	import ShowcasePlaceholder from "./ShowcasePlaceholder.svelte";
</script>

<div class="space-y-5">
	{#each SHOWCASE_ENTRIES as entry (entry.slug)}
		<section
			id="showcase-{entry.slug}"
			class="scroll-mt-16 border-border border-b pb-5 last:border-0 last:pb-0"
		>
			<div class="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
				<h2 class="text-foreground text-sm font-semibold tracking-tight">{entry.title}</h2>
				<code
					class="text-muted-foreground max-w-[min(100%,20rem)] truncate text-right font-mono text-[11px] leading-none"
					title={`$lib/components/ui/${entry.slug}`}
				>$lib/components/ui/{entry.slug}</code>
			</div>
			<div class="bg-muted/25 border-border rounded-md border p-2.5 sm:p-3">
				{#if LIVE_PREVIEW_SLUGS.has(entry.slug)}
					<ShowcaseLiveBlock slug={entry.slug} />
				{:else}
					<ShowcasePlaceholder libPath={`$lib/components/ui/${entry.slug}`} />
				{/if}
			</div>
		</section>
	{/each}
</div>
