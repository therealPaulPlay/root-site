<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { buttonVariants } from "./ui/button";
	let { children, src = "/", variant = "outline", class: classes } = $props();
</script>

<Dialog.Root>
	<Dialog.Trigger class={variant ? buttonVariants({ variant: variant }) : "" + classes ? " " + classes : ""}>
		{@render children?.()}
	</Dialog.Trigger>
	<Dialog.Content class="flex h-[calc(100svh-10rem)] flex-col overflow-hidden pt-12">
		<iframe frameborder="0" class="w-full grow border" src={src + "?hide-navbar=true&hide-footer=true"} title="web page"> </iframe>
	</Dialog.Content>
</Dialog.Root>
