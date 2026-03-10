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
		audioMuted = $bindable(),
		loading,
		streamEnded = false,
		showMuteButton = false,
		onAudioToggle = () => {}
	} = $props();

	const isPortrait = new MediaQuery("(orientation: portrait)");
	
	let isFullscreen = $state(false);
	let controlsVisible = $state(false);
	let controlsTimeout = null;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative aspect-video w-full {!loading.is('stream') && !streamEnded
		? 'bg-black'
		: 'bg-muted'} text-muted-foreground {isFullscreen
		? isPortrait.current
			? 'fixed! top-1/2! left-1/2! z-100! h-[100svw]! w-[100svh]! -translate-x-1/2! -translate-y-1/2! rotate-90!'
			: 'fixed! inset-0! z-100! h-full!'
		: 'max-h-[45svh]'}"
	onpointerup={(e) => {
		if (e.pointerType !== "mouse") {
			clearTimeout(controlsTimeout);
			if (controlsVisible) controlsVisible = false;
			else {
				controlsVisible = true;
				controlsTimeout = setTimeout(() => {
					controlsVisible = false;
				}, 3000);
			}
		}
	}}
	onpointermove={(e) => {
		if (e.pointerType === "mouse") {
			controlsVisible = true;
			clearTimeout(controlsTimeout);
			controlsTimeout = setTimeout(() => {
				controlsVisible = false;
			}, 3000);
		}
	}}
>
	{#if loading.is("stream") || streamEnded}
		<div class="absolute inset-0 flex h-full w-full items-center justify-center">
			{#if loading.is("stream")}
				<Spinner class="size-8" />
			{:else if streamEnded}
				<RiErrorWarningLine class="size-8" />
			{/if}
		</div>
	{/if}
	<!-- disableRemotePlayback required on iOS -->
	<video
		bind:this={videoElement}
		class="absolute inset-0 h-full w-full {loading.is('stream') || streamEnded ? 'invisible' : ''}"
		disableremoteplayback
		playsinline
		muted
		onerror={(e) => {
			// Ignore empty src errors (code 4)
			const error = e.currentTarget.error;
			if (error && error.code !== 4) console.error("Video playback error:", error.code, error.message);
		}}
	></video>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute {isFullscreen ? 'right-6 bottom-6' : 'right-4 bottom-4'} flex gap-2 transition-opacity duration-150"
		class:opacity-0={!controlsVisible}
		class:pointer-events-none={!controlsVisible}
		onpointerup={(e) => e.stopPropagation()}
	>
		{#if showMuteButton}
			<div transition:fade={{ duration: 150 }}>
				<Button
					onclick={() => {
						onAudioToggle();
						audioMuted = !audioMuted;
					}}
					class="px-3"
					variant="outline"
				>
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
</div>
