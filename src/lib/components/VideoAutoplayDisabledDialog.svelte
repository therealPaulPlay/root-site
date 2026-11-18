<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { Capacitor, registerPlugin } from "@capacitor/core";
	import { onMount } from "svelte";

	const Accessibility = Capacitor.getPlatform() === "ios" ? registerPlugin("Accessibility") : null;

	let open = $state(false);

	async function check() {
		if (!Accessibility) return;
		try {
			const { enabled } = await Accessibility.isVideoAutoplayEnabled();
			open = !enabled;
		} catch (error) {
			console.error("Failed to check video auto-play accessibility setting:", error);
		}
	}

	onMount(check);
</script>

<!-- Check again on re-focus (e.g. for users that return from iOS settings) -->
<svelte:document onvisibilitychange={() => !document.hidden && check()} />

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Auto-play is off</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description>
			<p class="mb-4">
				Video streams from connected cameras can't start because "Auto-Play Video Previews" is disabled.
			</p>
			<div>
				<p>To turn it on:</p>
				<ul class="mt-2 ml-4 list-disc space-y-2">
					<li>Open the Settings app</li>
					<li>Go to Accessibility -&gt; Motion</li>
					<li>Turn on "Auto-Play Video Previews"</li>
				</ul>
			</div>
		</Dialog.Description>
	</Dialog.Content>
</Dialog.Root>
