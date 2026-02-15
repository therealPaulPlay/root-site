<script>
	import { onMount, onDestroy } from "svelte";
	import { decodeBitmap } from "$lib/utils/decodeBitmap";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { toast } from "svelte-sonner";
	import { RiErrorWarningLine } from "svelte-remixicon";

	let { bluetoothInstance } = $props();

	const resX = 96;
	const resY = 54;

	let canvas = $state();
	let ctx;
	let initialUpdateCompleted = $state(false);
	let isDestroyed = $state(false);

	async function updateViewfinder() {
		if (!bluetoothInstance?.isConnected() || isDestroyed) return;

		try {
			const chunks = [];
			let hasMore = true;

			while (hasMore && !isDestroyed) {
				const response = await bluetoothInstance.read("viewfinder");
				if (!response.success) throw new Error(response.error || "Unknown error");

				chunks[response.index] = response.data;
				hasMore = response.hasMore;
			}

			// Concatenate Uint8Array chunks
			const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
			const fullData = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				fullData.set(chunk, offset);
				offset += chunk.length;
			}

			if (fullData.length > 0 && !isDestroyed) {
				const imageData = decodeBitmap(fullData, resX, resY);
				ctx.putImageData(imageData, 0, 0);
			}

			initialUpdateCompleted = true;
		} catch (error) {
			console.error("Viewfinder error:", error);
			toast.error("Viewfinder error: " + error.message);
			ctx?.clearRect(0, 0, canvas.width, canvas.height);
			isDestroyed = true;
		}
	}

	async function viewfinderLoop() {
		while (!isDestroyed) {
			await updateViewfinder();
			await new Promise((resolve) => setTimeout(resolve, 250)); // Wait 0.25s in between
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
		{#if isDestroyed}
			<RiErrorWarningLine class="absolute inset-0 mx-auto my-auto size-6! text-background" />
		{:else if !initialUpdateCompleted}
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
