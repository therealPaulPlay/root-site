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
</script>

<div
	class="relative aspect-video w-full bg-muted text-muted-foreground {isFullscreen
		? 'fixed! inset-0! z-100! h-full!'
		: 'max-h-[45svh]'}"
>
	{#if streamLoading || streamEnded}
		<div class="absolute inset-0 flex h-full w-full items-center justify-center">
			{#if streamLoading}
				<Spinner class="size-8" />
			{:else if streamEnded}
				<RiErrorWarningLine class="size-8" />
			{/if}
		</div>
	{/if}
	<!-- disableRemotePlayback required on iOS -->
	<video
		bind:this={videoElement}
		class="absolute inset-0 h-full w-full"
		disableremoteplayback
		playsinline
		muted
		onerror={(e) => {
			// Ignore empty src errors (code 4)
			const error = e.currentTarget.error;
			if (error && error.code !== 4) console.error("Video playback error:", error.code, error.message);
		}}
	></video>
	<div class="absolute {isFullscreen ? 'right-6 bottom-6' : 'right-4 bottom-4'} flex gap-2">
		{#if showMuteButton}
			<Button
				onclick={() => (audioMuted = !audioMuted)}
				class="px-3 opacity-50 hover:opacity-100 active:opacity-100"
				variant="outline"
			>
				{#if audioMuted}
					<RiVolumeMuteLine class="size-4" />
				{:else}
					<RiVolumeUpLine class="size-4" />
				{/if}
			</Button>
		{/if}
		<Button
			onclick={() => (isFullscreen = !isFullscreen)}
			class="px-3 opacity-50 hover:opacity-100 active:opacity-100"
			variant="outline"
		>
			{#if isFullscreen}
				<RiFullscreenExitLine class="size-4" />
			{:else}
				<RiFullscreenLine class="size-4" />
			{/if}
		</Button>
	</div>
</div>
