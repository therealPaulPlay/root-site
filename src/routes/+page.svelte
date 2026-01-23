<script>
	import { onMount, onDestroy } from "svelte";
	import {
		RiDeviceLine,
		RiTimeLine,
		RiComputerLine,
		RiCpuLine,
		RiTranslate2,
		RiCamera2Fill,
		RiCamera2Line,
		RiServerLine,
		RiSmartphoneLine
	} from "svelte-remixicon";
	import { blur } from "svelte/transition";
	import Button from "$lib/components/ui/button/button.svelte";
	import { decryptTextEffect } from "$lib/utils/decryptTextEffect.js";
	import * as Carousel from "$lib/components/ui/carousel";
	import Label from "$lib/components/ui/label/label.svelte";

	// User tracking example
	let exampleTrackingInfo = $state([]);
	let trackingExampleIndex = $state(0);

	// Dynamic eye grid
	let eyeGridElement = $state();
	let eyeGrid = $state({ cols: 0, rows: 0, gapX: 0, gapY: 0 });
	let eyeCount = $derived(eyeGrid.cols * eyeGrid.rows);
	let lastMousePosition = $state({ x: 0, y: 0 });

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
		requestAnimationFrame(() => {
			updateMarqueeText();
			updateEyeGrid();
		});

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
	const binaryEffectLineCount = 20;
	const binaryEffectArray = Array(binaryEffectLineCount).fill(0);
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
		marqueeText = `${plus}Shockingly+++Private+++Products${plus}`;
	}

	// Eye grid calculation
	const EYE_SIZE = { w: 48, h: 32, minGap: 8 };

	function updateEyeGrid() {
		if (!eyeGridElement) return;
		const { clientWidth: w, clientHeight: h } = eyeGridElement.parentElement;
		const { w: ew, h: eh, minGap } = EYE_SIZE;

		const cols = Math.floor((w + minGap) / (ew + minGap));
		const rows = Math.floor((h + minGap) / (eh + minGap));

		eyeGrid = {
			cols,
			rows,
			gapX: cols > 1 ? (w - cols * ew) / (cols - 1) : 0,
			gapY: rows > 1 ? (h - rows * eh) / (rows - 1) : 0
		};
	}

	function updateEyePupils(clientX, clientY) {
		for (let i = 0; i < eyeCount; i++) {
			const pupil = document.getElementById(`pupil-${i}`);
			const innerPupil = document.getElementById(`inner-pupil-${i}`);

			if (!pupil || !innerPupil) continue;

			const eyeRect = pupil.closest("svg").getBoundingClientRect();
			const eyeCenterX = eyeRect.left + eyeRect.width / 2;
			const eyeCenterY = eyeRect.top + eyeRect.height * 0.5;
			const x = Math.max(38, Math.min(82, 60 + (clientX - eyeCenterX) * 0.02));
			const y = Math.max(33, Math.min(57, 45 + (clientY - eyeCenterY) * 0.01));

			pupil.setAttribute("cx", x);
			pupil.setAttribute("cy", y);
			innerPupil.setAttribute("cx", x);
			innerPupil.setAttribute("cy", y);
		}
	}

	const privacyIssueArticleSnippets = [
		{
			text: "Eufy failed to encrypt a portion of video streams and made private home footage accessible to unauthenticated users.",
			source:
				"https://ag.ny.gov/press-release/2025/attorney-general-james-secures-450000-companies-selling-home-security-cameras?utm_source=chatgpt.com",
			sourceName: "NY AG"
		},
		{
			text: "Ring let employees or contractors view private user videos and enabled hackers to take control of users’ personal accounts.",
			source:
				"https://consumer.ftc.gov/consumer-alerts/2023/05/rings-privacy-failures-led-spying-and-harassment-through-home-security-cameras?page=0&utm_source=chatgpt.com",
			sourceName: "FTC"
		},
		{
			text: "Wyze exposed thumbnails and video previews allowing a percentage of customers to see recordings from other users.",
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
	onpointermove={(e) => {
		lastMousePosition = { x: e.clientX, y: e.clientY };
		updateEyePupils(e.clientX, e.clientY);
	}}
	onscroll={() => updateEyePupils(lastMousePosition.x, lastMousePosition.y)}
/>

<section class="relative mb-20 flex h-125 w-full items-center justify-center border-b xl:h-155">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		loop
		playsinline
		autoplay
		muted
		class="pointer-events-none absolute inset-0 -z-1 h-full w-full bg-foreground object-cover"
		style="object-position: 30% center;"
	>
		<source
			src="https://paulplay-storage-1.fra1.digitaloceanspaces.com/misc/camera-chair-video-crop.mp4"
			type="video/mp4"
		/>
	</video>
	<div class="absolute right-0 bottom-0 left-0 p-8 pb-10 lg:p-10 lg:pb-12">
		<!-- Black fade and slight blur -->
		<div class="absolute inset-0 -z-1 h-full w-full bg-foreground mask-t-from-0%"></div>
		<div class="absolute inset-0 -z-1 h-full w-full bg-foreground/25 mask-t-from-70% backdrop-blur-lg"></div>
		<!-- Hero text container -->
		<div class="z-2 max-w-xl space-y-4">
			<h3
				class="text-5xl leading-12.5 text-background lg:text-nowrap"
				{@attach decryptTextEffect("Privacy, redefined.")}
			>
				Privacy, redefined.
			</h3>
			<p class="max-w-lg text-pretty text-background">
				The ROOT Observer rethinks security cameras with cryptographically guaranteed privacy.
			</p>
			<Button
				size="lg"
				class="mt-2 bg-background text-foreground hover:bg-background/80 hover:text-foreground"
				href="https://tally.so/r/NpXY1N"
				target="_blank">Email waitlist</Button
			>
		</div>
	</div>
</section>

<section class="mb-20 flex border-y max-lg:flex-wrap">
	<div class="min-w-2/3 space-y-4 p-6 lg:border-r lg:p-8">
		<h3 class="text-3xl">Keeping you safe.</h3>
		<p class="max-w-150">
			Privacy protects everyone. It’s a basic human right, <span class="bg-accent"
				>threatened the moment monitoring becomes possible</span
			>.
		</p>
		<p class="max-w-150">
			Unlike most smart home cameras, <span class="bg-accent">ROOT products ensure only you can access</span> video, audio
			and sensor data using end-to-end encryption and a local-first architecture.
		</p>
	</div>
	<div class="relative m-6 min-h-35 flex-1 overflow-hidden max-lg:h-30 lg:m-8">
		{#snippet eyeSnippet(id)}
			{@const pupilId = `pupil-${id}`}
			{@const innerPupilId = `inner-pupil-${id}`}
			<svg viewBox="0 0 120 90" class="h-8 w-12">
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

		<div
			bind:this={eyeGridElement}
			class="absolute inset-0 grid"
			style:grid-template-columns="repeat({eyeGrid.cols}, {EYE_SIZE.w}px)"
			style:column-gap="{eyeGrid.gapX}px"
			style:row-gap="{eyeGrid.gapY}px"
		>
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
			class="absolute inset-0 ml-10 transition-transform duration-700 ease-in-out xl:ml-15"
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
		<h3 class="text-3xl">Why it matters.</h3>
		<p class="max-w-150">
			Large tech corporations collect huge amounts of user information to <span class="bg-accent"
				>piece together accurate profiles</span
			>.
		</p>
		<p class="max-w-150">
			As political landscapes shift, the question isn't who can access this data today, but <span class="bg-accent"
				>who might access it tomorrow</span
			>. Privacy is about preparation.
		</p>
	</div>
</section>

<section class="relative mb-20 border-y p-6 pb-8! lg:p-8">
	<div class="mb-6 text-center">
		<h3 class="text-3xl">Others can't be trusted.</h3>
	</div>
	<!-- Articles about data breaches affecting security cameras -->
	<div class="px-10">
		<Carousel.Root>
			<Carousel.Content class="gap-6">
				{#each privacyIssueArticleSnippets as item}
					<Carousel.Item class="max-w-105 min-w-50 lg:basis-5/11">
						<div class="flex h-full flex-col border bg-accent p-4">
							<p class="text-foreground/65">
								<span class="text-foreground">{item.text?.split(" ")?.[0]}</span>
								{item.text?.split(" ")?.slice(1)?.join(" ")} -
								<a target="_blank" class="hover:underline" href={item.source}>{item.sourceName}</a>
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
			<p class="w-full text-lg font-thin text-background" style:opacity={0.5 - (1 / binaryEffectLineCount) * index}>
				{binaryEffectString?.slice(Math.floor(Math.random() * 100))}
			</p>
		{/each}
	</div>
	<div class="flex flex-col items-center justify-between gap-6">
		<a class="scroll-mt-50 px-6 py-8 font-display text-7xl font-medium text-background uppercase" name="mission"
			>The mission</a
		>
		<div class="mx-6 border p-4 lg:w-3/5">
			<p class="text-background">
				Building home security cameras that are private out of the box and effortless to use. Based on secure and
				intelligent open-source software. <span class="inline-block h-4 w-2 animate-flash bg-background align-middle"
				></span>
			</p>
		</div>
	</div>
</section>

<section class="mb-20 flex border-y max-xl:flex-wrap-reverse">
	<!-- Architecture diagram (left side) -->
	{#snippet productBox(Icon, label)}
		<div class="flex flex-col items-center gap-2">
			<div class="flex size-20 items-center justify-center border bg-background sm:size-24 lg:size-28">
				<Icon class="size-8 sm:size-10 lg:size-12" />
			</div>
			<Label class="h-10 max-w-20 text-center leading-5 text-wrap">{label}</Label>
		</div>
	{/snippet}
	{#snippet lanes(delayOffset = 0)}
		<div class="flex flex-1 flex-col justify-center gap-3 self-stretch overflow-hidden pb-12">
			<div class="relative h-px w-full bg-border">
				<div
					class="packet-right absolute top-1/2 h-2 w-6 -translate-y-1/2 border bg-background"
					style="animation-delay: {delayOffset}s"
				></div>
			</div>
			<div class="relative h-px w-full bg-border">
				<div
					class="packet-left absolute top-1/2 right-0 h-2 w-6 -translate-y-1/2 border bg-background"
					style="animation-delay: {delayOffset + 0.5}s"
				></div>
			</div>
		</div>
	{/snippet}
	<div class="my-auto w-1/2 p-8 max-xl:w-full xl:mx-6 2xl:mx-8">
		<div class="flex items-start">
			{@render productBox(RiSmartphoneLine, "Your device")}
			{@render lanes(0)}
			{@render productBox(RiServerLine, "Stateless Relay")}
			{@render lanes(0.3)}
			{@render productBox(RiCamera2Line, "ROOT product")}
		</div>
	</div>

	<!-- Text content (right side) -->
	<div class="min-w-1/2 space-y-4 p-6 lg:p-8 xl:border-l">
		<h3 class="text-3xl">A secure architecture.</h3>
		<p class="max-w-130">
			All data is end-to-end encrypted with forward secrecy to ensure <span class="bg-accent"
				>past messages stay secure even if keys are compromised.</span
			>
		</p>
		<p class="max-w-130">
			Recordings are stored locally and streamed on-demand, making them accessible from anywhere in the world with no
			cloud storage required.
		</p>
	</div>
</section>

<section class="mb-20 w-full border-y">
	<div class="relative w-full overflow-hidden">
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<a name="products" class="h-0"></a>
		<h3 bind:this={marqueeElement} class="-ml-1.5 text-3xl whitespace-nowrap">
			{#each Array.from(marqueeText) as char}
				<span class:text-muted-foreground={char === "+"}>{char}</span>
			{/each}
		</h3>
	</div>
	<div class="relative overflow-hidden border-t px-6 py-12 lg:px-8">
		<p class="mb-1 w-fit bg-foreground px-1 font-medium text-background uppercase">Coming soon</p>
		<h3 class="mb-4 text-3xl">Observer</h3>
		<p class="lg:max-w-1/2">Intelligent indoor security camera with AI vision.</p>
		<img
			src="/images/home/observer-simplified-line.svg"
			alt="observer illustration"
			class="pointer-events-none -top-2 right-0 -z-1 h-100 w-100 opacity-20 max-lg:-mb-35 lg:absolute"
		/>
	</div>
</section>

<style>
	.packet-right {
		animation: slide-right 2s linear infinite;
	}
	.packet-left {
		animation: slide-left 2s linear infinite;
	}

	@keyframes slide-right {
		0% {
			left: -1.5rem;
		}
		100% {
			left: calc(100% + 1.5rem);
		}
	}
	@keyframes slide-left {
		0% {
			right: -1.5rem;
		}
		100% {
			right: calc(100% + 1.5rem);
		}
	}
</style>
