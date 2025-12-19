<script>
	import { goto } from "$app/navigation";
	import Button from "$lib/components/ui/button/button.svelte";
	import { RiArrowLeftLine, RiArrowRightLine } from "svelte-remixicon";

	let step = $state(1);
	let stepAmount = $state(2);

	let stepTitle = ["Plug your ROOT product in.", "Connect to the product's WiFi."];
	let stepImage = ["/images/connect/charge-image.jpg", "/images/connect/wifi-image.jpg"];
</script>

<svelte:head>
	<title>Add new device</title>
</svelte:head>

<div class="min-h-svh w-full justify-center">
	<div class="h-[50svh] w-full overflow-hidden border-b">
		<img alt="Step illustration" src={stepImage[step - 1]} class="h-full w-full object-cover" />
	</div>
	<div class="flex min-h-[50svh] flex-col space-y-8 p-6 lg:p-8">
		<h3 class="font-display text-3xl font-medium tracking-wide">{step}. {stepTitle[step - 1] || "Default."}</h3>

		{#if step == 1}
			<p class="max-w-3xl">
				Use the USB charger to plug your ROOT product into a wall outlet. Wait until a startup sound plays. Rarely, this
				can take up to 5 minutes.
			</p>
		{/if}

		{#if step == 2}
			<p class="max-w-3xl">
				Open the settings app on your device and connect to a WiFi network with "ROOT" in the name. Then, visit <a
					class="underline"
					target="_blank"
					href="http://root.test">http://root.test</a
				> and follow the instructions there.
			</p>
		{/if}

		<!-- Controls -->
		<div class="mt-auto flex w-full justify-between gap-8">
			<Button
				variant="outline"
				onclick={() => {
					if (step == 1) goto("/connect");
					else step--;
				}}
			>
				<RiArrowLeftLine class="h-4! w-4!" />
				Back</Button
			>
			<Button
				onclick={() => {
					if (step < stepAmount) step++;
					else goto("/connect");
				}}
			>
				{#if step < stepAmount}
					Next
					<RiArrowRightLine class="h-4! w-4!" />
				{:else}
					Done
				{/if}</Button
			>
		</div>
	</div>
</div>
