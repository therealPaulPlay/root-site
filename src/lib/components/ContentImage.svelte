<script>
	import Label from "./ui/label/label.svelte";

	let { src, alt } = $props();
</script>

<aside class="relative flex aspect-video w-full items-center justify-center border bg-foreground">
	{#if src}
		<img {alt} {src} class="relative h-full w-full object-cover" />
	{:else}
		<Label class="text-background">Image source missing.</Label>
	{/if}
</aside>
