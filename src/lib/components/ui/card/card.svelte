<script>
	import { cn } from "$lib/utils.js";

	let { ref = $bindable(null), class: className, children, ...restProps } = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	class={cn("flex flex-1 flex-col gap-6 border bg-card py-6 text-card-foreground", className)}
	{...restProps}
>
	{@render children?.()}
</div>
