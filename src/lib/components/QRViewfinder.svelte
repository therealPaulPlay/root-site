<script>
	import { onMount, onDestroy } from "svelte";
	import { decodeBitmap } from "$lib/utils/decodeBitmap";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";

	let { bluetoothInstance } = $props();

	const resX = 96;
	const resY = 54;

	let canvas = $state();
	let ctx;
	let initialUpdateCompleted = $state(false);
	let isDestroyed = false;

	async function updateViewfinder() {
		if (!bluetoothInstance?.isConnected() || isDestroyed) return;

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
				const imageData = decodeBitmap(fullData, resX, resY);
				ctx.putImageData(imageData, 0, 0);
			}
		} catch (err) {
			console.error("Viewfinder error:", err);
		} finally {
			initialUpdateCompleted = true;
		}
	}

	async function viewfinderLoop() {
		while (!isDestroyed) {
			await updateViewfinder();
			await new Promise(resolve => setTimeout(resolve, 250)); // Wait 0.25s in between
		}
	}

	onMount(() => {
		isDestroyed = false;
		ctx = canvas.getContext("2d");
		viewfinderLoop();
	});

	onDestroy(() => {
		isDestroyed = true;
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
			width={resX}
			height={resY}
			class="border bg-foreground"
			style="image-rendering: pixelated; width: 160px; height: 90px;"
		></canvas>
	</div>
</div>
