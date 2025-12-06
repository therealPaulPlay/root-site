<script>
	import { page } from "$app/state";
	import { slide } from "svelte/transition";
	import Button from "./ui/button/button.svelte";
	import { RiCircleFill, RiCloseLargeLine, RiCornerDownRightLine, RiMenuLine } from "svelte-remixicon";
	import { afterNavigate } from "$app/navigation";
	import { handlePointerMove, resetPointerMove } from "$lib/utils/trackPointer";

	const navigationEntries = [
		{
			name: "Home",
			href: "/",
			anchors: [
				{ name: "Mission", anchor: "#mission" },
				{ name: "Devices", anchor: "#devices" }
			]
		},
		{ name: "About", href: "/about" },
		{ name: "Connect", href: "/connect" }
	];

	// Hide navbar after navigation instead of immediately to prevent flash of old page
	afterNavigate(() => {
		showMobileNavbar = false;
	});

	let showMobileNavbar = $state(false);
</script>

<div class="fixed top-0 right-0 z-100 text-xl sm:hidden pointer-events-none" class:hidden={showMobileNavbar}>
	<Button
		class="h-20! p-6! pointer-events-auto"
		onclick={() => {
			showMobileNavbar = true;
		}}
	>
		<RiMenuLine class="h-8! w-8! shape-crisp" />
	</Button>
</div>

<aside
	class="no-scrollbar of-top of-bottom of-length-2 sticky top-0 flex h-screen w-50 flex-col overflow-y-auto bg-background max-sm:fixed max-sm:w-full max-sm:mask-none! sm:mr-15 sm:border-x"
	class:max-sm:hidden={!showMobileNavbar}
	class:z-99={showMobileNavbar}
>
	<div class="relative flex min-h-20 justify-center border-b">
		<img src="/images/logo.svg" class="h-auto w-30" alt="logo" />
		{#if showMobileNavbar}
			<Button
				class="absolute top-0 right-0 ml-auto h-20! border-t-0! border-r-0! p-6! sm:hidden"
				variant="outline"
				onclick={() => {
					showMobileNavbar = false;
				}}
			>
				<RiCloseLargeLine class="h-8! w-8!" />
			</Button>
		{/if}
	</div>
	<div class="hover-reveal" onpointermove={handlePointerMove} onpointerleave={resetPointerMove} role="img">
		<img src="/images/navbar/grainy-tech-dots-1.jpg" class="pointer-events-none h-30 w-full object-cover" alt="grainy tech" />
	</div>
	<nav class="flex flex-col items-start gap-2 border-y py-4">
		{#each navigationEntries as entry}
			<div class="flex w-full flex-col">
				<!-- Sites -->
				<Button
					href={entry.href}
					variant="link"
					class="w-full {page.url.pathname == entry.href ? 'bg-foreground text-background' : ''}"
				>
					{entry.name}</Button
				>
				<!-- Available anchors for current site -->
				{#if page.url.pathname == entry.href && entry.anchors?.length}
					<div transition:slide>
						{#each entry.anchors as subEntry}
							<Button
								href={entry.href + subEntry.anchor}
								variant="link"
								class="w-full bg-accent pl-1"
								onclick={() => {
									showMobileNavbar = false;
								}}
							>
								<RiCornerDownRightLine />{subEntry.name}</Button
							>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</nav>
	<div class="hover-reveal" onpointermove={handlePointerMove} onpointerleave={resetPointerMove} role="img">
		<img src="/images/navbar/grainy-tech-dots-2.jpg" class="pointer-events-none h-30 w-full object-cover" alt="grainy tech" />
	</div>
	<div class="relative min-h-160 border-y">
		<div class="absolute inset-0 overflow-hidden">
			<div class="absolute -inset-50 flex -rotate-25 flex-col gap-2 bg-background text-neutral-300 select-none">
				{#each Array(30) as _, i}
					{@const words = ["REPAIRABILITY", "OPEN SOURCE", "SECURITY", "PRIVACY", "ROOT ACCESS", "FULL OWNERSHIP"]}
					{@const word = words[i % words.length]}
					<div class="flex gap-[1ch] whitespace-nowrap">
						<div class="scroll-line" style="animation-duration: {150 + (i % 3) * 30}s">
							{#each Array(10) as _}
								{word + " "}
							{/each}
						</div>
						<div class="scroll-line" style="animation-duration: {150 + (i % 3) * 30}s" aria-hidden="true">
							{#each Array(10) as _}
								{word + " "}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
	<div class="hover-reveal border-b" onpointermove={handlePointerMove} onpointerleave={resetPointerMove} role="img">
		<img src="/images/navbar/grainy-tech-dots-3.jpg" class="pointer-events-none h-30 w-full object-cover" alt="grainy tech" />
	</div>
	<div class="flex justify-center p-4">
		<Button href="/source-code" variant="link" class="text-wrap"
			>Source code</Button
		>
	</div>
</aside>

<style>
	.hover-reveal {
		position: relative;
		touch-action: none; /* disable scrolling on here */
	}

	.hover-reveal::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--background);
		opacity: 1;
		pointer-events: none;
		transition: all 0.3s ease;
		z-index: 1;
	}

	.hover-reveal:hover::after {
		mask: radial-gradient(circle 80px at var(--pointer-x, -200px) var(--pointer-y, -200px), transparent 0%, black 100%);
		-webkit-mask: radial-gradient(
			circle 150px at var(--pointer-x, -200px) var(--pointer-y, -200px),
			transparent 0%,
			rgba(0, 0, 0, 0.9) 75%,
			black 100%
		);
	}

	.scroll-line {
		animation: scroll 20s linear infinite;
	}

	@keyframes scroll {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(1ch);
		}
	}
</style>
