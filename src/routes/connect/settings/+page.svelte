<script>
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { RiArrowLeftLine } from "svelte-remixicon";

	let relayDomain = $state("");
	let relayDomainInput = $state("");

	onMount(() => {
		relayDomain = localStorage.getItem("relayDomain") || DEFAULT_RELAY_DOMAIN;
		relayDomainInput = relayDomain;
	});
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<div class="absolute top-0 left-0 flex text-xl">
	<Button class="h-20! border-t-0 border-l-0 p-6!" variant="outline" href="/connect">
		<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
	</Button>
</div>

<div class="min-h-screen">
	<section class="mt-30 w-full space-y-4 border-y p-6 xl:p-8">
		<div>
			<h1 class="font-display text-3xl font-medium tracking-wide uppercase">Settings</h1>
		</div>
	</section>

	<section class="mt-10 w-full space-y-8 border-y p-6 xl:p-8">
		<div class="flex max-w-lg flex-col gap-2">
			<label for="relay-domain" class="text-sm font-medium">Relay domain</label>
			<Input id="relay-domain" type="text" bind:value={relayDomainInput} placeholder={DEFAULT_RELAY_DOMAIN} />
			<p class="text-xs text-muted-foreground">
				The relay server domain that the connect panel will use. Connected devices must be configured to use the same
				domain.
			</p>
		</div>

		<Button
			disabled={relayDomainInput === relayDomain}
			onclick={() => {
				const domain = relayDomainInput.trim();
				if (domain) {
					localStorage.setItem("relayDomain", domain);
					relayDomain = domain;
				}
			}}>Save</Button
		>
	</section>
</div>
