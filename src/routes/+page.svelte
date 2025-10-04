<script>
	import { onMount, onDestroy } from "svelte";
	import { RiDeviceLine, RiTimeLine, RiComputerLine, RiCpuLine, RiTranslate2, RiCamera2Fill } from "svelte-remixicon";
	import { blur } from "svelte/transition";

	// User tracking example
	let exampleTrackingInfo = $state([]);
	let trackingExampleIndex = $state(0);

	// Dynamic eye grid
	let eyeGridElement = $state();
	let eyeCount = $state(70);

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
				text: `${window.screen.height}p`
			},
			{
				icon: RiTimeLine,
				text: Intl.DateTimeFormat().resolvedOptions().timeZone?.split("/")?.[1]
			},
			{
				icon: RiTranslate2,
				text: navigator.language?.toUpperCase()?.slice(0, 2)
			},
			{
				icon: RiCpuLine,
				text: `${navigator.hardwareConcurrency} cores`
			}
		];

		// Update marquee text based on width
		updateMarqueeText();

		// Update eye grid based on container size
		updateEyeGrid();

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

	function updateMarqueeText() {
		if (!marqueeElement) return;
		const width = marqueeElement.offsetWidth;
		const plusCount = Math.floor(width / 55); // Rough estimate for plus width
		const plus = "+".repeat(Math.max(1, plusCount));
		marqueeText = `${plus}Shockingly+++Private+++Devices${plus}`;
	}

	function updateEyeGrid() {
		if (!eyeGridElement) return;
		const containerWidth = eyeGridElement.parentElement.offsetWidth;
		const containerHeight = eyeGridElement.parentElement.offsetHeight;
		const eyeWidth = 48; // w-12 = 48px
		const eyeHeight = 32; // h-8 = 32px
		const gap = 8; // gap-2 = 8px

		const cols = Math.floor((containerWidth + gap) / (eyeWidth + gap));
		const rows = Math.floor((containerHeight + gap) / (eyeHeight + gap));

        // Update eye count and column count
		eyeCount = Math.min(120, cols * rows); // Cap at 120 eyes
		eyeGridElement.style.setProperty("--eye-grid-cols", cols.toString());
	}

	function handleEyePupilMouseMove(e) {
		for (let i = 0; i < eyeCount; i++) {
			const pupil = document.getElementById(`pupil-${i}`);
			const innerPupil = document.getElementById(`inner-pupil-${i}`);

			if (!pupil || !innerPupil) continue;

			const eyeRect = pupil.closest("svg").getBoundingClientRect();
			const eyeCenterX = eyeRect.left + eyeRect.width / 2;
			const eyeCenterY = eyeRect.top + eyeRect.height * 0.5;
			const x = Math.max(38, Math.min(82, 60 + (e.clientX - eyeCenterX) * 0.02));
			const y = Math.max(33, Math.min(57, 45 + (e.clientY - eyeCenterY) * 0.01));

			pupil.setAttribute("cx", x);
			pupil.setAttribute("cy", y);
			innerPupil.setAttribute("cx", x);
			innerPupil.setAttribute("cy", y);
		}
	}
</script>

<svelte:head>
	<title>ROOT - Private smart home devices</title>
</svelte:head>

<svelte:window
	onresize={() => {
		updateMarqueeText();
		updateEyeGrid();
	}}
	onmousemove={handleEyePupilMouseMove}
/>

<section class="relative mb-20 flex h-155 w-full items-center justify-center">
	<img
		alt="privacy matters"
		src="/images/privacy-matters-placeholder.jpg"
		class="pointer-events-none absolute inset-0 -z-1 h-full w-full border-b object-cover"
	/>
</section>

<section class="mb-20 flex border-y max-lg:flex-wrap">
	<div class="min-w-2/3 space-y-4 p-10 lg:border-r">
		<h3 class="font-display text-3xl font-medium">More than capable.</h3>
		<p class="max-w-150">
			Privacy protects everyone, not just those with something to hide. It’s a basic human right, threatened the moment
			<span class="bg-accent">monitoring becomes possible</span>.
		</p>
		<p class="max-w-150">
			Countless IoT devices <span class="bg-accent">embrace this possibility by design</span>. They are capable of
			watching, listening, and exchanging information.
		</p>
	</div>
	<div class="relative m-8 flex w-1/3 w-full flex-col justify-center overflow-hidden md:m-4">
		{#snippet eyeSnippet(id)}
			{@const pupilId = `pupil-${id}`}
			{@const innerPupilId = `inner-pupil-${id}`}
			<svg viewBox="15 0 120 90" class="h-8 w-12">
				<defs>
					<clipPath id="eyeClip{id}">
						<path d="M20 45 Q60 5 100 45 Q60 85 20 45 Z" />
					</clipPath>
				</defs>
				<!-- Eye outline -->
				<path d="M20 45 Q60 5 100 45 Q60 85 20 45 Z" fill="white" stroke="currentColor" stroke-width="3.5" />
				<!-- Iris and Pupil with clipping -->
				<g clip-path="url(#eyeClip{id})">
					<!-- Iris (filled black) -->
					<circle id={pupilId} cx="60" cy="45" r="18" fill="currentColor" stroke="currentColor" stroke-width="3.5" />
					<!-- Pupil (white fill) -->
					<circle id={innerPupilId} cx="60" cy="45" r="8" fill="white" stroke="currentColor" stroke-width="3.5" />
				</g>
				<!-- Eyelid for blinking -->
				<path
					d="M20 45 Q60 5 100 45 Q60 5 20 45 Z"
					fill="white"
					stroke="currentColor"
					stroke-width="1.5"
					class="animate-blink"
					style="animation-delay: {Math.random() * 8}s"
				/>
			</svg>
		{/snippet}

		<div bind:this={eyeGridElement} class="eye-grid -mr-3 grid gap-2">
			{#each Array(eyeCount) as _, i}
				{@render eyeSnippet(i)}
			{/each}
		</div>
	</div>
</section>

<section class="mb-20 flex border-y max-lg:flex-wrap-reverse">
	<div
		class="relative flex min-h-60 w-full min-w-1/3 flex-col justify-center overflow-hidden mask-y-from-75% mask-y-to-100%"
	>
		<div
			class="absolute inset-0 max-xl:ml-15 transition-transform duration-700 ease-in-out xl:mx-20"
			style:transform="translateY({trackingExampleIndex * -60 + 40}px)"
		>
			{#each exampleTrackingInfo as info, i}
				<div
					class="flex h-18 items-center gap-3 text-4xl transition duration-700 2xl:text-5xl"
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
	<div class="min-w-2/3 space-y-4 p-10 lg:border-l">
		<h3 class="font-display text-3xl font-medium">Why it matters now.</h3>
		<p class="max-w-150">
			Fewer companies control more of our digital lives. From web services to smart home, connecting the dots with
			algorithms and artifical intelligence allows for creating <span class="bg-accent"
				>super accurate profiles</span
			>.
		</p>
		<p class="max-w-150">
			As political landscapes shift, the question isn't just who can access your data today, but <span
				class="bg-accent">who might access it tomorrow</span
			>. Privacy is about preparation.
		</p>
	</div>
</section>

<section class="relative mb-20 flex w-full items-center justify-center overflow-hidden border-y py-30">
	<div class="absolute -inset-2.5 -z-1 bg-foreground select-none">
		{#each binaryEffectArray as row, index}
			<p class="w-full text-lg font-thin text-background" style:opacity={0.5 - 0.05 * index}>
				{binaryEffectString?.slice(Math.floor(Math.random() * 100))}
			</p>
		{/each}
	</div>
	<div class="flex flex-col items-center justify-between gap-8">
		<a class="p-8 font-display text-7xl font-medium text-background uppercase scroll-mt-50" name="mission">The mission.</a>
		<div class="w-9/10 border p-4 lg:w-2/3">
			<p class="text-background">
				Building smart home devices that are private out of the box, without sacrificing usability. Running on
				open-source software that is unable to track users. <span
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
				<span class:text-muted-foreground={char === "+"}>{char}</span>
			{/each}
		</h3>
	</div>
	<div class="relative overflow-hidden border-t p-8 py-12">
		<p class="mb-1 w-fit bg-foreground px-0.5 text-background uppercase">Coming soon</p>
		<h3 class="mb-4 font-display text-3xl font-medium">Observer.</h3>
		<p class="lg:max-w-1/2">A home security camera with on-device AI vision.</p>
		<img
			src="/images/observer-simplified-line.svg"
			alt="observer illustration"
			class="pointer-events-none -top-2 right-0 -z-1 h-100 w-100 opacity-20 max-lg:-mb-35 lg:absolute"
		/>
	</div>
</section>

<style>
	@keyframes blink {
		0%,
		95%,
		100% {
			d: path("M20 45 Q60 5 100 45 Q60 5 20 45 Z");
		}
		97%,
		98% {
			d: path("M20 45 Q60 5 100 45 Q60 85 20 45 Z");
		}
	}

	:global(.animate-blink) {
		animation: blink 8s ease-in-out infinite;
	}

	.eye-grid {
		grid-template-columns: repeat(var(--eye-grid-cols, 10), minmax(0, 1fr));
	}
</style>
