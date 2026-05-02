<script lang="ts">
	import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "$lib/components/ui/carousel";
</script>

<Carousel class="max-w-md">
	<CarouselContent>
		<CarouselItem class="basis-1/3"><div class="bg-muted flex h-24 items-center justify-center rounded-md text-xs">项目 1</div></CarouselItem>
		<CarouselItem class="basis-1/3"><div class="bg-muted flex h-24 items-center justify-center rounded-md text-xs">项目 2</div></CarouselItem>
		<CarouselItem class="basis-1/3"><div class="bg-muted flex h-24 items-center justify-center rounded-md text-xs">项目 3</div></CarouselItem>
	</CarouselContent>
	<CarouselPrevious />
	<CarouselNext />
</Carousel>