<script>
	import { onMount, onDestroy } from "svelte";
	import { RiDeviceLine, RiTimeLine, RiComputerLine, RiCpuLine, RiTranslate2 } from "svelte-remixicon";
	import { blur } from "svelte/transition";

	let exampleTrackingInfo = $state([]);
	let trackingExampleIndex = $state(0);

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
		const trackingExampleInterval = setInterval(() => {
			if (trackingExampleIndex < exampleTrackingInfo.length - 1) trackingExampleIndex += 1;
			else trackingExampleIndex = 0;
		}, 5000);

		// Start 1s and 0s change interval
		const binaryChangeInterval = setInterval(() => {
			binaryEffectString = Array.from({ length: 500 }, () => Math.round(Math.random())).join("");
		}, 100);

		return () => {
			clearInterval(trackingExampleInterval);
			clearInterval(binaryChangeInterval);
		};
	});

	const binaryEffectArray = Array(20).fill(0);
	let binaryEffectString = $state(Array.from({ length: 500 }, () => Math.round(Math.random())).join(""));
</script>

<svelte:head>
	<title>ROOT - Private smart home devices</title>
</svelte:head>

<section class="relative mb-20 flex h-155 w-full items-center justify-center">
	<img
		alt="privacy matters"
		src="/images/privacy-matters-placeholder.jpg"
		class="absolute inset-0 -z-1 h-full w-full border-b object-cover"
	/>
</section>

<section class="flex border-y max-md:flex-wrap">
	<div class="relative flex min-w-1/3 flex-col justify-center overflow-hidden mask-y-from-75% mask-y-to-100% p-4">
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
	<div class="min-w-2/3 space-y-4 border-l p-10">
		<h3 class="font-display text-3xl font-medium">The opportunity for surveillance.</h3>
		<p class="max-w-3/4">
			Privacy isn’t about hiding something. It’s a basic human right, put at risk the moment
			<span class="bg-neutral-100">monitoring becomes possible</span>.
		</p>
		<p class="max-w-3/4">
			Countless ordinary IoT devices <span class="bg-neutral-100">embrace this possibility by design</span>. They are
			capable of watching, listening, and exchanging information.
		</p>
	</div>
</section>

<section class="h-20 w-full"></section>

<section class="relative flex w-full items-center justify-center overflow-hidden border-y py-30">
	<div class="absolute -inset-3 -z-1 bg-foreground select-none">
		{#each binaryEffectArray as row, index}
			<p class="w-full text-lg font-thin text-background" style:opacity={0.5 - 0.035 * index}>
				{binaryEffectString?.slice(Math.floor(Math.random() * 100))}
			</p>
		{/each}
	</div>
	<div class="flex flex-col items-center justify-between gap-8">
		<a class="p-8 font-display text-7xl font-medium text-background uppercase" name="mission">The mission.</a>
		<div class="w-2/3 border p-4">
			<p class="text-background">
				Crafting smart home devices that fulfill their purpose, nothing more. Function &gt; form. Not just promising privacy,
				but developing open-source software that is incapable of tracking users. <span
					class="inline-block h-4 w-2 animate-flash bg-background align-middle"
				></span>
			</p>
		</div>
	</div>
</section>
