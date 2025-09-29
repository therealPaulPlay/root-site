<script>
	import { page } from "$app/state";
	import Button from "./ui/button/button.svelte";
	import { RiCircleFill } from "svelte-remixicon";

	const navigationEntries = [
		{ name: "Home", href: "/" },
		{ name: "Mission", href: "/#mission" },
		{ name: "Devices", href: "/#devices" },
		{ name: "About", href: "/#about" }
	];
</script>

<aside class="flex h-full max-h-screen overflow-y-auto of-top of-bottom of-length-2 w-50 flex-col border-r no-scrollbar">
	<div class="border-b p-4">
		<img src="/images/logo.svg" class="h-auto w-30" alt="logo" />
	</div>
	<div>
		<img src="/images/grainy-tech-dots-1.jpg" class="h-auto w-full opacity-25" alt="grainy tech" />
	</div>
	<nav class="flex flex-col items-start">
		{#each navigationEntries as entry}
			<Button
				href={entry.href}
				variant="link"
				class="w-full {page.url.pathname + page.url.hash == entry.href ? 'bg-foreground text-background' : ''}"
			>
				{entry.name}</Button
			>
		{/each}
	</nav>
	<div>
		<img
			src="/images/grainy-tech-dots-3.jpg"
			class="h-50  object-cover opacity-25"
			alt="grainy tech"
		/>
	</div>
	<div class="space-y-4 border-y p-4">
		<h3 class="font-medium"><span>//</span> Philosophy</h3>
		<p>
			Root, as in <span class="bg-neutral-100">root-access</span>, is about lifting all restrictions and building smart
			devices that purely serve their owner.
		</p>
		<p>
			<span class="bg-neutral-100">Privacy</span> is the foundation of every design decision. Data stays local, nothing
			leaves your home. Fully <span class="bg-neutral-100">open-source</span>.
		</p>
		<p>
			Owning a Root device means <span class="bg-neutral-100">unrestricted use</span>. Modify, repair and utilize it
			however you intend.
		</p>
	</div>
	<div class="grow relative">
		<img
			src="/images/grainy-tech-dots-2.jpg"
			class="h-full max-h-100 min-h-50  object-cover opacity-25"
			alt="grainy tech"
		/>
	</div>
</aside>
