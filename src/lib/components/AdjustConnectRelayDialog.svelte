<script>
	import * as Dialog from "$lib/components/ui/dialog/index.js";

	let { newRelayDomain } = $props();
	let relayDomainChangedDialogOpen = $state(false);

	$effect(() => {
		if (!newRelayDomain) return;

		// If none set yet, update silently
		if (!localStorage.getItem("relayDomain")) localStorage.setItem("relayDomain", newRelayDomain);
		else if (localStorage.getItem("relayDomain") && localStorage.getItem("relayDomain") !== newRelayDomain) {
			// If a relay domain is already set and differs, notify user
			localStorage.setItem("relayDomain", newRelayDomain);
			relayDomainChangedDialogOpen = true;
		}
	});
</script>

<Dialog.Root bind:open={relayDomainChangedDialogOpen}>
	<Dialog.Content>
		<Dialog.Header class="space-y-4">
			<Dialog.Title>Connect panel relay domain adjusted</Dialog.Title>
			<Dialog.Description>
				<p class="mb-4">
					The ROOT Connect relay domain has been updated to match your selection for this product. Heads up: You won't
					be able to connect to products that use different relay domains.
				</p>
				<p>You can change the relay domain anytime in the settings.</p>
			</Dialog.Description>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
