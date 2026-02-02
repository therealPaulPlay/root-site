<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { RiFileUnknowLine } from "svelte-remixicon";
	import Label from "./ui/label/label.svelte";

	let { open = $bindable(false), event = null, thumbnailSrc = null } = $props();

	let imgW = $state(0);
	let imgH = $state(0);

	const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

	// Convert box from model space to percentage coordinates on the original image
	function modelBoxToPercent(box, modelSize) {
		const [mw, mh] = modelSize;
		const scale = Math.min(mw / imgW, mh / imgH);
		const padX = (mw - imgW * scale) / 2;
		const padY = (mh - imgH * scale) / 2;
		const scaledW = imgW * scale;
		const scaledH = imgH * scale;
		return {
			left: ((box.x1 - padX) / scaledW) * 100,
			top: ((box.y1 - padY) / scaledH) * 100,
			width: ((box.x2 - box.x1) / scaledW) * 100,
			height: ((box.y2 - box.y1) / scaledH) * 100,
			label: box.label,
			confidence: Math.round(box.confidence * 100)
		};
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Detection</Dialog.Title>
		</Dialog.Header>
		{#if event}
			<div
				class="relative flex w-full items-center justify-center overflow-hidden border bg-foreground"
				style:aspect-ratio="{imgW || 16}/{imgH || 9}"
			>
				{#if thumbnailSrc}
					<img
						src={thumbnailSrc}
						alt="thumbnail"
						class="h-full w-full object-cover"
						onload={(e) => {
							imgW = e.currentTarget.naturalWidth;
							imgH = e.currentTarget.naturalHeight;
						}}
					/>
					{#if imgW && imgH && event.detection?.modelSize}
						{#each event.detection.boxes ?? [] as box, i}
							{@const b = modelBoxToPercent(box, event.detection.modelSize)}
							{@const color = COLORS[i % COLORS.length]}
							<div
								class="pointer-events-none absolute border-2"
								style:left="{b.left}%"
								style:top="{b.top}%"
								style:width="{b.width}%"
								style:height="{b.height}%"
								style:border-color={color}
							>
								<Label class="absolute -top-5 left-0 px-1 py-0.5 text-xs text-white" style={`background: ${color}`}>
									{b.label}
									{b.confidence}%
								</Label>
							</div>
						{/each}
					{:else}
						<p
							class="absolute inset-0 h-full w-full content-center bg-foreground/50 p-8 text-center text-sm text-background"
						>
							No detection data available.
						</p>
					{/if}
				{:else}
					<RiFileUnknowLine class="size-8 text-background" />
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
