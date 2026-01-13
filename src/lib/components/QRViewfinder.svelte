<script>
	import { onMount, onDestroy } from "svelte";
	import { decodeBitmap } from "$lib/utils/decodeBitmap";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";

	let { bluetoothInstance } = $props();

	let canvas = $state();
	let ctx;
	let intervalId = $state();
	let isUpdating = false;
	let initialUpdateCompleted = $state(false);
	let isDestroyed = false;

	async function updateViewfinder() {
		if (!bluetoothInstance?.isConnected() || isUpdating || isDestroyed) return;

		isUpdating = true;
		try {
			const chunkMap = {};
			let hasMore = true;

			while (hasMore && !isDestroyed) {
				const response = await bluetoothInstance.read("viewfinder");
				if (!response.success) break;
				chunkMap[response.index] = response.data;
				hasMore = response.hasMore;
			}

			// Sort by index and join
			const indices = Object.keys(chunkMap)
				.map(Number)
				.sort((a, b) => a - b);
			const fullData = indices.map((i) => chunkMap[i]).join("");

			if (fullData.length > 0 && !isDestroyed) {
				const imageData = decodeBitmap(fullData, 48, 27);
				ctx.putImageData(imageData, 0, 0);
			}
		} catch (err) {
			console.error("Viewfinder error:", err);
		} finally {
			isUpdating = false;
			initialUpdateCompleted = true;
		}
	}

	onMount(() => {
		isDestroyed = false;
		if (intervalId) clearInterval(intervalId);
		ctx = canvas.getContext("2d");
		intervalId = setInterval(updateViewfinder, 1000);
		updateViewfinder();
	});

	onDestroy(() => {
		isDestroyed = true;
		if (intervalId) clearInterval(intervalId);
	});
</script>

<div class="mr-auto w-fit space-y-1">
	<Label>Viewfinder</Label>
	<div class="relative w-fit">
		{#if !initialUpdateCompleted}
			<Spinner class="absolute inset-0 mx-auto my-auto size-6! text-background" />
		{/if}
		<canvas
			bind:this={canvas}
			width="48"
			height="27"
			class="border bg-foreground"
			style="image-rendering: pixelated; width: 160px; height: 90px;"
		></canvas>
	</div>
</div>
