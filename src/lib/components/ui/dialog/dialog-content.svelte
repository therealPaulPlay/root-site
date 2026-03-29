<script>
	import { Dialog as DialogPrimitive } from "bits-ui";
	import * as Dialog from "./index.js";
	import { cn } from "$lib/utils.js";
	import { RiCloseLine } from "svelte-remixicon";

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		children,
		showCloseButton = true,
		onInteractOutside,
		...restProps
	} = $props();

	function handleInteractOutside(e) {
		if (e.target?.closest("[data-sonner-toaster]")) e.preventDefault();
		onInteractOutside?.(e);
	}
</script>

<Dialog.Portal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		onInteractOutside={handleInteractOutside}
		class={cn(
			"fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close
				class="absolute end-0 top-0 z-100 p-4 opacity-70 hover:opacity-100 focus:outline-hidden active:opacity-100 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6"
			>
				<RiCloseLine />
				<span class="sr-only">Close</span>
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</Dialog.Portal>
