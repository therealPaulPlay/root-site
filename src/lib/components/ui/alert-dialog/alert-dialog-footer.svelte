<script>
	import { cn } from "$lib/utils.js";
	let { ref = $bindable(null), class: className, children, ...restProps } = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-dialog-footer"
	class={cn("mt-4 flex flex-row justify-end gap-2", className)}
	{...restProps}
>
	{@render children?.()}
</div>
