<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { RiExternalLinkLine } from "svelte-remixicon";
	import { Capacitor } from "@capacitor/core";
</script>

<Dialog.Root open={Capacitor.getPlatform() === "web" && !navigator.bluetooth}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Browser unsupported</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description>
			<p class="mb-4">
				This browser does not support the Web Bluetooth API. Bluetooth is necessary for pairing ROOT products.
			</p>
			<div>
				<p>Solutions:</p>
				<ul class="mt-2 ml-4 list-disc space-y-2">
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
		</Dialog.Description>
	</Dialog.Content>
</Dialog.Root>
