<script>
	import { RiHourglassLine, RiTimeLine, RiUserLine } from "svelte-remixicon";
	import Label from "./ui/label/label.svelte";

	let { duration = "3 minutes", author = "Paul", src, releaseDate = "Jan 1st, 1970" } = $props();
</script>

<section>
	<div class="flex h-60 w-full items-center justify-center md:h-80 lg:h-100 xl:h-120 2xl:h-130">
		{#if src}
			<img alt="hero" {src} class="h-full w-full object-cover" />
		{:else}
			<Label>No image.</Label>
		{/if}
	</div>
	<div class="flex w-full border-y">
		<div class=" mx-auto flex w-3xl flex-wrap items-center justify-between gap-4 p-6 lg:px-8 px-6">
			<div class="flex gap-4">
				<Label><RiHourglassLine /> {duration}</Label>
				<Label><RiUserLine />By {author}</Label>
			</div>
			<div class="flex">
				<Label><RiTimeLine /> {releaseDate}</Label>
			</div>
		</div>
	</div>
</section>
