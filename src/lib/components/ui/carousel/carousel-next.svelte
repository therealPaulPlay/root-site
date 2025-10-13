<script>
	import { getEmblaContext } from "./context.js";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { RiArrowRightLine } from "svelte-remixicon";

	let { ref = $bindable(null), class: className, variant = "outline", size = "icon", ...restProps } = $props();

	const emblaCtx = getEmblaContext("<Carousel.Next/>");
</script>

<Button
	data-slot="carousel-next"
	{variant}
	{size}
	aria-disabled={!emblaCtx.canScrollNext}
	class={cn(
		"absolute flex size-8 justify-center",
		emblaCtx.orientation === "horizontal"
			? "top-1/2 -right-12 -translate-y-1/2"
			: "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
		className
	)}
	onclick={emblaCtx.scrollNext}
	onkeydown={emblaCtx.handleKeyDown}
	bind:ref
	{...restProps}
>
	<RiArrowRightLine class="size-4" />
	<span class="sr-only">Next slide</span>
</Button>
