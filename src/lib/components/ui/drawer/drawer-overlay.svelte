<script>
	import { Drawer as DrawerPrimitive } from "vaul-svelte";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	} = $props();

	// backdrop-filter + element opacity < 1 causes smearing
	// Vaul controls a hidden proxy's opacity; we read it and apply as background alpha + blur
	let proxyEl = $state(null);
	let opacity = $state(0);

	$effect(() => {
		if (!proxyEl) return;
		let frame;
		function sync() {
			opacity = parseFloat(getComputedStyle(proxyEl).opacity);
			frame = requestAnimationFrame(sync);
		}
		frame = requestAnimationFrame(sync);
		return () => cancelAnimationFrame(frame);
	});
</script>

<!-- Hidden proxy that vaul controls -->
<DrawerPrimitive.Overlay
	bind:ref={proxyEl}
	class="pointer-events-none fixed invisible"
	{...restProps}
/>

<!-- Visible overlay — no element opacity, blur stays clean -->
<div
	bind:this={ref}
	data-slot="drawer-overlay"
	class={cn("absolute inset-x-0 top-0 safe-h-svh z-50", className)}
	style:background="rgb(0 0 0 / {opacity * 0.5})"
	style:backdrop-filter="blur({opacity * 4}px)"
></div>