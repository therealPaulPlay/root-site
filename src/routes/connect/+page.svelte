<script>
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { getAllProducts, removeProduct, saveProduct } from "$lib/utils/pairedProductsStorage";
	import { createRelayInstance } from "$lib/utils/createRelayInstance";
	import { onMount } from "svelte";
	import {
		RiArrowRightSLine,
		RiDeleteBinLine,
		RiDownload2Line,
		RiEdit2Line,
		RiSettings3Line,
		RiVideoAddLine
	} from "svelte-remixicon";
	import { toast } from "svelte-sonner";
	import Label from "$lib/components/ui/label/label.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import PullToRefresh from "$lib/components/PullToRefresh.svelte";
	import StreamPlayer from "$lib/components/StreamPlayer.svelte";
	import { StreamManager } from "$lib/utils/streamManager.svelte.js";
	import { LoadingState } from "$lib/utils/loadingState.svelte.js";
	import { SvelteSet } from "svelte/reactivity";

	const loading = new LoadingState();

	let products = $state([]);
	let relayCommInstance;

	let updateStatuses = $state({});
	let streamHandles = $state({});
	let streamVideoElements = $state({});

	let renameDialogOpen = $state({});
	let removeDialogOpen = $state({});
	let renameValue = $state({});

	let offScreenTimers = {};
	let visibleProducts = new SvelteSet();
	let activeRequestIds = new SvelteSet();
	let statusLoadedProducts = new SvelteSet();

	function startProductStream(productId) {
		if (streamHandles[productId] || !relayCommInstance || !visibleProducts.has(productId)) return;
		streamHandles[productId] = new StreamManager(productId, relayCommInstance, {
			onError: (error) => console.error(`Stream error for product ${productId}:`, error)
		});
		if (streamVideoElements[productId]) streamHandles[productId].bindVideo(streamVideoElements[productId]);
	}

	function stopProductStream(productId) {
		streamHandles[productId]?.cleanup();
		delete streamHandles[productId];
		clearTimeout(offScreenTimers[productId]);
		delete offScreenTimers[productId];
	}

	function stopAllStreams() {
		for (const productId of Object.keys(streamHandles)) stopProductStream(productId);
		for (const timer of Object.values(offScreenTimers)) clearTimeout(timer);
		offScreenTimers = {};
	}

	// Observe product visibility and start/stop streams accordingly
	function observeProduct(productId) {
		return (element) => {
			const observer = new IntersectionObserver(([entry]) => {
				if (entry.isIntersecting) {
					visibleProducts.add(productId);
					clearTimeout(offScreenTimers[productId]);
					delete offScreenTimers[productId];
					relayCommInstance?.onConnected(() => {
						startProductStream(productId);
						loadUpdateStatus(productId);
					});
				} else {
					visibleProducts.delete(productId);
					// Stop stream after 5s off-screen
					if (!offScreenTimers[productId])
						offScreenTimers[productId] = setTimeout(() => stopProductStream(productId), 5000);
				}
			});
			observer.observe(element);
			return () => {
				observer.disconnect();
				visibleProducts.delete(productId);
				stopProductStream(productId);
			};
		};
	}

	function loadUpdateStatus(productId) {
		if (statusLoadedProducts.has(productId) || !relayCommInstance) return;
		statusLoadedProducts.add(productId);
		const status = relayCommInstance.send(productId, "getUpdateStatus");
		activeRequestIds.add(status.requestId);
		status.catch((error) => console.error(`Failed to get update status for product ${productId}:`, error));
	}

	function handleGetUpdateStatusResult(msg) {
		if (!activeRequestIds.has(msg.requestId)) return;
		if (!msg.payload.success) {
			toast.error(`Failed to get update status for product ${msg.originId}: ` + (msg.payload.error || "Unknown error"));
			return;
		}
		updateStatuses[msg.originId] = msg.payload;
	}

	function handleRemoveDeviceResult(msg) {
		if (!msg.payload.success) {
			toast.error(
				`Failed to inform product ${msg.originId} about device removal: ` + (msg.payload.error || "Unknown error")
			);
			// Don't return, just acknowledge the error
		}
		delete removeDialogOpen[msg.originId];
		loading.set(`remove-${msg.originId}`, false);
		stopProductStream(msg.originId);
		removeProduct(msg.originId);
		products = getAllProducts();
	}

	function handleSetProductAliasResult(msg) {
		loading.set(`rename-${msg.originId}`, false);
		if (!msg.payload.success) {
			toast.error(`Failed to rename product ${msg.originId}: ` + (msg.payload.error || "Unknown error"));
			return;
		}
		// Update locally only on success
		const product = products.find((p) => p.id === msg.originId);
		if (product) {
			product.name = msg.payload.alias;
			saveProduct(product);
		}
		delete renameDialogOpen[msg.originId];
	}

	onMount(() => {
		products = getAllProducts();

		if (products.length) {
			relayCommInstance = createRelayInstance();
			relayCommInstance
				.connect()
				.then(() => {
					for (const productId of visibleProducts) {
						startProductStream(productId);
						loadUpdateStatus(productId);
					}

					relayCommInstance.on("getUpdateStatusResult", handleGetUpdateStatusResult);
					relayCommInstance.on("removeDeviceResult", handleRemoveDeviceResult);
					relayCommInstance.on("setProductAliasResult", handleSetProductAliasResult);
				})
				.catch((error) => {
					console.error("Error connecting to relay and getting data from products:", error);
				});
		}

		return () => {
			stopAllStreams();
			relayCommInstance?.disconnect();
		};
	});

	function handleRename(product) {
		const newName = renameValue[product.id]?.trim();
		if (!newName || newName.length < 3 || newName.length > 30) {
			toast.error("Product name must be between 3 and 30 characters");
			return;
		}
		if (!relayCommInstance) return toast.warning("RelayComm instance is undefined!");

		loading.set(`rename-${product.id}`, true);
		relayCommInstance.send(product.id, "setProductAlias", { alias: newName }).catch((error) => {
			toast.error(`Failed to rename product ${product.id}: ` + error.message);
			console.error(`Failed to rename product ${product.id}:`, error);
			loading.set(`rename-${product.id}`, false);
		});
	}

	function removeProductAndRemoveDevice(productId) {
		if (!relayCommInstance) return toast.warning("RelayComm instance is undefined!");
		loading.set(`remove-${productId}`, true);
		relayCommInstance
			.send(productId, "removeDevice", { targetDeviceId: localStorage.getItem("deviceId") })
			.catch((error) => {
				toast.error(`Failed to inform product ${productId} about device removal: ` + error.message);
				console.error(`Failed to inform product ${productId} about device removal:`, error);
				delete removeDialogOpen[productId]; // Close dialog since we remove the product anyway
				loading.set(`remove-${productId}`, false);
				stopProductStream(productId);
				removeProduct(productId);
				products = getAllProducts();
			});
	}

	function refreshAll() {
		stopAllStreams();

		// Update status
		updateStatuses = {};
		activeRequestIds.clear();
		statusLoadedProducts.clear();
		for (const productId of visibleProducts) loadUpdateStatus(productId);

		// Streams
		for (const productId of visibleProducts) startProductStream(productId);
	}
</script>

<svelte:head>
	<title>ROOT Connect</title>
	<meta name="description" content="Connect and interface with your Root device." />
</svelte:head>

<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) stopAllStreams();
		else if (relayCommInstance && products.length) relayCommInstance.onConnected(refreshAll);
	}}
/>

<div class="absolute top-0 right-0 z-1 flex bg-background text-xl">
	<Button class="h-20! border-t-0 border-r-0 p-6!" variant="outline" href="/connect/settings">
		<RiSettings3Line class="h-8! w-8!" />
	</Button>
	<Button class="h-20! border-t-0 border-r-0 p-6!" variant="outline" href="/connect/add">
		<RiVideoAddLine class="h-8! w-8!" />
	</Button>
</div>

{#snippet productItem(product)}
	{@const isRenameDialogOpen = renameDialogOpen[product.id] ?? false}
	{@const isRemoveDialogOpen = removeDialogOpen[product.id] ?? false}
	{@const stream = streamHandles[product.id]}
	<div
		class="relative flex h-fit min-h-32 w-full shrink-0 border-y max-lg:flex-wrap"
		{@attach observeProduct(product.id)}
	>
		<div class="w-full overflow-hidden max-lg:border-b lg:w-1/3 lg:border-r">
			<StreamPlayer
				bind:videoElement={streamVideoElements[product.id]}
				streamLoading={stream?.loading ?? true}
				streamEnded={stream?.ended ?? false}
				showControls={false}
			/>
		</div>
		<div class="flex grow overflow-hidden">
			<div class="flex grow flex-col overflow-hidden p-4">
				<span class="inline-flex items-center gap-1 overflow-hidden text-nowrap"
					><h3 class="truncate text-xl">{product.name}</h3>
					<AlertDialog.Root
						open={isRenameDialogOpen}
						onOpenChange={(open) => {
							renameDialogOpen[product.id] = open;
						}}
					>
						<AlertDialog.Trigger
							class="{buttonVariants({ variant: 'ghost' })} ml-1 h-fit! px-1!"
							onclick={() => {
								renameValue[product.id] = product.name;
							}}
						>
							<RiEdit2Line />
						</AlertDialog.Trigger>
						<AlertDialog.Content>
							<AlertDialog.Header>
								<AlertDialog.Title>Edit name</AlertDialog.Title>
							</AlertDialog.Header>
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
								<AlertDialog.Footer>
									<AlertDialog.Cancel disabled={loading.is(`rename-${product.id}`)}>Cancel</AlertDialog.Cancel>
									<AlertDialog.Action
										disabled={loading.is(`rename-${product.id}`) || product.name === renameValue[product.id]?.trim()}
										onclick={() => handleRename(product)}
									>
										{#if loading.is(`rename-${product.id}`)}<Spinner />{/if}
										Rename
									</AlertDialog.Action>
								</AlertDialog.Footer>
							</div>
						</AlertDialog.Content>
					</AlertDialog.Root>
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
								<AlertDialog.Description
									>Unpair "{product.name}" and remove it from this device.</AlertDialog.Description
								>
							</AlertDialog.Header>
							<AlertDialog.Footer>
								<AlertDialog.Cancel disabled={loading.is(`remove-${product.id}`)}>Cancel</AlertDialog.Cancel>
								<AlertDialog.Action
									disabled={loading.is(`remove-${product.id}`)}
									onclick={() => removeProductAndRemoveDevice(product.id)}
								>
									{#if loading.is(`remove-${product.id}`)}<Spinner />{/if}
									Remove
								</AlertDialog.Action>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>
				</span>
				<span class="mt-0.5 mb-2 inline-flex items-center gap-2 text-nowrap">
					<span
						class="inline-flex items-center gap-1 overflow-hidden bg-accent px-1 text-xs uppercase transition"
						class:opacity-0={!updateStatuses[product.id]?.status || updateStatuses[product.id]?.status == "up-to-date"}
					>
						<RiDownload2Line class="size-3! shrink-0" />
						<p class="truncate">{updateStatuses[product.id]?.status?.replaceAll("-", " ") || "N/A"}</p>
					</span>
				</span>
			</div>
			<div class="flex h-full flex-col border-l">
				<Button
					variant="ghost"
					class="grow"
					href={"/connect/product/" + product.id}
					disabled={!updateStatuses[product.id]}><RiArrowRightSLine class="size-8" /></Button
				>
			</div>
		</div>
	</div>
{/snippet}

<!-- Scrollable product view -->
<div class="mt-[7.5rem] h-[calc(100svh-7.5rem-env(safe-area-inset-top,0px))]" class:border-t={products.length}>
	<PullToRefresh
		disabled={!products.length}
		onRefresh={() => {
			if (relayCommInstance && products.length) relayCommInstance.onConnected(refreshAll);
		}}
		class="of-top of-bottom -mt-px space-y-10 pb-10"
	>
		{#if products.length}
			{#each products as product}
				{@render productItem(product)}
			{/each}
		{:else}
			<div class="flex h-full w-full items-center justify-center">
				<Label class="min-w-fit overflow-hidden text-nowrap"
					>Click "<RiVideoAddLine class="-mx-1.25 size-4!" />" to connect a camera.</Label
				>
			</div>
		{/if}
	</PullToRefresh>
</div>
