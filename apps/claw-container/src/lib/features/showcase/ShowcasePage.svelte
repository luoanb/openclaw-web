<script lang="ts">
	import { SHOWCASE_ENTRIES, LIVE_PREVIEW_SLUGS } from "./showcase-registry";
	import ShowcaseLiveBlock from "./ShowcaseLiveBlock.svelte";
	import ShowcasePlaceholder from "./ShowcasePlaceholder.svelte";
</script>

<div class="space-y-14">
	{#each SHOWCASE_ENTRIES as entry (entry.slug)}
		<section
			id="showcase-{entry.slug}"
			class="scroll-mt-28 border-border border-b pb-12 last:border-0 last:pb-0"
		>
			<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-foreground text-lg font-semibold tracking-tight">{entry.title}</h2>
				<code class="text-muted-foreground max-w-full truncate font-mono text-xs">
					$lib/components/ui/{entry.slug}
				</code>
			</div>
			<div class="bg-muted/30 border-border rounded-2xl border p-4 md:p-6">
				{#if LIVE_PREVIEW_SLUGS.has(entry.slug)}
					<ShowcaseLiveBlock slug={entry.slug} />
				{:else}
					<ShowcasePlaceholder libPath={`$lib/components/ui/${entry.slug}`} />
				{/if}
			</div>
		</section>
	{/each}
</div>
