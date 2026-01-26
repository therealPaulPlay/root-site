<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { buttonVariants } from "./ui/button";

	let { children, src = "/", variant = "outline", class: classes } = $props();

	let iframeLoaded = $state(false);
</script>

<Dialog.Root>
	<Dialog.Trigger class={`${variant ? buttonVariants({ variant: variant }) : ""} ${classes}`}>
		{@render children?.()}
	</Dialog.Trigger>
	<Dialog.Content class="flex h-[calc(100svh-7.5rem)] flex-col overflow-hidden pt-12">
		<div class="relative w-full grow border">
			<div
				class="pointer-events-none absolute inset-0 h-full w-full bg-neutral-300 transition"
				class:opacity-0={iframeLoaded}
				class:animate-pulse={!iframeLoaded}
			></div>
			<iframe
				frameborder="0"
				class:opacity-0={!iframeLoaded}
				onload={() => (iframeLoaded = true)}
				class="h-full w-full transition"
				src={src + "?hide-navbar=true&hide-footer=true"}
				title="web page"
			>
			</iframe>
		</div>
	</Dialog.Content>
</Dialog.Root>
