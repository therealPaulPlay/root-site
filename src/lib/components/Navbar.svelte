<script>
	import { page } from "$app/state";
	import { slide } from "svelte/transition";
	import Button from "./ui/button/button.svelte";
	import { RiCircleFill, RiCloseLargeLine, RiCornerDownRightLine, RiMenuLine } from "svelte-remixicon";

	const navigationEntries = [
		{
			name: "Home",
			href: "/",
			anchors: [
				{ name: "Mission", anchor: "#mission" },
				{ name: "Devices", anchor: "#devices" }
			]
		},
		{ name: "Connect", href: "/connect" }
	];

	function handlePointerMove(event) {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		event.currentTarget.style.setProperty("--pointer-x", `${x}px`);
		event.currentTarget.style.setProperty("--pointer-y", `${y}px`);
	}

	function resetPointerMove() {
		event.currentTarget.style.setProperty("--pointer-x", `-1000px`);
		event.currentTarget.style.setProperty("--pointer-y", `-1000px`);
	}

	let showMobileNavbar = $state(false);
</script>

<div class="fixed top-0 z-100 w-full text-end text-xl sm:hidden" class:hidden={showMobileNavbar}>
	<Button
		class="h-20! p-6!"
		onclick={() => {
			showMobileNavbar = true;
		}}
	>
		<RiMenuLine class="h-8! w-8!" />
	</Button>
</div>

<aside
	class="no-scrollbar of-top of-bottom of-length-2 sticky top-0 z-99 flex h-screen w-50 flex-col overflow-y-auto bg-background max-sm:fixed max-sm:w-full max-sm:mask-none! sm:mr-15 sm:border-x"
	class:max-sm:hidden={!showMobileNavbar}
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
		<img src="/images/grainy-tech-dots-1.jpg" class="pointer-events-none h-30 w-full object-cover" alt="grainy tech" />
	</div>
	<nav class="flex flex-col items-start gap-2 border-y py-4">
		{#each navigationEntries as entry}
			<div class="flex w-full flex-col">
				<Button
					href={entry.href}
					variant="link"
					class="w-full {page.url.pathname == entry.href ? 'bg-foreground text-background' : ''}"
					onclick={() => {
						showMobileNavbar = false;
					}}
				>
					{entry.name}</Button
				>
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
		<img src="/images/grainy-tech-dots-2.jpg" class="pointer-events-none h-30 w-full object-cover" alt="grainy tech" />
	</div>
	<div class="space-y-4 border-y p-4 py-6">
		<h3><span class="align-[2px] text-xs">//</span> Philosophy</h3>
		<p>
			<i>Root</i>, as in <span class="bg-accent">root-access</span>, is about building unrestricted smart home devices
			that purely serve their owner.
		</p>
		<p>
			<span class="bg-accent">Privacy is the foundation</span> of every design decision and all firmware is
			<span class="bg-accent">open-source</span>.
		</p>
		<p>Modify, repair and utilize a Root smart home device however you intend.</p>
	</div>
	<div class="hover-reveal border-b" onpointermove={handlePointerMove} onpointerleave={resetPointerMove} role="img">
		<img src="/images/grainy-tech-dots-3.jpg" class="pointer-events-none h-30 w-full object-cover" alt="grainy tech" />
	</div>
	<div class="flex justify-center p-4">
		<Button href="https://github.com/therealPaulPlay/root-site" variant="link" target="_blank" class="text-wrap"
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
</style>
