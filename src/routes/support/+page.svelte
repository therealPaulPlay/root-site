<script>
	import * as Accordion from "$lib/components/ui/accordion/index.js";
	import Button from "$lib/components/ui/button/button.svelte";
	import { RiExternalLinkLine } from "svelte-remixicon";
</script>

<svelte:head>
	<title>Support</title>
</svelte:head>

<section class="relative flex h-80 w-full items-center justify-center overflow-hidden border-b lg:h-100 xl:h-150">
	<img alt="support" src="/images/support/support-hero.jpg" class="h-full w-full object-cover" />
</section>

<section class="my-20 w-full space-y-4 border-y p-6 lg:p-8">
	<h1 class="font-display text-3xl font-medium tracking-wide">FAQ</h1>
	<Accordion.Root type="single" class="w-full">
		<Accordion.Item value="item-1">
			<Accordion.Trigger>What sets ROOT cameras apart?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					Our intelligent home security cameras utilize on-device processing, onboard storage, and end-2-end encryption
					to keep recorded footage and audio private.
				</p>
				<p>
					Most other brands process and store footage in the cloud and thereby cannot offer similar privacy and
					security.
				</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-2">
			<Accordion.Trigger>What is a relay server?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					A relay server relays the messages sent by your camera to your connected device(s), and vice versa. These
					messages may include streamed footage, audio or commands. The relay server has no way to decrypt the data
					that's being relayed across.
				</p>
				<p>
					However, third-party relay servers can collect IP addresses and other sensitive information about connected
					clients, which is why we recommend using the official relay server, or one hosted by a provider you fully
					trust.
				</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-3">
			<Accordion.Trigger>Can the microphone be disabled?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					Yes, via the "Controls" section in the connect panel. Extra cautious users can additionally open up the device
					and unplug the microphone.
				</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-4">
			<Accordion.Trigger>Why is a relay server required?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					Without a relay server, the products would have to act as a server of their own. This requires complex setup
					on the user's end and is more challenging to keep secure.
				</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-5">
			<Accordion.Trigger>Which power supplies are supported?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>Any reliable USB power source that can output a minimum of 10W.</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-6">
			<Accordion.Trigger>Do ROOT cameras offer good image quality?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					ROOT security cameras use premium image sensors and are capable of streaming 1080p (2K) video at 15 frames per
					second.
				</p>
				<p>Additionally, they come equipped with a high-quality microphone.</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-7">
			<Accordion.Trigger>Does ROOT collect usage data?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					We have no insight into how you use our products. All communication between you and our products is encrypted
					and only you have access to the key.
				</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-8">
			<Accordion.Trigger>How can I see who is using my camera?</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					If you are sharing your ROOT camera (e.g. with family members) and want to manage the paired devices, connect
					to the product, open the "Controls" section and scroll down to the devices section.
				</p>
				<p>From here, you can revoke access to your camera.</p>
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</section>

<section class="mb-20 w-full space-y-4 border-y p-6 lg:p-8">
	<h1 class="font-display text-3xl font-medium tracking-wide">Troubleshooting</h1>
	<Accordion.Root type="single" class="w-full">
		<Accordion.Item value="item-1">
			<Accordion.Trigger>The camera can't be reached</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					Ensure the camera is connected to a stable WiFi. Moreover, your paired device needs to have a stable internet
					connection as well.
				</p>
				<p>
					If the product cannot be reached, try re-pairing your device by repeating the same setup process used during
					the initial setup. Re-pairing is safe and does not require removing the product beforehand.
				</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-2">
			<Accordion.Trigger>Encryption errors are showing up</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>
					If errors such as "failed to decrypt..." appear, try re-pairing your device by repeating the same setup
					process used during the initial setup. Re-pairing is safe and does not require removing the product
					beforehand.
				</p>
				<p>During the pairing process, new keys will be securely exchanged.</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="item-3">
			<Accordion.Trigger>The camera does not boot up</Accordion.Trigger>
			<Accordion.Content class="flex flex-col gap-4 text-balance">
				<p>Rarely, SD cards can become corrupted or stop working.</p>
				<p>
					Try flashing the ROOT camera firmware onto a new SD card and inserting it into the product. A screwdriver may
					be needed to open up the upper part of the enclosure.
				</p>
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</section>

<section class="mb-20 w-full space-y-8 border-y p-6 lg:p-8">
	<h1 class="font-display text-3xl font-medium tracking-wide">Community</h1>
	<Button variant="outline" href="https://www.reddit.com/r/ROOTPRIVACY" target="_blank"
		>Reddit <RiExternalLinkLine class="size-4" /></Button
	>
</section>
