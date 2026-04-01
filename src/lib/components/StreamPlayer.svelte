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
	import { fade } from "svelte/transition";
	import { MediaQuery } from "svelte/reactivity";

	let {
		videoElement = $bindable(),
		videoMountTarget = $bindable(undefined),
		snapshotSrc = null,
		audioMuted = false,
		streamLoading = false,
		streamEnded = false,
		showMuteButton = false,
		showControls = true,
		onAudioToggle = () => {}
	} = $props();

	const isPortrait = new MediaQuery("(orientation: portrait)");

	let isFullscreen = $state(false);
	let controlsOverlayVisible = $state(false);
	let controlsOverlayTimeout = null;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative aspect-video w-full {!streamLoading && !streamEnded
		? 'bg-black'
		: 'bg-muted'} text-muted-foreground {isFullscreen
		? isPortrait.current
			? 'fixed! top-1/2! left-1/2! z-100! h-[100svw]! w-[calc(100svh-var(--safe-area-top))]! -translate-x-1/2! -translate-y-1/2! rotate-90!'
			: 'fixed! inset-0! z-100! h-full!'
		: 'max-h-[45svh]'}"
	onpointerup={(e) => {
		if (e.pointerType !== "mouse") {
			clearTimeout(controlsOverlayTimeout);
			if (controlsOverlayVisible) controlsOverlayVisible = false;
			else {
				controlsOverlayVisible = true;
				controlsOverlayTimeout = setTimeout(() => {
					controlsOverlayVisible = false;
				}, 3000);
			}
		}
	}}
	onpointermove={(e) => {
		if (e.pointerType === "mouse") {
			controlsOverlayVisible = true;
			clearTimeout(controlsOverlayTimeout);
			controlsOverlayTimeout = setTimeout(() => {
				controlsOverlayVisible = false;
			}, 3000);
		}
	}}
>
	{#if streamLoading || streamEnded}
		<div class="absolute inset-0 flex h-full w-full items-center justify-center">
			{#if streamLoading}
				<Spinner class="size-8" />
			{:else if streamEnded}
				<RiErrorWarningLine class="size-8" />
			{/if}
		</div>
		{#if snapshotSrc}
			<img src={snapshotSrc} alt="" class="absolute inset-0 h-full w-full object-cover opacity-50" />
		{/if}
	{/if}
	<!-- disableRemotePlayback required on iOS -->
	{#if videoMountTarget !== undefined}
		<div bind:this={videoMountTarget} class="absolute inset-0 h-full w-full"></div>
	{:else}
		<video
			bind:this={videoElement}
			class="absolute inset-0 h-full w-full {streamLoading || streamEnded ? 'invisible' : ''}"
			disableremoteplayback
			playsinline
			muted
			onerror={(e) => {
				// Ignore empty src errors
				const error = e.currentTarget.error;
				if (error && !error.message?.toLowerCase()?.includes("empty src"))
					console.error("Video playback error:", error);
			}}
		></video>
	{/if}
	{#if showControls}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute {isFullscreen
				? 'right-6 bottom-6'
				: 'right-4 bottom-4'} flex gap-2 transition-opacity duration-150"
			class:opacity-0={!controlsOverlayVisible}
			class:pointer-events-none={!controlsOverlayVisible}
			onpointerup={(e) => e.stopPropagation()}
		>
			{#if showMuteButton}
				<div transition:fade={{ duration: 150 }}>
					<Button onclick={onAudioToggle} class="px-3" variant="outline">
						{#if audioMuted}
							<RiVolumeMuteLine class="size-4" />
						{:else}
							<RiVolumeUpLine class="size-4" />
						{/if}
					</Button>
				</div>
			{/if}
			<Button onclick={() => (isFullscreen = !isFullscreen)} class="px-3" variant="outline">
				{#if isFullscreen}
					<RiFullscreenExitLine class="size-4" />
				{:else}
					<RiFullscreenLine class="size-4" />
				{/if}
			</Button>
		</div>
	{/if}
</div>
