<script>
	import Button from "$lib/components/ui/button/button.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { getAllProducts } from "$lib/utils/pairedProductsStorage";
	import { onMount } from "svelte";
	import { RiAddLargeLine, RiArrowRightSLine, RiEdit2Line } from "svelte-remixicon";

	let products = [];

	onMount(() => {
		products = getAllProducts();
	});
</script>

<svelte:head>
	<title>ROOT Connect</title>
	<meta name="description" content="Connect and interface with your Root device." />
</svelte:head>

<div class="pointer-events-none absolute top-0 right-0 text-xl">
	<Button class="pointer-events-auto h-20! border-t-0 border-r-0 p-6!" variant="outline" href="/connect/add">
		<RiAddLargeLine class="shape-crisp h-8! w-8!" />
	</Button>
</div>

{#snippet productItem(product)}
	<div class="relative flex h-32 w-full overflow-hidden border-y">
		<!-- preview image -->
		<div class="h-full w-1/3 content-center bg-foreground text-center text-background">
			<!-- todo -->
			<Spinner class="mx-auto size-8" />
		</div>
		<div class="flex grow flex-col overflow-hidden p-4">
			<span class="inline-flex items-center gap-1 overflow-hidden text-nowrap"
				><h3 class="truncate font-display text-xl font-medium tracking-wide">{product.name}</h3>
				<Button variant="ghost" class="h-fit! px-2"><RiEdit2Line /></Button>
			</span>
			<p class="text-muted-forerground text-sm uppercase">{product.type}</p>
			<p class="text-muted-forerground mt-auto text-xs opacity-25">ID: {product.id}</p>
		</div>
		<div class="h-full border-l">
			<Button variant="ghost" class="h-full"><RiArrowRightSLine class="h-8! w-8!" /></Button>
		</div>
	</div>
{/snippet}

<div class="flex min-h-screen w-full flex-col items-center justify-start gap-8 py-30">
	{#if products.length}
		{#each products as product}
			{@render productItem(product)}
		{/each}
	{:else}
		<p class="text-center">No devices connected.</p>
	{/if}
</div>
