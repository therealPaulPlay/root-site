<script>
	import { goto } from "$app/navigation";
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { Bluetooth } from "$lib/utils/bluetooth";
	import { encodeKey, Encryption } from "$lib/utils/encryption";
	import { saveProduct } from "$lib/utils/pairedProductsStorage";
	import { encryptPayload } from "$lib/utils/payloadEncryptionBle";
	import {
		RiAlertLine,
		RiArrowLeftLine,
		RiArrowRightLine,
		RiCheckLine,
		RiLock2Line,
		RiLockUnlockLine
	} from "svelte-remixicon";
	import * as NativeSelect from "$lib/components/ui/native-select/index.js";
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import { toast } from "svelte-sonner";
	import QrCode from "svelte-qrcode";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { onMount } from "svelte";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config.js";
	import IframeDialog from "$lib/components/IframeDialog.svelte";

	let step = $state(1);
	let stepAmount = $state(6);
	let stepConditionMet = $derived.by(() => {
		if (step == 2 && (!connectedBleDevice || !pairingCode)) return false;
		if (step == 3 && !successfulScan) return false;
		if (step == 4 && !successfulPair) return false;
		if (step == 5 && !wifiConfigured) return false;
		if (step == 6 && !relayConfigured) return false;
		return true;
	});

	let stepTitle = [
		"Plug in the product.",
		"Connect via Bluetooth.",
		"Scan this QR code.",
		"Pair your device.",
		"Configure WiFi.",
		"Set the relay server."
	];
	let stepImage = [
		"/images/connect/charge-image.jpg",
		"/images/connect/wireless-image.jpg",
		"no-image-display-qr-code",
		"/images/connect/label-image.jpg",
		"/images/connect/internet-image.jpg",
		"/images/connect/settings-image.jpg"
	];

	// Instances
	let bluetoothInstance = new Bluetooth();

	// State
	let connectedBleDevice = $state();
	let pairingCode = $state();
	let successfulScan = $state(false);
	let deviceNameInput = $state("My phone");
	let successfulPair = $state(false);
	let relayConfigured = $state(false);
	let wifiConfigured = $state(false);
	let wifiNetworks = $state([]);
	let selectedWiFiSSID = $state("");
	let relayDomainInput = $state(DEFAULT_RELAY_DOMAIN);
	let wifiConnectDialogOpen = $state(false);
	let wifiPasswordInput = $state("");
	let wifiCountryCode = $state("");
	let pendingWifiNetwork = $state(null);
	let currentProductId = $state(null);

	// Busy state
	let currentlyConnectingViaBle = $state(false);
	let currentlyScanning = $state(false);
	let currentlyPairing = $state(false);
	let currentlyConnectingWifi = $state(false);
	let currentlyRefreshingWifi = $state(false);
	let currentlySettingRelay = $state(false);

	// Data
	let countryCodes = $state({});

	// Load WiFi country code list
	onMount(() => {
		fetch("/json/wifi-country-codes.json")
			.then((res) => res.json())
			.then((data) => (countryCodes = data))
			.catch((err) => console.error("Failed to load country codes:", err));
	});

	async function getWifiNetworks() {
		try {
			currentlyRefreshingWifi = true;
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
		} finally {
			currentlyRefreshingWifi = false;
		}
	}

	async function connectToWifi() {
		try {
			currentlyConnectingWifi = true;

			const payload = await encryptPayload(currentProductId, {
				ssid: pendingWifiNetwork.ssid,
				password: wifiPasswordInput,
				countryCode: wifiCountryCode
			});

			const response = await bluetoothInstance.writeAndRead("wifiConnect", {
				deviceId: localStorage.getItem("deviceId"),
				payload
			});

			if (response.success) {
				wifiConfigured = true;
				selectedWiFiSSID = pendingWifiNetwork.ssid;
				wifiConnectDialogOpen = false;
				toast.success("Connected to " + pendingWifiNetwork.ssid + "!");
			}
		} catch (error) {
			toast.error("Error connecting to WiFi: " + error.message);
		} finally {
			currentlyConnectingWifi = false;
		}
	}
</script>

<svelte:head>
	<title>Add product</title>
</svelte:head>

<div class="flex min-h-svh w-full flex-col justify-center">
	{#if stepImage[step - 1] && step !== 3}
		<div class="h-[50svh] max-h-[60svw] w-full overflow-hidden border-b">
			<img alt="Step illustration" src={stepImage[step - 1]} class="h-full w-full object-cover" />
		</div>
	{:else if step === 3}
		<div
			class="flex min-h-[calc(min(50svh,60svh))] w-full items-center justify-center overflow-hidden border-b bg-white! py-12"
		>
			{#if pairingCode}
				<div class="pt-4 pl-4">
					<QrCode value={pairingCode} size={275} errorCorrection="H" />
				</div>
			{:else}
				<p>No pairing code received.</p>
			{/if}
		</div>
	{/if}

	<div class="flex grow flex-col space-y-4 p-6 lg:p-8">
		<h3 class="font-display text-3xl font-medium tracking-wide">{step}. {stepTitle[step - 1] || "Default."}</h3>

		{#if step == 1}
			<p class="max-w-3xl">
				Use the USB charger to plug your ROOT camera into a wall outlet. Wait until a startup sound plays. Rarely, this
				can take up to 5 minutes.
			</p>
			<p>
				By clicking on "NEXT", you agree to our <IframeDialog src="/terms" variant={null}
					><span class="underline">Terms of Use</span>.</IframeDialog
				>
			</p>
		{/if}

		{#if step == 2}
			<p class="max-w-3xl">
				Ensure Bluetooth is enabled on your device. Then, click "OPEN BLUETOOTH" and pick the new ROOT product.
			</p>
			<Button
				class="mt-4 w-fit"
				disabled={currentlyConnectingViaBle || connectedBleDevice}
				onclick={async () => {
					// Scan for and select a device (opens system prompt)
					try {
						connectedBleDevice = await bluetoothInstance.scan();
					} catch (error) {
						toast.error("Error selecting bluetooth device: " + error.message);
						return;
					}

					currentlyConnectingViaBle = true;

					// Connect to the selected device
					try {
						await bluetoothInstance.connect();
					} catch (error) {
						currentlyConnectingViaBle = false;
						connectedBleDevice = null;
						toast.error("Error connecting to bluetooth device: " + error.message);
						return;
					}

					// Get pairing code
					try {
						const result = await bluetoothInstance.read("getCode");
						pairingCode = result.code;
					} catch (error) {
						currentlyConnectingViaBle = false;
						toast.error("Error getting pairing code: " + error.message);
					}

					currentlyConnectingViaBle = false;
				}}
			>
				{#if currentlyConnectingViaBle}
					<Spinner />
				{/if}
				Open Bluetooth
				{#if connectedBleDevice && !currentlyConnectingViaBle}
					<RiCheckLine class="h-4! w-4!" />
				{/if}
			</Button>
		{/if}

		{#if step == 3}
			<p class="max-w-3xl">
				Point your ROOT camera towards the QR code displayed above. Then, click "SCAN CODE" and hold the product still.
			</p>
			<Button
				class="mt-4 w-fit"
				disabled={currentlyScanning || successfulScan}
				onclick={async () => {
					try {
						currentlyScanning = true;
						await bluetoothInstance.read("scanQR");
						successfulScan = true;
					} catch (error) {
						toast.error("Error scanning code: " + error.message);
					} finally {
						currentlyScanning = false;
					}
				}}
			>
				{#if currentlyScanning}
					<Spinner />
				{/if}
				Scan code
				{#if successfulScan}
					<RiCheckLine class="h-4! w-4!" />
				{/if}
			</Button>
		{/if}

		{#if step == 4}
			<p class="max-w-3xl">Please give this device a name and click "PAIR DEVICE".</p>
			<div class="mt-4 space-y-8">
				<div class="space-y-1">
					<Label for="device-name">Min. 3 characters</Label>
					<Input type="text" placeholder="My device" class="max-w-xs" id="device-name" bind:value={deviceNameInput} />
				</div>
				<Button
					class="w-fit"
					disabled={deviceNameInput?.length < 3 || currentlyPairing || successfulPair}
					onclick={async () => {
						try {
							currentlyPairing = true;

							// Get or create device ID
							const deviceId = localStorage.getItem("deviceId") ?? crypto.randomUUID();
							localStorage.setItem("deviceId", deviceId);

							// Generate keypair for this device
							const keypair = await Encryption.generateKeypair();

							const pairingResponse = await bluetoothInstance.writeAndRead("pair", {
								deviceId,
								deviceName: deviceNameInput.trim(),
								devicePublicKey: encodeKey(keypair.publicKey)
							});

							// Set for lookups
							currentProductId = pairingResponse.productId;

							// Get model name
							const modelResponse = await bluetoothInstance.read("productModel");

							// Get camera public key
							const publicKeyResponse = await bluetoothInstance.read("productPublicKey");

							// Save product after successful pairing
							saveProduct({
								id: pairingResponse.productId,
								name: "My ROOT " + modelResponse.model?.[0]?.toUpperCase() + modelResponse.model?.slice(1),
								productPublicKey: publicKeyResponse.publicKey,
								devicePublicKey: encodeKey(keypair.publicKey),
								devicePrivateKey: encodeKey(keypair.privateKey),
								keyCreatedAt: Date.now(),
								model: modelResponse.model
							});

							// Get WiFi status
							const wifiStatusResponse = await bluetoothInstance.read("wifiStatus");
							wifiConfigured = Boolean(wifiStatusResponse.connected);
							if (wifiStatusResponse.ssid) selectedWiFiSSID = wifiStatusResponse.ssid;

							// Get relay status
							const relayStatusResponse = await bluetoothInstance.read("relayStatus");
							if (relayStatusResponse.relayDomain) {
								relayConfigured = true;
								relayDomainInput = relayStatusResponse.relayDomain;
							}

							successfulPair = true;

							// Load wifi networks for next step
							getWifiNetworks();
						} catch (error) {
							toast.error("Error pairing device: " + error.message);
						} finally {
							currentlyPairing = false;
						}
					}}
				>
					{#if currentlyPairing}
						<Spinner />
					{/if}
					Pair device
					{#if successfulPair}
						<RiCheckLine class="h-4! w-4!" />
					{/if}
				</Button>
			</div>
		{/if}

		{#if step == 5}
			{#if !wifiConfigured}
				<p class="max-w-3xl">Please choose a WiFi network that the ROOT product can connect to.</p>
			{:else}
				<p class="max-w-3xl">The product is connected to Wifi. The selected network can be changed below if needed.</p>
			{/if}
			<div class="mt-4 space-y-8">
				<div class="relative h-32 w-full max-w-xl overflow-hidden border">
					<div class="of-top of-bottom no-scrollbar h-full w-full divide-y overflow-y-auto">
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
									class="flex w-full items-center justify-between gap-2 p-2 hover:bg-accent/50 {network.unsupported
										? 'pointer-events-none opacity-50'
										: ''} {network.ssid === selectedWiFiSSID
										? 'pointer-events-none bg-foreground text-background'
										: ''}"
								>
									<span class="inline-flex items-center gap-2 overflow-hidden">
										{#if network.secured}
											<RiLock2Line class="h-4! w-4!" />
										{:else}
											<RiLockUnlockLine class="h-4! w-4!" />
										{/if}
										<p class="truncate text-sm text-nowrap">
											{network.ssid}
											{network.ssid === selectedWiFiSSID ? "(Connected)" : ""}
											{network.unsupported ? "(Unsupported)" : ""}
										</p>
									</span>
									<span class="text-sm text-nowrap">{network.signal}/100</span>
								</div>
							{/each}
						{:else}
							<div class="flex h-full w-full items-center justify-center p-4">
								<p class="text-center text-sm">{currentlyRefreshingWifi ? "Loading..." : "No networks found."}</p>
							</div>
						{/if}
					</div>
				</div>
				<Button class="w-fit" variant="outline" onclick={getWifiNetworks} disabled={currentlyRefreshingWifi}>
					{#if currentlyRefreshingWifi}
						<Spinner />
					{/if}
					Refresh</Button
				>
			</div>
		{/if}

		<AlertDialog.Root bind:open={wifiConnectDialogOpen}>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>Connect to {pendingWifiNetwork?.ssid || "default SSID"}</AlertDialog.Title>
					<AlertDialog.Description>
						Please input the WiFi password and choose the country that this WiFi network is located in.
					</AlertDialog.Description>
				</AlertDialog.Header>
				<div class="mb-4 space-y-4">
					<div class="space-y-1">
						<Label for="password-input" class="text-sm font-medium">Password</Label>
						<Input id="password-input" type="text" bind:value={wifiPasswordInput} placeholder="wifi-password-123" />
					</div>
					<div class="space-y-1">
						<Label for="country-select" class="text-sm font-medium">Country</Label>
						<NativeSelect.Root id="country-select" bind:value={wifiCountryCode}>
							<NativeSelect.Option value="">Select country</NativeSelect.Option>
							{#each Object.entries(countryCodes) as [code, name]}
								<NativeSelect.Option value={code}>{name}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
					</div>
				</div>
				<AlertDialog.Footer>
					<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
					<AlertDialog.Action
						onclick={connectToWifi}
						disabled={!pendingWifiNetwork || !wifiPasswordInput || !wifiCountryCode || currentlyConnectingWifi}
					>
						{#if currentlyConnectingWifi}
							<Spinner />
						{/if}
						Connect</AlertDialog.Action
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
				<p class="max-w-3xl">The relay domain is configured. It can be edited below if needed.</p>
			{/if}

			<div class="mt-4 space-y-8">
				{#if relayDomainInput !== DEFAULT_RELAY_DOMAIN}
					<div class="flex max-w-lg gap-2 border p-4 text-sm">
						<RiAlertLine class="h-4! w-4!" />
						<p>Potentially less private!</p>
					</div>
				{/if}
				<div class="space-y-1">
					<Label for="relay-domain">Domain</Label>
					<Input type="text" placeholder="relay.com" class="max-w-xs" id="relay-domain" bind:value={relayDomainInput} />
				</div>
				<Button
					class="w-fit"
					variant={relayConfigured ? "outline" : "default"}
					disabled={currentlySettingRelay}
					onclick={async () => {
						try {
							currentlySettingRelay = true;
							const payload = await encryptPayload(currentProductId, { relayDomain: relayDomainInput.trim() });
							const response = await bluetoothInstance.writeAndRead("relaySet", {
								deviceId: localStorage.getItem("deviceId"),
								payload
							});
							if (response.success) relayConfigured = true;
						} catch (error) {
							toast.error("Error setting relay domain: " + error.message);
						} finally {
							currentlySettingRelay = false;
						}
					}}
				>
					{#if currentlySettingRelay}
						<Spinner />
					{/if}
					{#if !relayConfigured}
						Set domain
					{:else}
						Edit domain
					{/if}
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
							{#if successfulPair}
								WARNING: Aborting the setup with an already paired device will NOT reset the full pairing progress.
								Finishing the WiFi and Relay setup is highly recommended.
							{:else}
								All progress will be lost and you will return to the connect panel.
							{/if}
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
