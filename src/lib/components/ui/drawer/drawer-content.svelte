<script>
	import { Drawer as DrawerPrimitive } from "vaul-svelte";
	import DrawerPortal from "./drawer-portal.svelte";
	import DrawerOverlay from "./drawer-overlay.svelte";
	import { cn } from "$lib/utils.js";
	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		showHandle = true,
		children,
		...restProps
	} = $props();
</script>

<DrawerPortal {...portalProps}>
	<DrawerOverlay />
	<DrawerPrimitive.Content
		bind:ref
		data-slot="drawer-content"
		class={cn("bg-background absolute inset-x-0 top-0 z-50 flex flex-col overflow-hidden text-sm", className)}
		{...restProps}
	>
		{#if showHandle}
			<div
				class="bg-muted mx-auto mt-4 hidden h-1 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block"
			></div>
		{/if}
		{@render children?.()}
	</DrawerPrimitive.Content>
</DrawerPortal>