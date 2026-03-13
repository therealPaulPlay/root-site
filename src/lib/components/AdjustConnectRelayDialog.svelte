<script>
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { OFFICIAL_RELAY_DOMAIN } from "$lib/config";

	let { newRelayDomain } = $props();
	let relayDomainChangedDialogOpen = $state(false);

	$effect(() => {
		if (!newRelayDomain) return;

		// If the current ROOT Connect relay domain differs and was updated, inform user
		if (
			localStorage.getItem("relayDomain") !== newRelayDomain &&
			!(localStorage.getItem("relayDomain") === null && newRelayDomain === OFFICIAL_RELAY_DOMAIN)
		) {
			relayDomainChangedDialogOpen = true;
		}

		// Apply the update
		if (localStorage.getItem("relayDomain") !== newRelayDomain) {
			// If the domain is the official relay one, still save it in case the default ever changes
			// ...since the product's relay domain will not update since it assumes no default or official one
			localStorage.setItem("relayDomain", newRelayDomain);
		}
	});
</script>

<Dialog.Root bind:open={relayDomainChangedDialogOpen}>
	<Dialog.Content>
		<Dialog.Header class="space-y-4">
			<Dialog.Title>Relay domain adjusted</Dialog.Title>
			<Dialog.Description>
				<p class="mb-4">
					The ROOT Connect relay domain has been updated to match your selection for this product. Heads up: You won't
					be able to connect to products that are configured to use a different relay domain.
				</p>
				<p>You can change it in the settings.</p>
			</Dialog.Description>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
