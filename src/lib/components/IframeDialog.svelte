<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { buttonVariants } from "./ui/button";

	let { children, src = "/", variant = "outline", class: classes } = $props();

	let iframeLoaded = $state(false);
	let open = $state(false);
	let showFade = $state(true);

	$effect(() => {
		if (open && iframeLoaded) setTimeout(() => (showFade = false), 150);
		else showFade = true;
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={`${variant ? buttonVariants({ variant: variant }) : ""} ${classes}`}>
		{@render children?.()}
	</Dialog.Trigger>
	<Dialog.Content class="flex h-[calc(100svh-7.5rem)] flex-col overflow-hidden p-0">
		<div class="absolute top-0 right-0 z-50 size-14 border-b border-l bg-background"></div>
		<div
			class="pointer-events-none absolute inset-0 h-full w-full bg-background transition"
			class:opacity-0={!showFade}
		></div>
		<iframe
			frameborder="0"
			onload={() => (iframeLoaded = true)}
			class="-z-1 h-full w-full"
			src={src + "?hide-navbar=true&hide-footer=true"}
			title="web page"
		>
		</iframe>
	</Dialog.Content>
</Dialog.Root>
