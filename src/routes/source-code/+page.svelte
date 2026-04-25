<script>
	import { RiExternalLinkLine } from "svelte-remixicon";
	import Button from "$lib/components/ui/button/button.svelte";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	const REPOSITORY_URLS = {
		website: "https://github.com/therealPaulPlay/root-site",
		firmware: "https://github.com/therealPaulPlay/root-firmware",
		"relay server": "https://github.com/therealPaulPlay/root-relay",
		protocol: "https://github.com/therealPaulPlay/root-e2ee-protocol"
	};

	onMount(() => {
		if (page.url.searchParams.get("redirect")) {
			const redirectUrl = REPOSITORY_URLS[page.url.searchParams.get("redirect")];
			if (redirectUrl) {
				toast.info("Redirecting to repository...");
				window.location.href = redirectUrl;
			}
		}
	});
</script>

<svelte:head>
	<title>Source code</title>
	<meta name="description" content="Take a look at the ROOT source code." />
</svelte:head>

<section class="mb-20 h-60 w-full border-b lg:h-100 xl:h-120">
	<img alt="code" class="h-full w-full object-cover" src="/images/source-code/code-falling.jpg" />
</section>

<section class="relative mb-10 w-full space-y-4 border-y p-6 lg:p-8">
	<h1 class="text-4xl">Source code</h1>
</section>

<section class="relative mb-20 w-full space-y-4 border-y p-6 lg:p-8">
	<div class="space-y-2">
		{#each Object.values(REPOSITORY_URLS) as repositoryName, index}
			<p>
				<Button href={repositoryName} target="_blank" variant="link" class="px-0!"
					>{Object.keys(REPOSITORY_URLS)[index]} <RiExternalLinkLine class="h-4! w-4!" /></Button
				>
			</p>
		{/each}
	</div>
</section>
