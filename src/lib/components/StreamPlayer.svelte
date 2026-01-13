<script>
	import { RiVolumeUpLine, RiVolumeMuteLine, RiFullscreenLine, RiFullscreenExitLine } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";

	let { videoElement = $bindable(), audioMuted = $bindable(), streamLoading = true, showMuteButton = false } = $props();

	let isFullscreen = $state(false);

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			videoElement?.parentElement?.requestFullscreen();
			isFullscreen = true;
		} else {
			document.exitFullscreen();
			isFullscreen = false;
		}
	}
</script>

<div class="relative aspect-video max-h-[45svh] w-full bg-black" class:border-0!={isFullscreen}>
	{#if streamLoading}
		<div class="flex h-full w-full items-center justify-center text-background">
			<Spinner class="size-8" />
		</div>
	{/if}
	<video bind:this={videoElement} class="h-full w-full" playsinline muted></video>
	<div class="absolute right-4 bottom-4 flex gap-2">
		{#if showMuteButton}
			<Button onclick={() => (audioMuted = !audioMuted)} class="px-3 opacity-50 hover:opacity-100">
				{#if audioMuted}
					<RiVolumeMuteLine class="size-4" />
				{:else}
					<RiVolumeUpLine class="size-4" />
				{/if}
			</Button>
		{/if}
		<Button onclick={toggleFullscreen} class="px-3 opacity-50 hover:opacity-100">
			{#if isFullscreen}
				<RiFullscreenExitLine class="size-4" />
			{:else}
				<RiFullscreenLine class="size-4" />
			{/if}
		</Button>
	</div>
</div>
