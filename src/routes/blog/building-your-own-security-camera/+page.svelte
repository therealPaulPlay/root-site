<script>
	import ContentContainer from "$lib/components/ContentContainer.svelte";
	import ContentHero from "$lib/components/ContentHero.svelte";
	import ContentImage from "$lib/components/ContentImage.svelte";
	import ContentNote from "$lib/components/ContentNote.svelte";
	import ContentProductPromotion from "$lib/components/ContentProductPromotion.svelte";
	import FirmwareDownloadButton from "$lib/components/FirmwareDownloadButton.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
</script>

<ContentHero
	duration="5 minutes"
	releaseDate="Jan 19th, 2026"
	src="/images/blog/building-your-own-security-camera/diy-security-camera.jpg"
/>

<ContentContainer>
	<div class="space-y-1">
		<Label class="text-lg font-semibold">A DIY Guide</Label>
		<h1 class="text-4xl">Building your own private security camera</h1>
	</div>

	<p>
		While there are many home security cameras on the market, it's hard to find one that guarantees absolute privacy.
		Most popular security systems store footage in the cloud, where the manufacturer has full access to your recordings.
	</p>

	<p>
		ROOT offers a complete software suite that includes
		<a href="/connect" target="_blank" class="underline">ROOT Connect</a> (mobile app coming soon), a relay server, and camera
		firmware – all open-source and engineered to keep your data safe and end-2-end encrypted.
	</p>

	<p>
		Other open-source camera operating systems like
		<a target="_blank" href="https://frigate.video/" class="underline">Frigate</a> and
		<a target="_blank" href="https://github.com/motioneye-project/motioneye" class="underline">MotionEye</a>
		excel at power-user and local NVR setups. ROOT's firmware takes a different approach:
	</p>

	<ul class="ml-4 list-disc space-y-2">
		<li>Unrivaled privacy with end-to-end encryption and forward secrecy</li>
		<li>Intuitive web app that focuses on simplicity</li>
		<li>Relay server that allows for remotely accessing cameras</li>
		<li>Local-first architecture where recordings are stored on-device</li>
		<li>Person, pet and car detection using local AI – without a hub</li>
	</ul>

	<p>
		No programming skills are needed for building your own ROOT-powered camera. Installing the software is as easy as
		flashing the firmware onto the SD card of your Raspberry Pi.
	</p>

	<p>
		<Dialog.Root>
			<Dialog.Trigger class="text-start text-muted-foreground hover:underline"
				>&gt; Why should I care about privacy?</Dialog.Trigger
			>
			<Dialog.Content class="w-full max-w-250!">
				<Dialog.Header>
					<Dialog.Title>Why privacy matters</Dialog.Title>
				</Dialog.Header>
				<iframe
					class="aspect-video w-full"
					src="https://www.youtube.com/embed/pcSlowAhvUk?si=Bv0q3nb1OqOsj9Hh"
					title="YouTube video player"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerpolicy="strict-origin-when-cross-origin"
					allowfullscreen
				></iframe>
			</Dialog.Content>
		</Dialog.Root>
	</p>
	<br />

	<h2 class="text-3xl">Required hardware</h2>

	<ContentNote text="No startup sound will play without the buzzer. Raspberry Pi 3, 4 and 5 may work too." />

	<ul class="ml-4 list-disc space-y-2">
		<li>Raspberry Pi Zero 2w</li>
		<li>Camera module (Official Pi camera modules, ZeroCam, etc.)</li>
		<li>Micro SD card (high-speed, min. 32GB, 64GB+ is recommend)</li>
		<li>Optional: USB Microphone</li>
		<li>Optional: Passive buzzer</li>
	</ul>
	<br />

	<h2 class="text-3xl">Step 1: Download the firmware image</h2>

	<p>
		You can download the latest available image using the button below. Alternatively, if you want to build the image
		yourself, fork the <a class="underline" target="_blank" href="/source-code?redirect=firmware">firmware repository</a
		> and run the CI/CD pipeline by publishing a release.
	</p>
	<FirmwareDownloadButton />
	<p>
		Once downloaded, extract the .img file by double-clicking (macOS) or right-clicking and selecting "Extract All"
		(Windows).
	</p>
	<br />

	<h2 class="text-3xl">Step 2: Flash the firmware</h2>

	<p>
		For flashing the firmware image onto your SD card, you'll need a computer and a software for flashing images such as
		the official <a href="https://www.raspberrypi.com/software/" target="_blank" class="underline"
			>Raspberry Pi Imager</a
		>.
	</p>

	<p>In the imager, choose your Raspberry Pi model, continue, and then select the custom image option.</p>

	<ContentImage alt="pi imager" src="/images/blog/building-your-own-security-camera/pi-imager.jpg" />

	<p>
		Follow the remaining steps in the setup process and skip the customization, since that part is done directly through
		the ROOT setup process. Your SD card should now be ready!
	</p>
	<br />

	<h2 class="text-3xl">Step 3: Assemble the parts</h2>

	<p>With the SD card ready, it's time to connect all the components to your Raspberry Pi:</p>

	<ol class="ml-8 list-decimal space-y-2">
		<li>
			Connect the camera module's ribbon cable to the camera port on your Pi. Make sure the contacts face the correct
			direction.
		</li>
		<li>Plug the microphone into a USB port (optional). This enables audio recording for your camera.</li>
		<li>Wire the passive buzzer to GPIO 18 and 3.3V (optional). This allows the camera to play sounds.</li>
		<li>Insert the flashed SD card into the card slot.</li>
	</ol>
	<br />

	<h2 class="text-3xl">Step 4: Host the relay server</h2>

	<p>
		For testing purposes, you are allowed to use the official relay server <span class="bg-accent"
			>{DEFAULT_RELAY_DOMAIN}</span
		>. However, relaying video footage is very expensive, hence prolonged use of the official instance is not permitted.
	</p>

	<p>
		Thankfully, hosting your own relay server is easy and cheap. You only need one – it will handle multiple cameras
		just fine.
	</p>

	<p>
		All you need to do in order to deploy your own instance is to view the <a
			class="underline"
			href="/source-code?redirect=relay"
			target="_blank">server's repository</a
		> on GitHub and click the deploy button in the readme.
	</p>

	<ContentImage
		alt="pi imager"
		src="/images/blog/building-your-own-security-camera/relay-server-deploy-button.jpg"
	/>

	<br />

	<h2 class="text-3xl">Step 5: Continue setup in ROOT Connect</h2>

	<p>
		Congrats, this was the hard part! Now, connect the Pi to power using a charging brick and USB cable. Make sure to
		use the port labeled "PWR IN" on the Pi.
	</p>

	<p>
		Give the camera about 30 to 60 seconds to boot up. If you connected a buzzer, you'll hear a startup sound when it's
		ready. Otherwise, wait until the LED light stops flashing.
	</p>

	<p>
		Once it's ready, head over to <a class="underline" href="/connect" target="_blank">ROOT Connect</a> to finish setting
		up your camera.
	</p>
	<br />
	<ContentProductPromotion />
</ContentContainer>
