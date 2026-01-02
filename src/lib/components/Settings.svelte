<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { RiSettings3Line } from "svelte-remixicon";
	import { buttonVariants } from "./ui/button";
</script>

<Dialog.Root>
	<Dialog.Trigger class="{buttonVariants({ variant: 'outline' })} h-20! border-t-0 border-r-0 p-6!">
		<RiSettings3Line class="shape-crisp h-8! w-8!" />
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Settings</Dialog.Title>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
