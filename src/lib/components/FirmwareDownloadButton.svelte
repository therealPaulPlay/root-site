<script>
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config.js";
	import { toast } from "svelte-sonner";
	import Button from "$lib/components/ui/button/button.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { RiDownloadLine } from "svelte-remixicon";
	import { onMount } from "svelte";
	import ContentNote from "./ContentNote.svelte";
	import Label from "./ui/label/label.svelte";

	let loading = $state(true);
	let images = $state([]);
	let hasError = $state(false);

	onMount(async () => {
		try {
			const response = await fetch(`https://${DEFAULT_RELAY_DOMAIN}/firmware/observer/image`);
			if (!response.ok) throw new Error(`Failed to fetch firmware info: ${response.status}`);

			const data = await response.json();
			images = data.images;
		} catch (error) {
			console.error("Error fetching firmware image info:", error.message);
			toast.error("Failed to load firmware download info: " + error.message);
			hasError = true;
		} finally {
			loading = false;
		}
	});
</script>

<ContentNote
	text="The custom variant is configured for the Sony IMX290. Use auto-detect for official camera modules."
	class="mb-4"
/>
<div class="max-w-lg space-y-4 border p-4">
	{#if loading}
		<div class="flex items-center gap-4">
			<Spinner />
			<p class="text-sm text-muted-foreground">Loading...</p>
		</div>
	{:else if hasError}
		<p class="text-sm text-muted-foreground">Failed to load.</p>
	{:else if images.length === 0}
		<p class="text-sm text-muted-foreground">No images available.</p>
	{:else}
		<div class="space-y-4">
			{#each images as image}
				<Button href={image.url} target="_blank" variant="outline" class="w-full">
					<span class="min-w-0 truncate">{image.filename}</span>
					{#if image.filename.includes("auto")}
						<Label class="bg-accent py-0.5 px-1">Recommended</Label>
					{/if}
					<RiDownloadLine class="size-4 ml-auto" />
				</Button>
			{/each}
		</div>
	{/if}
</div>
