<script lang="ts">
	import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationPrevButton, PaginationNextButton } from "$lib/components/ui/pagination";

	let currentPage = $state(1);
</script>

<Pagination count={100} perPage={10} siblingCount={1} page={currentPage}>
	<PaginationContent>
		<PaginationItem>
			<PaginationPrevButton />
		</PaginationItem>
		<PaginationEllipsis />
		<PaginationItem>
			<span class="text-xs">4</span>
		</PaginationItem>
		<PaginationItem>
			<span class="text-xs font-medium">5</span>
		</PaginationItem>
		<PaginationItem>
			<span class="text-xs">6</span>
		</PaginationItem>
		<PaginationEllipsis />
		<PaginationItem>
			<PaginationNextButton />
		</PaginationItem>
	</PaginationContent>
</Pagination>