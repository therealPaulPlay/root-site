<script>
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config.js";
	import { toast } from "svelte-sonner";
	import Button from "$lib/components/ui/button/button.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { RiDownloadLine } from "svelte-remixicon";
	import { onMount } from "svelte";

	let loading = $state(true);
	let filename = $state("");
	let downloadUrl = $state("");
	let hasError = $state(false);

	onMount(async () => {
		try {
			const response = await fetch(`https://${DEFAULT_RELAY_DOMAIN}/firmware/observer/image`);
			if (!response.ok) throw new Error(`Failed to fetch firmware info: ${response.status}`);

			const data = await response.json();
			filename = data.filename;
			downloadUrl = data.url;
		} catch (error) {
			console.error("Error fetching firmware image info:", error.message);
			toast.error("Failed to load firmware download info: " + error.message);
			hasError = true;
		} finally {
			loading = false;
		}
	});
</script>

<Button
	href={downloadUrl}
	target="_blank"
	variant="outline"
	disabled={loading || hasError}
	class="justify-center max-w-full"
>
	{#if loading}
		<Spinner />
		Loading firmware...
	{:else if hasError}
		Failed to load firmware
	{:else}
		<p class="flex-1 truncate">{filename}</p>
		<RiDownloadLine class="size-4" />
	{/if}
</Button>
