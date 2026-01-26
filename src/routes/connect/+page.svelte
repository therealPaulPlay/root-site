<script>
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { getAllProducts, removeProduct, saveProduct } from "$lib/utils/pairedProductsStorage";
	import { RelayComm, RELAY_REQUEST_TIMEOUT } from "$lib/utils/relaycomm";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
	import { error } from "@sveltejs/kit";
	import { onDestroy, onMount } from "svelte";
	import {
		RiArrowRightSLine,
		RiDeleteBinLine,
		RiDownload2Line,
		RiEdit2Line,
		RiErrorWarningLine,
		RiSettings3Line,
		RiVideoAddLine
	} from "svelte-remixicon";
	import { toast } from "svelte-sonner";
	import Label from "$lib/components/ui/label/label.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import WebBluetoothUnsupportedDialog from "$lib/components/WebBluetoothUnsupportedDialog.svelte";

	let products = $state([]);
	let relayCommInstance;

	let previewImages = $state({});
	let updateStatuses = $state({});
	let loadedProducts = new Set();
	let previewFailed = $state({});
	let productElements = {};

	let renameDialogOpen = $state({});
	let renameDialogLoading = $state({});
	let removeDialogOpen = $state({});
	let removeDialogLoading = $state({});
	let idForProductVisible = $state();
	let renameValue = $state({});

	function loadProducts() {
		products = getAllProducts();
	}

	let observers = [];

	function loadProductData(productId) {
		if (loadedProducts.has(productId)) return;
		loadedProducts.add(productId);
		relayCommInstance.send(productId, "getPreview").catch((error) => {
			previewFailed[productId] = true;
			console.error(`Failed to get preview for product ${productId}:`, error);
		});
		relayCommInstance.send(productId, "getUpdateStatus").catch((error) => {
			console.error(`Failed to get update status for product ${productId}:`, error);
		});
	}

	function setupObservers() {
		for (const [productId, element] of Object.entries(productElements)) {
			if (!element) continue;
			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) loadProductData(productId);
				},
				{ rootMargin: "100px" }
			);
			observer.observe(element);
			observers.push(observer);
		}
	}

	onMount(async () => {
		const relayDomain = localStorage.getItem("relayDomain") || DEFAULT_RELAY_DOMAIN;
		loadProducts();

		// If the user has products, connect to relay
		if (products.length) {
			try {
				const deviceId = localStorage.getItem("deviceId");
				if (!deviceId) throw new Error("No device ID set! Cannot connect to relay.");
				relayCommInstance = new RelayComm(relayDomain, localStorage.getItem("deviceId"));
				await relayCommInstance.connect();
				setupObservers();

				relayCommInstance.on("getPreviewResult", (msg) => {
					if (!msg.payload.success) {
						previewFailed[msg.productId] = true;
						toast.error(
							`Failed to get preview for product ${msg.productId}: ` + (msg.payload.error || "Unknown error")
						);
						return;
					}
					previewImages[msg.productId] = msg.payload.image;
				});

				relayCommInstance.on("getUpdateStatusResult", (msg) => {
					if (!msg.payload.success) {
						toast.error(
							`Failed to get update status for product ${msg.productId}: ` + (msg.payload.error || "Unknown error")
						);
						return;
					}
					updateStatuses[msg.productId] = msg.payload;
				});

				relayCommInstance.on("removeDeviceResult", (msg) => {
					if (!msg.payload.success) {
						toast.error(
							`Failed to inform product ${msg.productId} about device removal: ` +
								(msg.payload.error || "Unknown error")
						);
						// Don't return, just acknowledge the error
					}
					// Close dialog & stop loading
					delete removeDialogOpen[msg.productId];
					delete removeDialogLoading[msg.productId];
					removeProduct(msg.productId); // Remove product locally
					loadProducts(); // Refresh products
				});

				relayCommInstance.on("setProductAliasResult", (msg) => {
					delete renameDialogLoading[msg.productId];
					if (!msg.payload.success) {
						toast.error(`Failed to rename product ${msg.productId}: ` + (msg.payload.error || "Unknown error"));
						return;
					}
					// Update locally only on success
					const product = products.find((p) => p.id === msg.productId);
					if (product) {
						product.name = msg.payload.alias;
						saveProduct(product);
					}
					delete renameDialogOpen[msg.productId];
				});
			} catch (error) {
				console.error("Error connecting to relay and getting data from products:", error);
			}
		}
	});

	onDestroy(() => {
		observers.forEach((o) => o.disconnect());
		if (relayCommInstance) relayCommInstance.disconnect();
	});

	function handleRename(product) {
		const newName = renameValue[product.id]?.trim();
		if (!newName || newName.length < 3 || newName.length > 30) {
			toast.error("Product name must be between 3 and 30 characters");
			return;
		}
		if (!relayCommInstance) return toast.warning("Relaycomm instance is undefined!");

		renameDialogLoading[product.id] = true;
		relayCommInstance.send(product.id, "setProductAlias", { alias: newName }).catch((error) => {
			toast.error(`Failed to rename product ${product.id}: ` + error.message);
			console.error(`Failed to rename product ${product.id}:`, error);
			delete renameDialogLoading[product.id];
		});
	}

	// Inform product of device removal & remove product locally
	function removeProductAndRemoveDevice(productId) {
		if (!relayCommInstance) return toast.warning("Relaycomm instance is undefined!");
		removeDialogLoading[productId] = true; // Set loading
		relayCommInstance
			.send(productId, "removeDevice", { targetDeviceId: localStorage.getItem("deviceId") })
			.catch((error) => {
				toast.error(`Failed to inform product ${productId} about device removal: ` + error.message);
				console.error(`Failed to inform product ${productId} about device removal:`, error);
				delete removeDialogOpen[productId]; // Close dialog
				delete removeDialogLoading[productId]; // Stop loading
				removeProduct(productId); // Remove prodcut locally anyway
				loadProducts(); // Refresh products
			});
	}
</script>

<svelte:head>
	<title>ROOT Connect</title>
	<meta name="description" content="Connect and interface with your Root device." />
</svelte:head>

<div class="absolute top-0 right-0 z-1 flex bg-background text-xl">
	<Button class="h-20! border-t-0 border-r-0 p-6!" variant="outline" href="/connect/settings">
		<RiSettings3Line class="h-8! w-8!" />
	</Button>
	<Button class="h-20! border-t-0 border-r-0 p-6!" variant="outline" href="/connect/add">
		<RiVideoAddLine class="h-8! w-8!" />
	</Button>
</div>

{#snippet productItem(product, isFirst = false)}
	{@const isRenameDialogOpen = renameDialogOpen[product.id] ?? false}
	{@const isRemoveDialogOpen = removeDialogOpen[product.id] ?? false}
	<div
		bind:this={productElements[product.id]}
		class="relative flex h-fit min-h-32 w-full shrink-0 {isFirst ? 'border-b' : 'border-y'} max-md:flex-wrap"
	>
		<!-- Preview image -->
		<div
			class="aspect-video w-full content-center bg-foreground text-center text-background max-md:border-b md:w-1/3 md:border-r"
		>
			{#if !previewImages[product.id]}
				{#if previewFailed[product.id]}
					<RiErrorWarningLine class="mx-auto size-8" />
				{:else}
					<Spinner class="mx-auto size-8" />
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
			<div class="flex grow flex-col overflow-hidden p-4">
				<span class="inline-flex items-center gap-1 overflow-hidden text-nowrap"
					><h3 class="truncate text-xl">{product.name}</h3>
					<Dialog.Root
						open={isRenameDialogOpen}
						onOpenChange={(open) => {
							renameDialogOpen[product.id] = open;
						}}
					>
						<Dialog.Trigger
							class="{buttonVariants({ variant: 'ghost' })} ml-1 h-fit! px-1!"
							onclick={() => {
								renameValue[product.id] = product.name;
							}}
						>
							<RiEdit2Line />
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Header>
								<Dialog.Title>Edit name</Dialog.Title>
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
									<Button disabled={renameDialogLoading[product.id]} onclick={() => handleRename(product)}>
										{#if renameDialogLoading[product.id]}<Spinner />{/if}
										Rename
									</Button>
								</div>
							</div>
						</Dialog.Content>
					</Dialog.Root>
					<AlertDialog.Root
						open={isRemoveDialogOpen}
						onOpenChange={(open) => {
							removeDialogOpen[product.id] = open;
						}}
					>
						<AlertDialog.Trigger class="{buttonVariants({ variant: 'ghost' })} h-fit! px-1!">
							<RiDeleteBinLine />
						</AlertDialog.Trigger>
						<AlertDialog.Content>
							<AlertDialog.Header>
								<AlertDialog.Title>Remove?</AlertDialog.Title>
								<AlertDialog.Description>Unpair "{product.name}" and remove it from this device.</AlertDialog.Description>
							</AlertDialog.Header>
							<AlertDialog.Footer>
								<AlertDialog.Cancel disabled={removeDialogLoading[product.id]}>Cancel</AlertDialog.Cancel>
								<AlertDialog.Action
									disabled={removeDialogLoading[product.id]}
									onclick={() => removeProductAndRemoveDevice(product.id)}
								>
									{#if removeDialogLoading[product.id]}<Spinner />{/if}
									Remove
								</AlertDialog.Action>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>
				</span>
				<span class="mt-0.5 mb-6 inline-flex items-center gap-2 text-nowrap">
					<Label class="leading-4!">{product.model}</Label>
					{#if updateStatuses[product.id]?.status && updateStatuses[product.id]?.status !== "up-to-date"}
						<span class="inline-flex items-center gap-1 overflow-hidden bg-accent px-1 text-xs uppercase">
							<RiDownload2Line class="size-3! shrink-0" />
							<p class="truncate">{updateStatuses[product.id].status.replaceAll("-", " ")}</p>
						</span>
					{/if}
				</span>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<p
					class="mt-auto w-fit max-w-full overflow-hidden text-xs text-nowrap text-muted-foreground hover:truncate"
					onclick={() => (idForProductVisible = product.id)}
					onmouseenter={() => (idForProductVisible = product.id)}
					onmouseleave={() => (idForProductVisible = null)}
				>
					ID: <span class={idForProductVisible == product.id ? "" : "bg-accent text-transparent"}>{product.id}</span>
				</p>
			</div>
			<div class="flex h-full flex-col border-l">
				<Button variant="ghost" class="grow" href={"/connect/product/" + product.id}
					><RiArrowRightSLine class="size-8" /></Button
				>
			</div>
		</div>
	</div>
{/snippet}

<!-- Scrollable product view -->
<div class="mt-[7.5rem] h-[calc(100svh-7.5rem)]" class:border-t={products.length}>
	<div class="of-top of-bottom flex h-full w-full flex-col items-center justify-start gap-8 overflow-y-auto pb-30">
		{#if products.length}
			{#each products as product, index}
				{@render productItem(product, index === 0)}
			{/each}
		{:else}
			<Label class="mx-auto my-auto overflow-hidden text-nowrap"
				>Click "<RiVideoAddLine class="-mx-1.25 size-4!" />" to connect a camera.</Label
			>
		{/if}
	</div>
</div>

<WebBluetoothUnsupportedDialog />
