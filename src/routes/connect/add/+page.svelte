<script>
	import { goto } from "$app/navigation";
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { Bluetooth } from "$lib/utils/bluetooth";
	import { encodeKey, Encryption } from "$lib/utils/encryption";
	import { saveProduct } from "$lib/utils/pairedProductsStorage";
	import { encryptPayload } from "$lib/utils/payloadEncryptionBle";
	import { RiArrowLeftLine, RiArrowRightLine, RiLock2Line, RiLockUnlockLine } from "svelte-remixicon";
	import * as NativeSelect from "$lib/components/ui/native-select/index.js";
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import { toast } from "svelte-sonner";
	import QrCode from "svelte-qrcode";

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

	$inspect(stepConditionMet);

	let stepTitle = [
		"Plug your ROOT product in.",
		"Connect via Bluetooth.",
		"Scan this QR code.",
		"Pair your device.",
		"Configure WiFi.",
		"Set the relay server."
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
	let relayDomainInput = $state("relay.rootprivacy.com"); // Default relay
	let wifiConnectDialogOpen = $state(false);
	let wifiPasswordInput = $state("");
	let wifiCountryCode = $state("");
	let pendingWifiNetwork = $state(null);
	let currentProductId = $state(null);

	// Data
	let countryCodes = $state({});

	// React to step changes
	$effect(async () => {
		if (step == 6) getWifiNetworks();
		if (step == 5) {
			fetch("/json/wifi-country-codes.json")
				.then((res) => res.json())
				.then((data) => (countryCodes = data))
				.catch((err) => console.error("Failed to load country codes:", err));
		}
	});

	async function getWifiNetworks() {
		try {
			wifiNetworks = [];

			// Limit to 100
			for (let i = 0; i < 100; i++) {
				const response = await bluetoothInstance.read("wifiNetworks");
				if (!response.success) break;
				wifiNetworks.push(response.network);
				if (!response.hasMore) break;
			}
		} catch (error) {
			toast.error("Error getting WiFi networks from product: " + error.message);
		}
	}

	async function connectToWifi() {
		try {
			const encryptedPayload = await encryptPayload(currentProductId, {
				ssid: pendingWifiNetwork.ssid,
				password: wifiPasswordInput,
				countryCode: wifiCountryCode
			});

			const response = await bluetoothInstance.write("wifi", {
				deviceId: localStorage.getItem("deviceId"),
				encryptedPayload
			});

			if (response.success) {
				wifiConfiured = true;
				selectedWiFiSSID = pendingWifiNetwork.ssid;
				wifiConnectDialogOpen = false;
				toast.success("Connected to " + pendingWifiNetwork.ssid);
			}
		} catch (error) {
			toast.error("Error connecting to WiFi: " + error.message);
		}
	}
</script>

<svelte:head>
	<title>Add new device</title>
</svelte:head>

<div class="min-h-svh w-full justify-center">
	{#if stepImage[step - 1]}
		<div class="h-[50svh] w-full overflow-hidden border-b">
			<img alt="Step illustration" src={stepImage[step - 1]} class="h-full w-full object-cover" />
		</div>
	{/if}
	{#if step == 3}
		<div class="flex min-h-[50svh] w-full items-center justify-center overflow-hidden border-b bg-white">
			{#if paringCode}
				<QrCode value={paringCode} size={300} />
			{:else}
				<p>No pairing code received.</p>
			{/if}
		</div>
	{/if}
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
				Ensure Bluetooth is enabled on your device. Then, click "OPEN BLUETOOTH" and pick the new ROOT product.
			</p>
			<Button
				class="w-fit"
				onclick={async () => {
					// Connect to product
					try {
						selectedBluetoothDevice = await bluetoothInstance.scan();
					} catch (error) {
						toast.error("Error connecting to bluetooth device: " + error.message);
					}

					// Get pairing code
					if (selectedBluetoothDevice) {
						try {
							pairingCode = await bluetoothInstance.read("getCode");
						} catch (error) {
							toast.error("Error requesting pairing code: " + error.message);
						}
					}
				}}
			>
				Open Bluetooth
			</Button>
		{/if}

		{#if step == 3}
			<p class="max-w-3xl">
				Point your ROOT camera towards the QR code displayed on your phone. Then, click "SCAN CODE".
			</p>
			<Button
				class="w-fit"
				onclick={async () => {
					try {
						const response = await bluetoothInstance.read("scanQR");
						if (response.success) successfulScan = true;
					} catch (error) {
						toast.error("Error requesting QR scan: " + error.message);
					}
				}}
			>
				Scan code
			</Button>
		{/if}

		{#if step == 4}
			<p class="max-w-3xl">Please give this device a name and click "PAIR DEVICE".</p>
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="device-name">Min. 3 characters</Label>
					<Input type="text" placeholder="My device" class="max-w-xs" id="device-name" bind:value={deviceNameInput} />
				</div>
				<Button
					class="w-fit"
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
								deviceName: deviceNameInput.trim(),
								devicePublicKey: encodeKey(keypair.publicKey)
							});
							if (response.success) {
								currentProductId = response.data.productId;
								saveProduct({
									id: response.data.productId,
									name: "My ROOT Observer",
									productPublicKey: response.data.cameraPublicKey,
									devicePublicKey: encodeKey(keypair.publicKey),
									devicePrivateKey: encodeKey(keypair.privateKey),
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
							toast.error("Error pairing device: " + error.message);
						}
					}}>Pair device</Button
				>
			</div>
		{/if}

		{#if step == 5}
			{#if !wifiConfiured}
				<p class="max-w-3xl">Please choose a WiFi network that the ROOT product can connect to.</p>
			{:else}
				<p class="max-w-3xl">Wifi is already configured, but can be changed below (optional).</p>
			{/if}
			<div class="space-y-4">
				<div class="h-3xl relative w-full max-w-xl border">
					<div class="of-top of-bottom h-full w-full overflow-y-auto">
						{#if wifiNetworks.length}
							{#each wifiNetworks as network}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<div
									role="button"
									tabindex="0"
									onclick={() => {
										pendingWifiNetwork = network;
										wifiPasswordInput = "";
										wifiCountryCode = "";
										wifiConnectDialogOpen = true;
									}}
									class="flex w-full justify-between gap-2 p-2 hover:bg-accent/50 {network.unsupported
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
							<p class="p-4">No networks found.</p>
						{/if}
					</div>
				</div>
				<Button variant="outline" onclick={getWifiNetworks} class="w-fit">Refresh</Button>
			</div>
		{/if}

		<!-- This is heavily WIP -->
		<AlertDialog.Root bind:open={wifiConnectDialogOpen}>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>Connect to {pendingWifiNetwork?.ssid}</AlertDialog.Title>
					<AlertDialog.Description>
						Please input the WiFi password and choose the country that this WiFi is located in (processed on-device
						only).
					</AlertDialog.Description>
				</AlertDialog.Header>
				<div class="space-y-4">
					<Input type="password" bind:value={wifiPasswordInput} placeholder="WiFi password" />
					<NativeSelect.Root bind:value={wifiCountryCode}>
						<NativeSelect.Option value="">Select country</NativeSelect.Option>
						{#each Object.entries(countryCodes) as [code, name]}
							<NativeSelect.Option value={code}>{name}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</div>
				<AlertDialog.Footer>
					<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
					<AlertDialog.Action
						onclick={connectToWifi}
						disabled={!pendingWifiNetwork || !wifiPasswordInput || !wifiCountryCode}>Connect</AlertDialog.Action
					>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog.Root>

		{#if step == 6}
			{#if !relayConfigured}
				<p class="max-w-3xl">
					Please set a relay domain. Custom relay servers give extra flexibility for advanced users.
				</p>
			{:else}
				<p class="max-w-3xl">Relay domain is already configured, but can be changed below (optional).</p>
			{/if}

			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="relay-domain">Domain</Label>
					<Input type="text" placeholder="relay.com" class="max-w-xs" id="relay-domain" bind:value={relayDomainInput} />
				</div>
				<Button
					class="w-fit"
					onclick={async () => {
						try {
							const payload = { relayDomain: relayDomainInput.trim() };
							const encryptedPayload = await encryptPayload(currentProductId, payload);
							const response = await bluetoothInstance.write("relay", {
								deviceId: localStorage.getItem("deviceId"),
								encryptedPayload
							});
							if (response.success) relayConfigured = true;
						} catch (error) {
							toast.error("Error requesting relay domain set " + error.message);
						}
					}}
				>
					Set domain
				</Button>
			</div>
		{/if}

		<!-- Controls -->
		<div class="mt-auto flex w-full justify-between gap-8">
			<AlertDialog.Root>
				<AlertDialog.Trigger class={buttonVariants({ variant: "outline" })}>
					<RiArrowLeftLine class="h-4! w-4!" />Abort
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Abort?</AlertDialog.Title>
						<AlertDialog.Description>
							All progress will be lost and you will return to the connect panel.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action onclick={() => goto("/connect")}>Confirm</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
			<Button
				disabled={!stepConditionMet}
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
