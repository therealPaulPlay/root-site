<script>
	import emblaCarouselSvelte from "embla-carousel-svelte";
	import { getEmblaContext } from "./context.js";
	import { cn } from "$lib/utils.js";

	let { ref = $bindable(null), class: className, children, ...restProps } = $props();

	const emblaCtx = getEmblaContext("<Carousel.Content/>");
</script>

<div
	data-slot="carousel-content"
	class="overflow-hidden sm:mask-x-from-97% mask-x-from-93% mask-x-to-100% px-10 sm:px-6 gap-4"
	use:emblaCarouselSvelte={{
		options: {
			container: "[data-embla-container]",
			slides: "[data-embla-slide]",
			...emblaCtx.options,
			axis: emblaCtx.orientation === "horizontal" ? "x" : "y"
		},
		plugins: emblaCtx.plugins
	}}
	onemblaInit={emblaCtx.onInit}
>
	<div
		bind:this={ref}
		class={cn("flex", emblaCtx.orientation === "horizontal" ? "" : "flex-col", className)}
		data-embla-container=""
		{...restProps}
	>
		{@render children?.()}
	</div>
</div>
