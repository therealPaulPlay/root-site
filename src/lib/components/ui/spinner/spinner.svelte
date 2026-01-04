<script>
	import { cn } from "$lib/utils.js";
	import { RiLoader4Line } from "svelte-remixicon";
	let { class: className, ...restProps } = $props();
</script>

<RiLoader4Line role="status" aria-label="Loading" class={cn("size-4 animate-spin", className)} {...restProps} />
