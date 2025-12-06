<script>
	import { onMount, onDestroy } from "svelte";
	import { RiDeviceLine, RiTimeLine, RiComputerLine, RiCpuLine, RiTranslate2, RiCamera2Fill } from "svelte-remixicon";
	import { blur } from "svelte/transition";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Carousel from "$lib/components/ui/carousel";

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

		// Delay to ensure DOM is ready
		setTimeout(() => {
			updateMarqueeText(); // Update marquee text based on width
			updateEyeGrid(); // Update eye grid based on container size
		}, 0);

		// Start the auto-rotation timer
		const trackingExampleInterval = setInterval(() => {
			if (trackingExampleIndex < exampleTrackingInfo.length - 1) trackingExampleIndex++;
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
	let lastMarqueeWidth = $state(0);

	function updateMarqueeText() {
		if (!marqueeElement) return;
		const width = marqueeElement.offsetWidth;

		// Only update if width actually changed
		if (width === lastMarqueeWidth) return;
		lastMarqueeWidth = width;

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
		eyeCount = Math.min(42, cols * rows); // Cap at 120 eyes
		eyeGridElement.style.setProperty("--eye-grid-cols", cols.toString());
	}

	function handleEyePupilPointerMove(e) {
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

	const privacyIssueArticleSnippets = [
		{
			text: "Eufy failed to encrypt some video streams and made private home footage accessible to unauthenticated users.",
			source:
				"https://ag.ny.gov/press-release/2025/attorney-general-james-secures-450000-companies-selling-home-security-cameras?utm_source=chatgpt.com",
			sourceName: "NY AG"
		},
		{
			text: "Ring let employees or contractors view private user videos and allowed hackers to take control of users’ accounts.",
			source:
				"https://consumer.ftc.gov/consumer-alerts/2023/05/rings-privacy-failures-led-spying-and-harassment-through-home-security-cameras?page=0&utm_source=chatgpt.com",
			sourceName: "FTC"
		},
		{
			text: "Wyze exposed thumbnails and video previews allowing some customers to see other people’s recordings.",
			source: "https://edition.cnn.com/2024/02/20/tech/wyze-breach-camera/index.html?utm_source=chatgpt.com",
			sourceName: "CNN"
		}
	];
</script>

<svelte:head>
	<title>ROOT - Private home security cameras</title>
</svelte:head>

<svelte:window
	onresize={() => {
		updateMarqueeText();
		updateEyeGrid();
	}}
	onpointermove={handleEyePupilPointerMove}
/>

<section class="relative mb-20 flex h-100 w-full items-center justify-center lg:h-125 xl:h-155">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		loop
		playsinline
		autoplay
		muted
		class="pointer-events-none absolute inset-0 -z-1 h-full w-full border-b bg-foreground object-cover"
		style="object-position: 30% center;"
	>
		<source
			src="https://paulplay-storage-1.fra1.digitaloceanspaces.com/misc/camera-chair-video-crop.mp4"
			type="video/mp4"
		/>
	</video>
</section>

<section class="mb-20 flex border-y max-lg:flex-wrap">
	<div class="min-w-2/3 space-y-4 p-6 lg:border-r lg:p-8">
		<h3 class="font-display text-3xl font-medium tracking-wide">Built for privacy.</h3>
		<p class="max-w-150">
			Privacy protects everyone. It’s a basic human right, <span class="bg-accent"
				>threatened the moment monitoring becomes possible</span
			>.
		</p>
		<p class="max-w-150">
			Unlike most smart home cameras, <span class="bg-accent">Root products ensure only you can access</span> video, audio
			and sensor data using end-to-end encryption and a local-first architecture.
		</p>
		<Dialog.Root>
			<Dialog.Trigger class="text-start text-muted-foreground hover:underline"
				>&gt; I have nothing to hide – why should I care?</Dialog.Trigger
			>
			<Dialog.Content class="w-full max-w-250!">
				<Dialog.Header>
					<Dialog.Title>This is why you should.</Dialog.Title>
				</Dialog.Header>
				<iframe
					class="aspect-video w-full"
					src="https://www.youtube.com/embed/pcSlowAhvUk?si=Bv0q3nb1OqOsj9Hh"
					title="YouTube video player"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerpolicy="strict-origin-when-cross-origin"
					allowfullscreen
				></iframe>
			</Dialog.Content>
		</Dialog.Root>
	</div>
	<div class="relative m-6 flex w-1/3 w-full flex-col justify-center overflow-hidden max-lg:max-h-30">
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
				<path
					d="M20 45 Q60 5 100 45 Q60 85 20 45 Z"
					fill="var(--background)"
					stroke="currentColor"
					stroke-width="3.5"
				/>
				<!-- Iris and Pupil with clipping -->
				<g clip-path="url(#eyeClip{id})">
					<!-- Iris (filled black) -->
					<circle id={pupilId} cx="60" cy="45" r="18" fill="currentColor" stroke="currentColor" stroke-width="3.5" />
					<!-- Pupil -->
					<circle
						id={innerPupilId}
						cx="60"
						cy="45"
						r="8"
						fill="var(--background)"
						stroke="currentColor"
						stroke-width="3.5"
					/>
				</g>
				<!-- Eyelid for blinking -->
				<path d="M20 45 Q60 5 100 45 Q60 5 20 45 Z" fill="var(--background)" stroke="currentColor" stroke-width="1.5">
					<animate
						attributeName="d"
						values="M20 45 Q60 5 100 45 Q60 5 20 45 Z;
								M20 45 Q60 5 100 45 Q60 5 20 45 Z;
								M20 45 Q60 5 100 45 Q60 85 20 45 Z;
								M20 45 Q60 5 100 45 Q60 5 20 45 Z"
						keyTimes="0; 0.95; 0.98; 1"
						dur="8s"
						repeatCount="indefinite"
						begin="{Math.random() * 16 - 8}s"
					/>
				</path>
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
			class="absolute inset-0 transition-transform duration-700 ease-in-out max-xl:ml-15 xl:mx-20"
			style:transform="translateY({trackingExampleIndex * -60 + 30}px)"
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
	<div class="min-w-2/3 space-y-4 p-6 lg:border-l lg:p-8">
		<h3 class="font-display text-3xl font-medium tracking-wide">Why it matters now.</h3>
		<p class="max-w-150">
			Large tech corporations collect huge amounts of user information to <span class="bg-accent"
				>piece together accurate profiles</span
			>.
		</p>
		<p class="max-w-150">
			As political landscapes shift, the question isn't just who can access this data today, but <span class="bg-accent"
				>who might access it tomorrow</span
			>. Privacy is about preparation.
		</p>
	</div>
</section>

<section class="relative mb-20 border-y lg:p-8 p-6">
	<div class="mb-6 text-center">
		<h3 class="font-display text-3xl font-medium tracking-wide">Don't give up control.</h3>
	</div>
	<!-- Articles about data breaches affecting security cameras -->
	<div class="px-10">
		<Carousel.Root>
			<Carousel.Content>
				{#each privacyIssueArticleSnippets as item}
					<Carousel.Item class="min-w-50 lg:basis-5/11">
						<div class="flex h-full flex-col border bg-accent p-4">
							<p class="italic">
								"{item.text}" -
								<a target="_blank" class="not-italic hover:underline" href={item.source}>{item.sourceName}</a>
							</p>
						</div>
					</Carousel.Item>
				{/each}
			</Carousel.Content>
			<Carousel.Previous />
			<Carousel.Next />
		</Carousel.Root>
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
		<a class="scroll-mt-50 px-6 py-8 font-display text-7xl font-medium text-background uppercase" name="mission"
			>The mission</a
		>
		<div class="w-18/20 border p-4 lg:w-2/3">
			<p class="text-background">
				Building smart home devices that are private out of the box, without sacrificing usability. Based on secure and
				intelligent open-source software. <span class="inline-block h-4 w-2 animate-flash bg-background align-middle"
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
	<div class="relative overflow-hidden border-t px-6 py-12 lg:px-8">
		<p class="mb-1 w-fit bg-foreground px-0.5 text-background uppercase">Coming soon</p>
		<h3 class="mb-4 font-display text-3xl font-medium tracking-wide">Observer</h3>
		<p class="lg:max-w-1/2">An indoor security camera with on-device AI vision.</p>
		<img
			src="/images/home/observer-simplified-line.svg"
			alt="observer illustration"
			class="pointer-events-none -top-2 right-0 -z-1 h-100 w-100 opacity-20 max-lg:-mb-35 lg:absolute"
		/>
	</div>
</section>

<style>
	.eye-grid {
		grid-template-columns: repeat(var(--eye-grid-cols, 10), minmax(0, 1fr));
	}
</style>
