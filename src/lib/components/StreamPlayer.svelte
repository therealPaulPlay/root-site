<script>
	import {
		RiVolumeUpLine,
		RiVolumeMuteLine,
		RiFullscreenLine,
		RiFullscreenExitLine,
		RiErrorWarningLine
	} from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";

	let {
		videoElement = $bindable(),
		audioMuted = $bindable(),
		streamLoading = true,
		streamEnded = false,
		showMuteButton = false
	} = $props();

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
	{#if streamLoading || streamEnded}
		<div class="absolute inset-0 flex h-full w-full items-center justify-center text-background">
			{#if streamLoading}
				<Spinner class="size-8" />
			{:else if streamEnded}
				<RiErrorWarningLine class="size-8" />
			{/if}
		</div>
	{/if}
	<video
		bind:this={videoElement}
		class="absolute inset-0 h-full w-full"
		playsinline
		muted
		onerror={(e) => {
			const error = e.currentTarget.error;
			// Ignore empty src errors (code 4)
			if (error && error.code !== 4) console.error("Video playback error:", error.code, error.message);
		}}
	></video>
	<div class="absolute right-4 bottom-4 flex gap-2">
		{#if showMuteButton}
			<Button onclick={() => (audioMuted = !audioMuted)} class="px-3 opacity-50 hover:opacity-100 active:opacity-100">
				{#if audioMuted}
					<RiVolumeMuteLine class="size-4" />
				{:else}
					<RiVolumeUpLine class="size-4" />
				{/if}
			</Button>
		{/if}
		<Button onclick={toggleFullscreen} class="px-3 opacity-50 hover:opacity-100 active:opacity-100">
			{#if isFullscreen}
				<RiFullscreenExitLine class="size-4" />
			{:else}
				<RiFullscreenLine class="size-4" />
			{/if}
		</Button>
	</div>
</div>
