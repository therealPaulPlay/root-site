<script>
	import { Drawer as DrawerPrimitive } from "@paulplay/vaul-svelte";
	import { cn } from "$lib/utils.js";

	let { ref = $bindable(null), class: className, ...restProps } = $props();

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

<!-- Renders with height 0, purely used to sync its opacity to the div below-->
<!-- In normal shadcn this gets classes to make it the visual overlay, but since its in the wrong stacking context we can't use it for backdrop blur (smeary) -->
<DrawerPrimitive.Overlay bind:ref={proxyEl} {...restProps} />

{#if proxyEl}
	<div
		bind:this={ref}
		data-slot="drawer-overlay"
		class={cn("safe-h-svh absolute inset-x-0 top-0 z-50 touch-none overscroll-none", className)}
		style:background="rgb(0 0 0 / {opacity * 0.5})"
		style:backdrop-filter="blur({opacity * 4}px)"
	></div>
{/if}
