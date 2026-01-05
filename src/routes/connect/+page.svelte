<script>
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { getAllProducts, saveProduct } from "$lib/utils/pairedProductsStorage";
	import { RelayComm, RELAY_REQUEST_TIMEOUT } from "$lib/utils/relaycomm";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
	import { error } from "@sveltejs/kit";
	import { onDestroy, onMount } from "svelte";
	import {
		RiArrowRightSLine,
		RiEdit2Line,
		RiErrorWarningLine,
		RiSettings3Line,
		RiVideoAddLine
	} from "svelte-remixicon";
	import { toast } from "svelte-sonner";
	import Label from "$lib/components/ui/label/label.svelte";

	let products = $state([]);
	let relayCommInstance;

	let previewTimeoutOver = $state(false);
	let previewTimeout;
	let previewImages = $state({});

	let renameDialogOpen = $state({});
	let idForProductVisible = $state();
	let renameValue = $state({});

	onMount(async () => {
		const relayDomain = localStorage.getItem("relayDomain") || DEFAULT_RELAY_DOMAIN;
		products = getAllProducts();

		// If the user has products, connect to relay
		if (products.length) {
			try {
				const deviceId = localStorage.getItem("deviceId");
				if (!deviceId) throw new Error("No device ID set! Cannot connect to relay.");
				relayCommInstance = new RelayComm(relayDomain, localStorage.getItem("deviceId"));
				await relayCommInstance.connect();

				products.forEach((p) => {
					relayCommInstance.send(p.id, "getPreview").catch((error) => {
						console.error(`Failed to send message for product ${p.id}:`, error);
					});
				});

				relayCommInstance.on("getPreviewResult", (msg) => {
					if (!msg.payload.success) {
						const error = `${msg.type} failed for product ${msg.productId}: ${msg.payload.error || "Unknown error"}`;
						toast.error(error);
						console.error(error);
						return;
					}
					previewImages[msg.productId] = msg.payload.image;
				});

				previewTimeout = setTimeout(() => {
					previewTimeoutOver = true;
					previewTimeout = null;
				}, RELAY_REQUEST_TIMEOUT);
			} catch (error) {
				console.error("Error connecting to relay and getting data from products:", error);
			}
		}
	});

	onDestroy(() => {
		if (relayCommInstance) relayCommInstance.disconnect();
		if (previewTimeout) clearTimeout(previewTimeout);
	});

	function handleRename(product) {
		const newName = renameValue[product.id]?.trim();
		if (!newName) {
			toast.error("Product name cannot be empty");
			return;
		}

		try {
			const updatedProduct = { ...product, name: newName };
			saveProduct(updatedProduct);

			// Update local products array
			const index = products.findIndex((p) => p.id === product.id);
			if (index >= 0) products[index] = updatedProduct;

			renameDialogOpen[product.id] = false;
		} catch (error) {
			toast.error(`Failed to rename product: ${error.message}`);
			console.error("Error renaming product:", error);
		}
	}
</script>

<svelte:head>
	<title>ROOT Connect</title>
	<meta name="description" content="Connect and interface with your Root device." />
</svelte:head>

<div class="absolute top-0 right-0 flex text-xl bg-background z-1">
	<Button class="h-20! border-t-0 border-r-0 p-6!" variant="outline" href="/connect/settings">
		<RiSettings3Line class="h-8! w-8!" />
	</Button>
	<Button class="h-20! border-t-0 border-r-0 p-6!" variant="outline" href="/connect/add">
		<RiVideoAddLine class="h-8! w-8!" />
	</Button>
</div>

{#snippet productItem(product)}
	{@const dialogOpen = renameDialogOpen[product.id] ?? false}
	<div class="relative flex h-fit min-h-32 shrink-0 w-full border-y max-md:flex-wrap">
		<!-- preview image -->
		<div
			class="aspect-16/9 w-full content-center bg-foreground text-center text-background max-md:border-b md:w-1/3 md:border-r"
		>
			<!-- todo -->
			{#if !previewImages[product.id]}
				{#if !previewTimeoutOver}
					<Spinner class="mx-auto size-8" />
				{:else}
					<RiErrorWarningLine class="mx-auto size-8" />
				{/if}
			{:else}
				<img
					alt="preview"
					class="h-full w-full object-cover"
					src={"data:image/jpg;base64," + previewImages[product.id]}
				/>
			{/if}
		</div>
		<div class="flex grow overflow-hidden">
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="flex grow flex-col overflow-hidden p-4" class:opacity-50={!previewImages[product.id]}>
				<span class="inline-flex items-center gap-1 overflow-hidden text-nowrap"
					><h3 class="truncate font-display text-xl font-medium tracking-wide">{product.name}</h3>
					<Dialog.Root
						open={dialogOpen}
						onOpenChange={(open) => {
							renameDialogOpen[product.id] = open;
						}}
					>
						<Dialog.Trigger
							class="{buttonVariants({ variant: 'ghost' })} h-fit! px-2!"
							onclick={() => {
								renameValue[product.id] = product.name;
							}}
						>
							<RiEdit2Line />
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Header>
								<Dialog.Title>Rename "{product.name}"</Dialog.Title>
							</Dialog.Header>
							<div class="flex flex-col gap-4">
								<div class="space-y-1">
									<Label for="product-name" class="text-sm font-medium">Name</Label>
									<Input
										type="text"
										id="product-name"
										bind:value={renameValue[product.id]}
										placeholder="New name"
										onkeydown={(e) => {
											if (e.key === "Enter") handleRename(product);
										}}
									/>
								</div>
								<div class="flex justify-end gap-2">
									<Button onclick={() => handleRename(product)}>Set name</Button>
								</div>
							</div>
						</Dialog.Content>
					</Dialog.Root>
				</span>
				<p class="text-muted-forerground mb-4 text-sm uppercase">{product.model}</p>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<p
					class="mt-auto overflow-hidden text-xs text-nowrap text-neutral-300 hover:truncate w-fit max-w-full"
					onclick={() => (idForProductVisible = product.id)}
					onmouseenter={() => (idForProductVisible = product.id)}
					onmouseleave={() => (idForProductVisible = null)}
				>
					ID: <span class="{idForProductVisible == product.id ? '' : 'bg-neutral-300/35 text-transparent'}"
						>{product.id}</span
					>
				</p>
			</div>
			<div class="h-full border-l">
				<Button
					variant="ghost"
					class="h-full {!previewImages[product.id] ? 'opacity-50' : ''}"
					href={"/connect/product/" + product.id}><RiArrowRightSLine class="h-8! w-8!" /></Button
				>
			</div>
		</div>
	</div>
{/snippet}

<div class="of-top of-bottom flex h-screen w-full flex-col items-center justify-start gap-8 overflow-y-auto py-30">
	{#if products.length}
		{#each products as product}
			{@render productItem(product)}
		{/each}
	{:else}
		<p class="my-auto truncate text-center">No cameras connected.</p>
	{/if}
</div>
