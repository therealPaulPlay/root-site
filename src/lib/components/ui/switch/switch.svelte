<script>
	import { Switch as SwitchPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { vibrate } from "$lib/utils/haptics";

	let { ref = $bindable(null), class: className, checked = $bindable(false), onCheckedChange, ...restProps } = $props();
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	class={cn(
		"peer inline-flex h-7 w-14 shrink-0 items-center border transition-all duration-150 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-accent",
		className
	)}
	onCheckedChange={() => {
		vibrate.light();
		onCheckedChange();
	}}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class={cn(
			"pointer-events-none block size-7 border ring-0 transition-transform duration-150 data-[state=checked]:translate-x-[calc(100%-1px)] data-[state=unchecked]:translate-x-[-1px] bg-background"
		)}
	/>
</SwitchPrimitive.Root>
