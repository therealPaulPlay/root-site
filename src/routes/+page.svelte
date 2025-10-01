<script>
	import { onMount, onDestroy } from "svelte";
	import { RiDeviceLine, RiTimeLine, RiComputerLine, RiCpuLine, RiTranslate2, RiCamera2Fill } from "svelte-remixicon";
	import { blur } from "svelte/transition";

	// User tracking example
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

		// Update marquee text based on width
		updateMarqueeText();

		// Start the auto-rotation timer
		const trackingExampleInterval = setInterval(() => {
			if (trackingExampleIndex < exampleTrackingInfo.length - 1) trackingExampleIndex += 1;
			else trackingExampleIndex = 0;
		}, 5000);

		// Start 1s and 0s change interval
		const binaryChangeInterval = setInterval(() => {
			binaryEffectString = Array.from({ length: 500 }, () => Math.round(Math.random())).join("");
		}, 100);

		const marqueeInterval = setInterval(() => {
			const textArray = Array.from(marqueeText);
			const lastEl = textArray.pop();
			textArray.unshift(lastEl);
			marqueeText = textArray.join("");
		}, 250);


		return () => {
			clearInterval(trackingExampleInterval);
			clearInterval(binaryChangeInterval);
			clearInterval(marqueeInterval);
		};
	});

	// Binary background
	const binaryEffectArray = Array(20).fill(0);
	let binaryEffectString = $state(Array.from({ length: 500 }, () => Math.round(Math.random())).join(""));

	// Retro marquee
	let marqueeText = $state("");
	let marqueeElement = $state();

	// Eye pupil movement
	let pupil = $state();
	let innerPupil = $state();

	function updateMarqueeText() {
		if (!marqueeElement) return;
		const width = marqueeElement.offsetWidth;
		const plusCount = Math.floor(width / 55); // Rough estimate for plus width
		const plus = "+".repeat(Math.max(1, plusCount));
		marqueeText = `${plus}Shockingly+++Private+++Devices${plus}`;
	}

	function handleMouseMove(e) {
		if (!pupil || !innerPupil) return;
		const eyeRect = pupil.closest('svg').getBoundingClientRect();
		const eyeCenterX = eyeRect.left + eyeRect.width / 2;
		const eyeCenterY = eyeRect.top + eyeRect.height * 0.5;
		const x = Math.max(38, Math.min(82, 60 + (e.clientX - eyeCenterX) * 0.01));
		const y = Math.max(33, Math.min(57, 45 + (e.clientY - eyeCenterY) * 0.005));

		pupil.setAttribute('cx', x); pupil.setAttribute('cy', y);
		innerPupil.setAttribute('cx', x); innerPupil.setAttribute('cy', y);
	}
</script>

<svelte:head>
	<title>ROOT - Private smart home devices</title>
</svelte:head>

<svelte:window onresize={updateMarqueeText} onmousemove={handleMouseMove} />

<section class="relative mb-20 flex h-155 w-full items-center justify-center">
	<img
		alt="privacy matters"
		src="/images/privacy-matters-placeholder.jpg"
		class="absolute inset-0 -z-1 h-full w-full border-b object-cover"
	/>
</section>

<section class="mb-20 flex border-y max-md:flex-wrap">
	<div class="min-w-2/3 space-y-4 border-r p-10">
		<h3 class="font-display text-3xl font-medium">More than capable.</h3>
		<p class="max-w-3/4">
			Privacy protects everyone, not just those with something to hide. It’s a basic human right, threatened the moment
			<span class="bg-neutral-100">monitoring becomes possible</span>.
		</p>
		<p class="max-w-3/4">
			Countless IoT devices <span class="bg-neutral-100">embrace this possibility by design</span>. They are capable of
			watching, listening, and exchanging information.
		</p>
	</div>
	<div class="relative flex min-w-1/3 flex-col justify-center overflow-hidden mask-y-from-75% mask-y-to-100% p-4">
		<svg viewBox="0 0 120 90" class="mx-auto">
			<defs>
				<clipPath id="eyeClip">
					<path d="M20 45 Q60 5 100 45 Q60 85 20 45 Z"/>
				</clipPath>
			</defs>
			<!-- Eye outline (much taller almond shape) -->
			<path d="M20 45 Q60 5 100 45 Q60 85 20 45 Z" fill="white" stroke="currentColor" stroke-width="1.5"/>
			<!-- Iris and Pupil with clipping -->
			<g clip-path="url(#eyeClip)">
				<!-- Iris (filled black) -->
				<circle bind:this={pupil} cx="60" cy="45" r="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" class="transition-all duration-500 ease-out"/>
				<!-- Pupil (white fill) -->
				<circle bind:this={innerPupil} cx="60" cy="45" r="8" fill="white" stroke="currentColor" stroke-width="1.5" class="transition-all duration-500 ease-out"/>
			</g>
			<!-- Eyelid for blinking -->
			<path d="M20 45 Q60 5 100 45 Q60 5 20 45 Z" fill="white" stroke="currentColor" stroke-width="1.5" class="animate-blink"/>
		</svg>
	</div>
</section>

<section class="mb-20 flex border-y max-md:flex-wrap">
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
		<h3 class="font-display text-3xl font-medium">Tracking, everywhere.</h3>
		<p class="max-w-3/4">Lorem Ipsum Ipsum Lorem Ipsum Lorem Ipsum Lorem Ipsum? Ipsum Lorem. Lorem Ipsum.</p>
		<p class="max-w-3/4">Lorem Ipsum Lorem Ipsum Lorem Ipsum. Lorem Ipsum! Lorem Ipsum Lorem Ipsum.</p>
	</div>
</section>

<section class="relative mb-20 flex w-full items-center justify-center overflow-hidden border-y py-30">
	<div class="absolute -inset-2.5 -z-1 bg-foreground select-none">
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
				Building smart home devices that are private out of the box, without sacrificing usability. Running on
				open-source software that is incapable of tracking users. Function &gt; form. No subscriptions. <span
					class="inline-block h-4 w-2 animate-flash bg-background align-middle"
				></span>
			</p>
		</div>
	</div>
</section>

<section class="mb-20 w-full border-y">
	<div class="relative w-full overflow-hidden">
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<a name="devices" class="h-0"></a>
		<h3 bind:this={marqueeElement} class="-ml-1.5 text-3xl whitespace-nowrap">
			{#each Array.from(marqueeText) as char}
				<span class:opacity-50={char === "+"}>{char}</span>
			{/each}
		</h3>
	</div>
	<div class="relative overflow-hidden border-t p-8 py-12">
		<p class="mb-1 w-fit bg-foreground px-0.5 text-background uppercase">Coming soon</p>
		<h3 class="mb-4 font-display text-3xl font-medium">Observer.</h3>
		<p>A home security camera with on-device AI vision.</p>
		<img
			src="/images/observer-simplified-line.svg"
			alt="observer illustration"
			class="absolute -top-2 right-5 h-100 w-100 opacity-20"
		/>
	</div>
</section>

<style>
	@keyframes blink {
		0%, 85%, 100% {
			d: path("M20 45 Q60 5 100 45 Q60 5 20 45 Z");
		}
		90%, 95% {
			d: path("M20 45 Q60 5 100 45 Q60 85 20 45 Z");
		}
	}

	:global(.animate-blink) {
		animation: blink 4s ease-in-out infinite;
	}
</style>
