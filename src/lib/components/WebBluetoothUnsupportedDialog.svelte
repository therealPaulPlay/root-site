<script>
	import { bluetoothSupported } from "$lib/utils/bluetooth";
	import * as Dialog from "$lib/components/ui/dialog";
	import { RiExternalLinkLine } from "svelte-remixicon";
</script>

<Dialog.Root open={!bluetoothSupported()}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Browser unsupported!</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			<p>This browser does not support the Web Bluetooth API. Bluetooth is necessary for pairing ROOT products.</p>
			<div>
				<p>Possible solutions:</p>
				<ul class="list-disc ml-4 mt-2 space-y-2">
					<li>Use Google Chrome on a desktop computer</li>
					<li>Use Chrome for Android and add the website to your home screen</li>
					<li>
						Download the ROOT Connect app <a
							class="inline-flex items-center gap-1 underline"
							target="_blank"
							href="https://apps.apple.com/us/ipad/search?term=ROOT%20Connect"
							>iOS <RiExternalLinkLine class="size-4" /></a
						>
						<a
							class="inline-flex items-center gap-1 underline"
							target="_blank"
							href="https://play.google.com/store/search?q=ROOT%20Connect"
							>Android <RiExternalLinkLine class="size-4" /></a
						>
					</li>
				</ul>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
