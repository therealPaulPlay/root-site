<script>
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";
	import { vibrate } from "$lib/utils/haptics";

	let { ref = $bindable(null), class: className, onclick: execFunc, ...restProps } = $props();
</script>

<AlertDialogPrimitive.Action
	bind:ref
	data-slot="alert-dialog-action"
	class={cn(buttonVariants(), className)}
	onclick={() => {
		vibrate.light();
		execFunc?.();
	}}
	{...restProps}
/>
