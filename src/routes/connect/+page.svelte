<script>
	import Button from "$lib/components/ui/button/button.svelte";
	import { RiAddLargeLine } from "svelte-remixicon";
</script>

<svelte:head>
	<title>ROOT Connect</title>
	<meta name="description" content="Connect and interface with your Root device." />
</svelte:head>

<div class="pointer-events-none absolute top-0 right-0 max-sm:right-20 text-xl max-sm:fixed">
	<Button
		class="pointer-events-auto h-20! border-t-0 border-r-0 p-6!"
		variant="outline"
		href="/connect/add"
	>
		<RiAddLargeLine class="shape-crisp h-8! w-8!" />
	</Button>
</div>

<div class="flex min-h-screen w-full items-center justify-center">
	<p class="text-center">No devices connected.</p>
</div>
