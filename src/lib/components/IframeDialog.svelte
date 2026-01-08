<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { buttonVariants } from "./ui/button";
	let { children, title = "Default", src = "/" } = $props();
</script>

<Dialog.Root>
	<Dialog.Trigger class={buttonVariants({ variant: "outline" })}>
		{@render children?.()}
	</Dialog.Trigger>
	<Dialog.Content class="h-[calc(100%-2rem)] flex flex-col pt-12">
		<iframe frameborder="0" class="grow w-full border" src={src + "?hide-navbar=true"} {title}> </iframe>
	</Dialog.Content>
</Dialog.Root>
