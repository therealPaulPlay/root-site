<script>
	import { onMount, onDestroy } from "svelte";
	import { decodeBitmap } from "$lib/utils/decodeBitmap";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { toast } from "svelte-sonner";
	import { RiErrorWarningLine } from "svelte-remixicon";

	let { bluetoothInstance } = $props();

	let canvas = $state();
	let ctx;
	let initialUpdateCompleted = $state(false);
	let isDestroyed = $state(false);

	async function updateViewfinder() {
		if (!bluetoothInstance?.isConnected() || isDestroyed || !canvas) return;

		try {
			const chunks = [];
			let hasMore = true;

			while (hasMore && !isDestroyed && canvas) {
				const response = await bluetoothInstance.read("viewfinder");
				if (!canvas) return;
				if (!response.success) throw new Error(response.error || "Unknown error");

				if (response.width && response.height && (response.width !== canvas.width || response.height !== canvas.height)) {
					canvas.width = response.width;
					canvas.height = response.height;
				}

				chunks[response.index] = response.data;
				hasMore = response.hasMore;
			}

			if (!canvas) return;

			// Concatenate Uint8Array chunks
			const totalLength = chunks.reduce((sum, chunk) => sum + (chunk?.length ?? 0), 0);
			const fullData = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				if (!chunk) continue;
				fullData.set(chunk, offset);
				offset += chunk.length;
			}

			if (fullData.length > 0 && !isDestroyed && canvas.width > 0) {
				const imageData = decodeBitmap(fullData, canvas.width, canvas.height);
				ctx.putImageData(imageData, 0, 0);
			}

			initialUpdateCompleted = true;
		} catch (error) {
			console.error("Viewfinder error:", error);
			toast.error("Viewfinder error: " + error.message);
			ctx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
			isDestroyed = true;
		}
	}

	async function viewfinderLoop() {
		while (!isDestroyed) {
			await updateViewfinder();
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
			class="border bg-foreground"
			style="image-rendering: pixelated; width: 160px; height: 90px;"
		></canvas>
	</div>
</div>
