<script>
	import { RiExternalLinkLine } from "svelte-remixicon";
	import Button from "$lib/components/ui/button/button.svelte";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	const REPOSITORY_URLS = {
		site: "https://github.com/therealPaulPlay/root-site",
		relay: "https://github.com/therealPaulPlay/root-relay",
		firmware: "https://github.com/therealPaulPlay/root-firmware"
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

<section class="relative mb-20 w-full space-y-4 border-y p-6 lg:p-8">
	<h1 class="text-4xl">Source code</h1>
	<p>
		<Button href={REPOSITORY_URLS.site} target="_blank" variant="link" class="inline-flex items-center gap-2 px-0!"
			>Website <RiExternalLinkLine class="h-4! w-4!" /></Button
		>
	</p>
	<p>
		<Button href={REPOSITORY_URLS.relay} target="_blank" variant="link" class="inline-flex items-center gap-2 px-0!"
			>Relay server <RiExternalLinkLine class="h-4! w-4!" /></Button
		>
	</p>
	<p>
		<Button href={REPOSITORY_URLS.firmware} target="_blank" variant="link" class="inline-flex items-center gap-2 px-0!"
			>Firmware <RiExternalLinkLine class="h-4! w-4!" /></Button
		>
	</p>
</section>
