<script>
	import { Drawer as DrawerPrimitive } from "@paulplay/vaul-svelte";
	import DrawerPortal from "./drawer-portal.svelte";
	import DrawerOverlay from "./drawer-overlay.svelte";
	import { cn } from "$lib/utils.js";
	let { ref = $bindable(null), class: className, portalProps, showHandle = true, children, ...restProps } = $props();

	let bounds = $state("");
	let node = null;

	// Fixed positioning is needed to keep the drawer stuck to the lower screen edge when scrolling the page when it's half-open or animating
	// However since it spans the full width and we only want it to appear inside its container, we update its width dynamically (kinda hacky..)
	function syncBounds() {
		const container = node?.parentElement;
		if (!container) return;
		const left = container.getBoundingClientRect().left + container.clientLeft;
		bounds = `left: ${left}px; width: ${container.clientWidth}px; right: auto;`;
	}

	// Attach captures the DOM node directly on mount, avoiding a reactive read of bits-ui's ref that warns on teardown
	function positionInContainer(el) {
		node = el;
		syncBounds();
		return () => (node = null);
	}
</script>

<svelte:window onresize={syncBounds} />

<DrawerPortal {...portalProps}>
	<DrawerOverlay />
	<DrawerPrimitive.Content
		bind:ref
		data-slot="drawer-content"
		class={cn("fixed top-[var(--safe-area-top)] z-50 flex flex-col overflow-hidden bg-background text-sm", className)}
		style={bounds}
		{@attach positionInContainer}
		{...restProps}
	>
		{#if showHandle}
			<div
				class="mx-auto mt-4 hidden h-1 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block"
			></div>
		{/if}
		{@render children?.()}
	</DrawerPrimitive.Content>
</DrawerPortal>
