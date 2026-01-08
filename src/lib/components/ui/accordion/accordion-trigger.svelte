<script>
	import { Accordion as AccordionPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { RiArrowDownSLine } from "svelte-remixicon";

	let {
		ref = $bindable(null),
		class: className,
		level = 3,
		children,
		...restProps
	} = $props();
</script>

<AccordionPrimitive.Header {level} class="flex">
	<AccordionPrimitive.Trigger
		data-slot="accordion-trigger"
		bind:ref
		class={cn(
			"focus-visible:border-ring uppercase focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-start text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		<RiArrowDownSLine
			class="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200"
		/>
	</AccordionPrimitive.Trigger>
</AccordionPrimitive.Header>