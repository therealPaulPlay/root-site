<script>
	import { Slider as SliderPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		value = $bindable(),
		orientation = "horizontal",
		class: className,
		...restProps
	} = $props();
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<SliderPrimitive.Root
	bind:ref
	bind:value
	data-slot="slider"
	{orientation}
	class={cn(
		"relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
		className
	)}
	{...restProps}
>
	{#snippet children({ thumbItems })}
		<span
			data-slot="slider-track"
			data-orientation={orientation}
			class={cn(
				"relative grow overflow-hidden bg-muted bg-muted data-horizontal:h-2 data-horizontal:w-full data-horizontal:w-full data-vertical:h-full data-vertical:h-full data-vertical:w-2"
			)}
		>
			<SliderPrimitive.Range
				data-slot="slider-range"
				class={cn(
					"absolute bg-primary transition-all duration-150 select-none data-horizontal:h-full data-vertical:w-full"
				)}
			/>
		</span>
		{#each thumbItems as thumb (thumb.index)}
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				index={thumb.index}
				class="relative block size-4 shrink-0 border-ring bg-background ring-ring/50 transition-all duration-150 select-none not-dark:border after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50 dark:bg-foreground"
			/>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
