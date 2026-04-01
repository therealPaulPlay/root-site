<script>
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { getAllProducts, removeProduct, saveProduct } from "$lib/utils/pairedProductsStorage";
	import { createRelayInstance } from "$lib/utils/createRelayInstance";
	import { onMount } from "svelte";
	import { RiDeleteBinLine, RiDownload2Line, RiEdit2Line, RiSettings3Line, RiVideoAddLine } from "svelte-remixicon";
	import { toast } from "svelte-sonner";
	import Label from "$lib/components/ui/label/label.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import PullToRefresh from "$lib/components/PullToRefresh.svelte";
	import StreamPlayer from "$lib/components/StreamPlayer.svelte";
	import { StreamManager } from "$lib/utils/streamManager.svelte.js";
	import { LoadingState } from "$lib/utils/loadingState.svelte.js";
	import { SvelteSet } from "svelte/reactivity";
	import CameraView from "$lib/components/CameraView.svelte";
	import { page } from "$app/state";
	import { snapshotVideoSrc } from "$lib/utils/snapshotVideo";
	import { fade } from "svelte/transition";

	const loading = new LoadingState();

	let products = $state([]);
	let relayCommInstance = $state(null);
	let activeProductId = $state(null);
	let highlightEventId = $state(null);
	let cameraViewOpen = $derived(Boolean(activeProductId));

	let updateStatuses = $state({});
	let streamHandles = $state({});
	let streamVideoElements = $state({});

	let renameDialogOpen = $state({});
	let removeDialogOpen = $state({});
	let renameValue = $state({});

	let streamSnapshots = $state({});
	let failedStreams = new SvelteSet();
	let visibleProducts = new SvelteSet();
	let activeRequestIds = new SvelteSet();
	let statusLoadedProducts = new SvelteSet();

	function startProductStream(productId) {
		if (
			streamHandles[productId] ||
			failedStreams.has(productId) ||
			!relayCommInstance ||
			!visibleProducts.has(productId)
		)
			return;
		streamHandles[productId] = new StreamManager(productId, relayCommInstance, {
			onError: (error) => {
				console.error(`Stream error for product ${productId}:`, error);
				failedStreams.add(productId);
			}
		});
		if (streamVideoElements[productId]) streamHandles[productId].bindVideo(streamVideoElements[productId]);
	}

	function stopProductStream(productId) {
		if (streamVideoElements[productId]) streamSnapshots[productId] = snapshotVideoSrc(streamVideoElements[productId]);
		streamHandles[productId]?.cleanup();
		// Keep the handle if the stream failed so StreamPlayer shows the error icon
		if (!failedStreams.has(productId)) delete streamHandles[productId];
	}

	function stopAllStreams(excludeId = null) {
		for (const productId of Object.keys(streamHandles)) {
			if (productId != excludeId) stopProductStream(productId); // Intentionally matching strings or number
		}
	}

	// Observe product visibility and start/stop streams accordingly
	function observeProduct(productId) {
		return (element) => {
			const observer = new IntersectionObserver(([entry]) => {
				if (entry.isIntersecting) {
					visibleProducts.add(productId);
					relayCommInstance?.onConnected(() => {
						startProductStream(productId);
						loadUpdateStatus(productId);
					});
				} else {
					if (activeProductId === productId) return; // If this product's stream is currently visible in CameraView, keep it active
					visibleProducts.delete(productId);
					stopProductStream(productId);
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

	// Auto-open CameraView from notification tap query params
	let lastHandledQuery = null;
	let queryActionTimeout;
	$effect(() => {
		const paramProductId = page.url.searchParams.get("product-id");
		const query = page.url.search;
		if (!paramProductId || query === lastHandledQuery || !products.length) return;
		if (!products.some((p) => p.id === paramProductId)) return;
		lastHandledQuery = query;
		const eventId = page.url.searchParams.get("event-id");
		// Delay to let the page settle after hydration
		clearTimeout(queryActionTimeout);
		queryActionTimeout = setTimeout(() => {
			activeProductId = paramProductId;
			highlightEventId = eventId;
		}, 250);
		return () => clearTimeout(queryActionTimeout);
	});

	onMount(() => {
		products = getAllProducts();

		if (products.length) {
			relayCommInstance = createRelayInstance();
			relayCommInstance
				.connect()
				.then(() => {
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

		// Reset state
		updateStatuses = {};
		streamHandles = {};
		streamSnapshots = {};
		failedStreams.clear();
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="relative flex h-fit min-h-32 w-full shrink-0 border-y max-lg:flex-wrap {updateStatuses[product.id]
			? '[&:not(:has(button:hover,button:active))]:hover:bg-muted [&:not(:has(button:hover,button:active))]:active:bg-muted'
			: ''}"
		role="button"
		tabindex="0"
		onclick={() => {
			if (!updateStatuses[product.id]) return;
			stopAllStreams(product.id); // Stop all streams when camera view gets opened except for this one
			activeProductId = product.id;
		}}
		{@attach observeProduct(product.id)}
	>
		<div class="relative overflow-hidden max-lg:w-full max-lg:border-b lg:w-1/3 lg:border-r">
			{#if updateStatuses[product.id]?.status && updateStatuses[product.id]?.status !== "up-to-date"}
				<span
					transition:fade={{ duration: 150 }}
					class="absolute top-4 z-1 inline-flex h-fit items-center gap-1 overflow-hidden border bg-background px-2 py-1 text-xs uppercase max-lg:right-4 lg:left-4"
				>
					<RiDownload2Line class="size-3! shrink-0" />
					<p class="truncate">{updateStatuses[product.id]?.status?.replaceAll("-", " ")}</p>
				</span>
			{/if}
			<StreamPlayer
				bind:videoElement={streamVideoElements[product.id]}
				snapshotSrc={streamSnapshots[product.id]}
				streamLoading={stream?.loading ?? true}
				streamEnded={stream?.ended ?? false}
				showControls={false}
			/>
		</div>
		<div class="flex h-fit grow overflow-hidden p-4 text-nowrap max-lg:items-center">
			<h3 class="mr-1 truncate text-xl" class:opacity-50={!updateStatuses[product.id]}>{product.name}</h3>
			<AlertDialog.Root
				open={isRenameDialogOpen}
				onOpenChange={(open) => {
					renameDialogOpen[product.id] = open;
				}}
			>
				<AlertDialog.Trigger
					class="{buttonVariants({
						variant: 'ghost'
					})} h-fit! px-1.5! py-1.25! max-lg:ml-auto"
					disabled={!updateStatuses[product.id]}
					onclick={(event) => {
						event.stopPropagation();
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
				<AlertDialog.Trigger
					class="{buttonVariants({
						variant: 'ghost'
					})} h-fit! px-1.5! py-1.25!"
					onclick={(event) => event.stopPropagation()}
				>
					<RiDeleteBinLine />
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Remove?</AlertDialog.Title>
						<AlertDialog.Description>Unpair "{product.name}" and remove it from this device.</AlertDialog.Description>
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

{#if activeProductId}
	{@const activeProduct = products.find((p) => p.id === activeProductId)}
	{#if activeProduct}
		<CameraView
			productId={activeProductId}
			product={activeProduct}
			{relayCommInstance}
			streamHandle={streamHandles[activeProductId]}
			videoElement={streamVideoElements[activeProductId]}
			{highlightEventId}
			open={cameraViewOpen}
			onClose={() => {
				activeProductId = null;
				highlightEventId = null;
				// Restart streams for visible products
				for (const id of visibleProducts) startProductStream(id);
			}}
			onProductRemoved={() => {
				products = getAllProducts();
			}}
		/>
	{/if}
{/if}
