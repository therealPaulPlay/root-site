<script>
	import { onMount, onDestroy } from "svelte";
	import { RiDeviceLine, RiTimeLine, RiComputerLine, RiCpuLine, RiTranslate2 } from "svelte-remixicon";
	import { blur } from "svelte/transition";

	let exampleTrackingInfo = $state([]);
	let trackingExampleIndex = $state(0);
	let trackingExampleInterval;

	onMount(() => {
		exampleTrackingInfo = [
			{
				icon: RiDeviceLine,
				text: navigator.userAgent.includes("Android")
					? "Android"
					: /iPhone|iPad|iPod/.test(navigator.userAgent)
						? "iOS"
						: navigator.platform.includes("Mac")
							? "MacOS"
							: navigator.platform.includes("Win")
								? "Windows"
								: navigator.platform.includes("Linux")
									? "Linux"
									: navigator.platform
			},
			{
				icon: RiComputerLine,
				text: `${window.screen.width}x${window.screen.height}`
			},
			{
				icon: RiTimeLine,
				text: Intl.DateTimeFormat().resolvedOptions().timeZone?.split("/")?.[1]
			},
			{
				icon: RiTranslate2,
				text: navigator.language?.toUpperCase()
			},
			{
				icon: RiCpuLine,
				text: `${navigator.hardwareConcurrency} cores`
			}
		];

		// Start the auto-rotation timer
		trackingExampleInterval = setInterval(() => {
			if (trackingExampleIndex < exampleTrackingInfo.length - 1) trackingExampleIndex += 1;
			else trackingExampleIndex = 0;
		}, 5000);

		return () => clearInterval(trackingExampleInterval);
	});
</script>

<svelte:head>
	<title>ROOT - Private smart home devices</title>
</svelte:head>

<section class="relative flex h-160 w-full items-center justify-center">
	<img
		alt="privacy matters"
		src="/images/privacy-matters-placeholder.jpg"
		class="absolute inset-0 -z-1 h-full w-full object-cover"
	/>
	<h1 class="font-display text-7xl text-background">What about privacy?</h1>
</section>

<section class="flex border-y max-md:flex-wrap">
	<div
		class="relative flex min-w-1/3 flex-col justify-center overflow-hidden border-r mask-y-from-75% mask-y-to-100% p-4"
	>
		<div
			class="absolute inset-0 ml-20 transition-transform duration-700 ease-in-out"
			style:transform="translateY({trackingExampleIndex * -60 + 40}px)"
		>
			{#each exampleTrackingInfo as info, i}
				<div
					class="flex h-20 items-center gap-3 text-5xl transition-all duration-700 ease-in-out"
					class:opacity-100={i === trackingExampleIndex}
					class:opacity-30={i !== trackingExampleIndex}
					class:scale-100={i === trackingExampleIndex}
					class:scale-75={i !== trackingExampleIndex}
				>
					{#if info.icon}
						<info.icon width="0.85em" />
					{/if}
					<p class="truncate font-display uppercase">{info.text}</p>
				</div>
			{/each}
		</div>
	</div>
	<div class="min-w-2/3 space-y-4 p-10">
		<h3 class="font-display text-3xl font-medium">The age of the transparent home.</h3>
		<p class="max-w-3/4">
			Privacy isn't about having nothing to hide. It's a human right, violated the moment <span class="bg-neutral-100"
				>surveillance becomes possible</span
			>.
		</p>
		<p class="max-w-3/4">
			Ordinary smart home devices <span class="bg-neutral-100">embrace this possibility by design</span>. They are
			capable of watching, listening, and quietly turning your home into a data stream.
		</p>
	</div>
</section>
