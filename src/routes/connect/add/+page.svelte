<script>
	import { goto } from "$app/navigation";
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import { Bluetooth } from "$lib/utils/bluetooth";
	import { encodePublicKey, Encryption } from "$lib/utils/encryption";
	import { saveProduct } from "$lib/utils/pairedProductsStorage";
	import { RiArrowLeftLine, RiArrowRightLine, RiLock2Line, RiLockUnlockLine } from "svelte-remixicon";
	import { toast } from "svelte-sonner";

	let step = $state(1);
	let stepAmount = $state(6);
	let stepConditionMet = $derived.by(() => {
		if (step == 2 && (!selectedBluetoothDevice || !paringCode)) return false;
		if (step == 3 && !successfulScan) return false;
		if (step == 4 && !pairingSuccess) return false;
		if (step == 5 && !wifiConfiured) return false;
		if (step == 6 && !relayConfigured) return false;
		return true;
	});

	let stepTitle = [
		"Plug your ROOT product in.",
		"Connect to the product via Bluetooth.",
		"Scan this QR code with your ROOT camera.",
		"Name & pair device.",
		"Connect the product to WiFi.",
		"Choose a relay server."
	];
	let stepImage = ["/images/connect/charge-image.jpg", "/images/connect/wireless-image.jpg"];

	// Instances
	let bluetoothInstance = new Bluetooth();

	// State
	let selectedBluetoothDevice = $state();
	let paringCode = $state();
	let successfulScan = $state(false);
	let deviceNameInput = $state("My phone");
	let pairingSuccess = $state(false);
	let relayConfigured = $state(false);
	let wifiConfiured = $state(false);
	let wifiNetworks = $state([]);
	let selectedWiFiSSID = $state("");
	let relayDomainInput = $state("relay.rootprivacy.com");

	// React to step changes
	$effect(async () => {
		if (step == 6) getWifiNetworks();
	});

	async function getWifiNetworks() {
		try {
			wifiNetworks = [];

			// Limit to 100
			for (let i; i < 100; i++) {
				const response = await bluetoothInstance.read("wifi");
				if (!response.success) break;
				wifiNetworks.push(response.network);
				if (!response.hasMore) break;
			}
		} catch (error) {
			toast.error("Error getting WiFi networks from product: ", error.msg);
		}
	}
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
				Ensure Bluetooth is enabled on your device. Then, click "SELECT BLUETOOTH DEVICE" and pick your ROOT product.
			</p>
			<Button
				onclick={async () => {
					// Connect to product
					try {
						selectedBluetoothDevice = await bluetoothInstance.scan();
					} catch (error) {
						toast.error("Error connecting to bluetooth device: " + error.msg);
					}

					// Get pairing code
					if (selectedBluetoothDevice) {
						try {
							pairingCode = bluetoothInstance.read("getCode");
						} catch (error) {
							toast.error("Error getting pairing code: " + error.msg);
						}
					}
				}}
			>
				Select Bluetooth device
			</Button>
		{/if}

		{#if step == 3}
			<p class="max-w-3xl">
				Point your ROOT camera towards the QR code displayed on your phone. Then, click "SCAN CODE".
			</p>
			<Button
				onclick={async () => {
					try {
						const response = await bluetoothInstance.read("scanQR");
						if (response.success) successfulScan = true;
					} catch (error) {
						toast.error("Error requesting QR scan: " + error.msg);
					}
				}}
			>
				Scan code
			</Button>
		{/if}

		{#if step == 4}
			<p class="max-w-3xl">Please give this device a name and click "PAIR DEVICE".</p>
			<div class="space-y-1">
				<Label for="device-name">Min. 3 characters</Label>
				<Input type="text" placeholder="My device" class="max-w-xs" id="device-name" bind:value={deviceNameInput} />
			</div>
			<Button
				disabled={deviceNameInput?.length < 3}
				onclick={async () => {
					try {
						// Get or create device ID
						const deviceId = localStorage.getItem("deviceId") ?? crypto.randomUUID();
						localStorage.setItem("deviceId", deviceId);

						// Generate keypair for this device
						const keypair = await Encryption.generateKeypair();

						const response = await bluetoothInstance.write("pair", {
							deviceId,
							deviceName: deviceNameInput,
							devicePublicKey: encodePublicKey(keypair.publicKey)
						});
						if (response.success) {
							saveProduct({
								id: response.data.productId,
								name: "My ROOT Observer",
								productPublicKey: response.data.cameraPublicKey,
								devicePublicKey: encodePublicKey(keypair.publicKey),
								type: "observer"
							});
							if (response.currentWifiSSID) {
								wifiConfiured = true;
								selectedWiFiSSID = response.currentWifiSSID;
							}
							if (response.relayDomain) relayConfigured = true;
							pairingSuccess = true;
						}
					} catch (error) {
						toast.error("Error pairing device: " + error.msg);
					}
				}}>Pair device</Button
			>
		{/if}

		{#if step == 5}
			{#if !wifiConfiured}
				<p class="max-w-3xl">Please choose a WiFi network.</p>
			{:else}
				<p class="max-w-3xl">Wifi is already configured, but can be changed below (optional).</p>
			{/if}
			<div class="h-3xl relative w-full max-w-xl border">
				<div class="of-top of-bottom h-full w-full overflow-y-auto">
					{#if wifiNetworks.length}
						{#each wifiNetworks as network}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								role="button"
								tabindex="0"
								onclick={async () => {
									toast.info("Connecting product to " + network.ssid + "...");

									const payload = {
										ssid: network.ssid,
										password: "wifi-password",
										countryCode: "ISO 3166-1 alpha-2 country code"
									};

									// TODO: password + country prompt
									// TODO: encrypt payload

									try {
										const response = await bluetoothInstance.write("wifi", {
											deviceId: localStorage.getItem("deviceId"),
											encryptedPayload: "base64-encrypted-json"
										});
										if (response.success) {
											wifiConfiured = true;
											selectedWiFiSSID = network.ssid;
										}
									} catch (error) {
										toast.error("Error requesting wifi change: " + error.msg);
									}
								}}
								class="flex w-full justify-between gap-4 p-2 {network.unsupported
									? 'pointer-events-none opacity-50'
									: ''}"
								class:bg-accent={network.ssid === selectedWiFiSSID}
							>
								<span class="inline-flex gap-1">
									{#if network.secured}
										<RiLock2Line class="h-4! w-4!" />
									{:else}
										<RiLockUnlockLine class="h-4! w-4!" />
									{/if}
								</span>
								<span>{network.signal} / 100</span>
							</div>
						{/each}
					{:else}
						<p class="p-8">Product has not discovered any networks.</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if step == 6}
			{#if !relayConfigured}
				<p class="max-w-3xl">Please set a relay domain.</p>
			{:else}
				<p class="max-w-3xl">Relay domain is already configured, but can be changed below (optional).</p>
			{/if}

			<Label for="relay-domain">Domain</Label>
			<Input type="text" placeholder="relay.com" class="max-w-xs" id="relay-domain" bind:value={relayDomainInput} />
		{/if}

		<!-- Controls -->
		<div class="mt-auto flex w-full justify-between gap-8">
			<Button
				variant="outline"
				onclick={() => {
					goto("/connect");
				}}
			>
				<RiArrowLeftLine class="h-4! w-4!" />
				Return to Dashboard</Button
			>
			<Button
				onclick={() => {
					if (step < stepAmount) step++;
					else goto("/connect");
				}}
			>
				{#if step < stepAmount}
					Next
					<RiArrowRightLine class="h-4! w-4!" disabled={!stepConditionMet} />
				{:else}
					Done
				{/if}</Button
			>
		</div>
	</div>
</div>
