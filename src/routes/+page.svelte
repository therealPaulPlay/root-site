<script>
	import { onMount } from "svelte";
	import { RiDeviceLine, RiTimeLine, RiComputerLine, RiCpuLine, RiTranslate2 } from "svelte-remixicon";
	import { blur } from "svelte/transition";

	let exampleTrackingInfo = [];

	onMount(() => {
		exampleTrackingInfo = [
			{
				icon: RiDeviceLine,
				text: navigator.platform
			},
			{
				icon: RiComputerLine,
				text: `${window.screen.width}x${window.screen.height}`
			},
			{
				icon: RiTimeLine,
				text: Intl.DateTimeFormat().resolvedOptions().timeZone
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
	<h1 class="font-display text-7xl font-medium text-background">Privacy matters.</h1>
</section>

<section class="flex border-y max-md:flex-wrap">
	<div class="flex min-w-1/3 flex-col justify-between border-r p-4">
		{#each exampleTrackingInfo as info}
			<div class="inline-flex items-center gap-2 text-5xl" transition:blur>
				{#if info.icon}
					<info.icon />
				{/if}
				<p>{info.text}</p>
			</div>
		{/each}
	</div>
	<div class="min-w-2/3 space-y-4 p-10">
		<h3 class="font-display text-3xl">The age of the transparent home.</h3>
		<p class="max-w-3/4">
			Privacy isn't about having nothing to hide. It's a human right, violated the moment <span class="bg-neutral-100"
				>surveillance becomes possible</span
			>.
		</p>
		<p class="max-w-3/4">
			Ordinary smart home devices embrace this possibility <span class="bg-neutral-100">by design</span>. They are
			capable of watching, listening, and quietly
			<span class="bg-neutral-100">turning your home into a data stream</span>.
		</p>
	</div>
</section>
