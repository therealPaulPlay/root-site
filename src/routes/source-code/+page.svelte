<script>
	import { RiExternalLinkLine } from "svelte-remixicon";
	import Button from "$lib/components/ui/button/button.svelte";
</script>

<svelte:head>
	<title>Source code</title>
	<meta name="description" content="Take a look at the ROOT source code." />
</svelte:head>

<div class="h-full">
	<section class="relative mt-20 w-full space-y-4 border-y p-6 lg:p-8">
		<h1 class="font-display text-3xl font-medium tracking-wide uppercase">Source code</h1>
		<p>
			<Button
				href="https://github.com/therealPaulPlay/root-site"
				target="_blank"
				variant="link"
				class="inline-flex items-center gap-2 px-0!">Website <RiExternalLinkLine class="h-4! w-4!" /></Button
			>
		</p>
		<p>
			<Button
				href="https://github.com/therealPaulPlay/root-relay"
				target="_blank"
				variant="link"
				class="inline-flex items-center gap-2 px-0!">Relay server <RiExternalLinkLine class="h-4! w-4!" /></Button
			>
		</p>
		<p>
			<Button
				href="https://github.com/therealPaulPlay/root-firmware"
				target="_blank"
				variant="link"
				class="inline-flex items-center gap-2 px-0!">Firmware <RiExternalLinkLine class="h-4! w-4!" /></Button
			>
		</p>
	</section>
</div>
