<script>
	import { handlePointerMove, resetPointerMove } from "$lib/utils/trackPointer";
</script>

<svelte:head>
	<title>About</title>
</svelte:head>

<div class="mt-20 flex h-14 w-full items-center justify-center gap-5 border-y">
	<img src="/images/flag-of-europe-black.svg" alt="EU flag" class="h-12 w-12" />
	<p>Based in the EU</p>
</div>

<section class="relative mb-20 mt-10 flex w-full items-center justify-center gap-8 overflow-hidden border-y max-xl:flex-wrap">
	<div class="w-full space-y-4 p-6 xl:p-8">
		<h1 class="font-display text-3xl font-medium">About me</h1>
		<p>
			Working on web games by day, and on Root by night, I am persuing my <span class="bg-accent"
				>dream of creating smart home devices</span
			>
			– starting with the Observer – that <span class="bg-accent">respect user privacy</span>.
		</p>
		<p>
			While I was going all-in on privacy (Modded LineageOS on my phone, tracker-blocking firewall...) a couple years
			ago, I no longer have the time to tinker with my tools – they <span class="bg-accent">need to just work</span>.
			That's my goal with Root: Privacy without sacrificing the user experience.
		</p>
	</div>
	<div
		class="hover-reveal aspect-square h-full w-full max-xl:border-t xl:border-l"
		onpointermove={handlePointerMove}
		onpointerleave={resetPointerMove}
		role="img"
	>
		<img alt="Paul" src="/images/about-image.jpg" class="absolute h-full w-full object-cover not-hover:grayscale" />
	</div>
</section>

<style>
	.hover-reveal {
		position: relative;
	}

	.hover-reveal::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image: url("/images/about-image.jpg");
		background-size: contain;
		filter: grayscale();
		opacity: 1;
		pointer-events: none;
		transition: all 0.3s ease;
		z-index: 1;
	}

	.hover-reveal:hover::after {
		mask: radial-gradient(circle 80px at var(--pointer-x, -200px) var(--pointer-y, -200px), transparent 0%, black 100%);
		-webkit-mask: radial-gradient(
			circle 550px at var(--pointer-x, -200px) var(--pointer-y, -200px),
			transparent 0%,
			rgba(0, 0, 0, 0.9) 75%,
			black 100%
		);
	}
</style>
