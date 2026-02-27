<script>
	import { goto } from "$app/navigation";
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { Bluetooth } from "$lib/utils/bluetooth";
	import { encode } from "cbor-x";
	import { encodeKey, Encryption } from "$lib/utils/encryption";
	import { getProduct, saveProduct } from "$lib/utils/pairedProductsStorage";
	import {
		RiAlertLine,
		RiArrowLeftLine,
		RiArrowRightLine,
		RiCheckLine,
		RiLock2Line,
		RiLockUnlockLine,
		RiRefreshLine,
		RiEyeLine,
		RiEyeCloseLine
	} from "svelte-remixicon";
	import * as NativeSelect from "$lib/components/ui/native-select/index.js";
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { toast } from "svelte-sonner";
	import QrCode from "svelte-qrcode";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { onMount } from "svelte";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config.js";
	import IframeDialog from "$lib/components/IframeDialog.svelte";
	import QRViewfinder from "$lib/components/QRViewfinder.svelte";
	import WebBluetoothUnsupportedDialog from "$lib/components/WebBluetoothUnsupportedDialog.svelte";
	import AdjustConnectRelayDialog from "$lib/components/AdjustConnectRelayDialog.svelte";
	import { vibrate } from "$lib/utils/haptics";

	let step = $state(1);
	let stepAmount = $state(6);
	let stepConditionMet = $derived.by(() => {
		if (step == 2 && !successfulConnect) return false;
		if (step == 3 && !successfulScan) return false;
		if (step == 4 && !successfulPair) return false;
		if (step == 5 && !wifiConfigured) return false;
		if (step == 6 && !relayConfigured) return false;
		return true;
	});

	let stepTitle = [
		"Plug in the product.",
		"Connect via Bluetooth.",
		"Scan the QR code.",
		"Pair your device.",
		"Configure WiFi.",
		"Set the relay server."
	];
	let stepImage = [
		"/images/connect/charge.jpg",
		"/images/connect/wireless.jpg",
		"no-image-display-qr-code",
		"/images/connect/label.jpg",
		"/images/connect/internet.jpg",
		"/images/connect/settings.jpg"
	];

	// Instances
	let bluetoothInstance = new Bluetooth();

	// Input state
	let pairingCode = $state();
	let deviceNameInput = $state("My phone");
	let wifiNetworks = $state([]);
	let selectedWiFiSSID = $state("");
	let showWifiPassword = $state(false);
	let relayDomainInput = $state(DEFAULT_RELAY_DOMAIN);
	let wifiPasswordInput = $state("");
	let wifiCountryCode = $state("");
	let pendingWifiNetwork = $state(null);
	let currentProductId = $state(null);

	// Dialogs
	let alreadyPairedDialogOpen = $state(false);
	let wifiConnectDialogOpen = $state(false);

	// Busy state
	let currentlyConnectingViaBle = $state(false);
	let currentlyScanning = $state(false);
	let currentlyPairing = $state(false);
	let currentlyConnectingWifi = $state(false);
	let currentlyLoadingWifi = $state(false);
	let currentlySettingRelay = $state(false);

	// Success state
	let successfulConnect = $state(false);
	let successfulScan = $state(false);
	let successfulPair = $state(false);
	let relayConfigured = $state(false);
	let wifiConfigured = $state(false);

	// Data
	let countryCodes = $state({});
	let newRelayDomain = $state();

	// Load WiFi country code list
	onMount(() => {
		fetch("/json/wifi-country-codes.json")
			.then((res) => res.json())
			.then((data) => (countryCodes = data))
			.catch((err) => console.error("Failed to load country codes:", err));
	});

	async function getWifiNetworks() {
		try {
			currentlyLoadingWifi = true;
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
			currentlyLoadingWifi = false;
		}
	}

	async function getWifiAndRelayStatus() {
		try {
			const wifiStatusResponse = await bluetoothInstance.read("wifiStatus");
			wifiConfigured = Boolean(wifiStatusResponse.connected);
			if (wifiStatusResponse.ssid) selectedWiFiSSID = wifiStatusResponse.ssid;
		} catch (error) {
			toast.error("Error getting WiFi status: " + error.message);
		}

		try {
			const relayStatusResponse = await bluetoothInstance.read("relayStatus");
			if (relayStatusResponse.relayDomain) {
				relayConfigured = true;
				relayDomainInput = relayStatusResponse.relayDomain;
			}
		} catch (error) {
			toast.error("Error getting relay status: " + error.message);
		}
	}

	async function connectToWifi() {
		try {
			currentlyConnectingWifi = true;

			const encryption = await Encryption.initForProduct(currentProductId);
			const payload = await encryption.encrypt(
				encode({ ssid: pendingWifiNetwork.ssid, password: wifiPasswordInput, countryCode: wifiCountryCode }),
				null
			);

			await bluetoothInstance.writeAndPoll("wifiConnect", {
				deviceId: localStorage.getItem("deviceId"),
				payload
			});

			wifiConfigured = true;
			selectedWiFiSSID = pendingWifiNetwork.ssid;
			wifiConnectDialogOpen = false;
			toast.success("Connected to " + pendingWifiNetwork.ssid + "!");
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

<div class="flex h-svh w-full flex-col justify-center">
	{#if stepImage[step - 1] && step !== 3}
		<div class="h-[50svh] max-h-[60svw] w-full shrink-0 overflow-hidden border-b">
			<img alt="Step illustration" src={stepImage[step - 1]} class="h-full w-full object-cover" />
		</div>
	{:else if step === 3}
		<div
			class="flex min-h-fit w-full items-center justify-center overflow-hidden border-b bg-white! py-8 md:py-12 lg:py-16"
		>
			{#if pairingCode}
				<div class="pt-0.5 pl-0.5">
					<QrCode value={pairingCode} size={275} errorCorrection="H" />
				</div>
			{:else}
				<p>No pairing code received.</p>
			{/if}
		</div>
	{/if}

	<div class="of-top of-bottom flex grow flex-col space-y-4 overflow-y-auto p-6 lg:p-8">
		<h3 class="text-3xl">{step}. {stepTitle[step - 1] || "Default."}</h3>

		{#if step == 1}
			<p class="max-w-3xl">
				Connect your ROOT camera to power and wait until a startup sound plays. This may take up to 3 minutes in rare cases.
			</p>
			<p class="text-muted-foreground">
				By continuing setup, you agree to our <IframeDialog src="/terms" variant={null}
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
				disabled={currentlyConnectingViaBle || successfulConnect}
				onclick={async () => {
					// Scan for and select a device (opens system prompt)
					try {
						await bluetoothInstance.scan();
					} catch (error) {
						if (!error.message?.includes("User cancelled"))
							toast.error("Error selecting bluetooth device: " + error.message);
						return;
					}

					try {
						// Enter connecting state
						currentlyConnectingViaBle = true;

						// Connect to the selected device
						try {
							await bluetoothInstance.connect();
						} catch (error) {
							throw new Error("Error connecting to bluetooth device: " + error.message);
						}

						// Get pairing code
						try {
							const result = await bluetoothInstance.read("getCode");
							pairingCode = result.code;
						} catch (error) {
							throw new Error("Error getting pairing code: " + error.message);
						}

						// Get product ID to check if already paired
						try {
							const productIdResult = await bluetoothInstance.read("productId");
							currentProductId = productIdResult.productId;

							// Check if this product is already paired
							const existingProduct = getProduct(currentProductId);
							if (existingProduct) alreadyPairedDialogOpen = true;
						} catch (error) {
							throw new Error("Error getting product ID: " + error.message);
						}

						// Set success
						successfulConnect = true;
						vibrate.success();
					} catch (error) {
						bluetoothInstance.disconnect(); // Async, but don't await
						toast.error(error.message);
					} finally {
						currentlyConnectingViaBle = false;
					}
				}}
			>
				{#if currentlyConnectingViaBle}
					<Spinner />
				{/if}
				Open Bluetooth
				{#if successfulConnect && !currentlyConnectingViaBle}
					<RiCheckLine class="h-4! w-4!" />
				{/if}
			</Button>
		{/if}

		{#if step == 3}
			<p class="max-w-3xl">Point your ROOT camera towards the QR code displayed above. Then, click "SCAN CODE".</p>
			<div class="mt-4 space-y-8">
				<Button
					class="w-fit"
					disabled={currentlyScanning || successfulScan}
					onclick={async () => {
						try {
							currentlyScanning = true;
							await bluetoothInstance.read("scanQR");

							// Set success
							successfulScan = true;
							vibrate.success();
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
				{#if !successfulScan}
					<QRViewfinder {bluetoothInstance} />
				{/if}
			</div>
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

							await bluetoothInstance.writeAndRead("pair", {
								deviceId,
								deviceName: deviceNameInput.trim(),
								devicePublicKey: encodeKey(keypair.publicKey)
							});

							// Get model name
							const modelResponse = await bluetoothInstance.read("productModel");

							// Get camera public key
							const publicKeyResponse = await bluetoothInstance.read("productPublicKey");

							// Save product after successful pairing
							saveProduct({
								id: currentProductId,
								name: "My ROOT " + modelResponse.model?.[0]?.toUpperCase() + modelResponse.model?.slice(1), // Don't change this prefix! It needs to match the firmware ProductAlias
								productPublicKey: publicKeyResponse.publicKey,
								devicePublicKey: encodeKey(keypair.publicKey),
								devicePrivateKey: encodeKey(keypair.privateKey),
								keyCreatedAt: Date.now(),
								model: modelResponse.model
							});

							// Get WiFi and relay status
							await getWifiAndRelayStatus();

							// Set success
							successfulPair = true;
							vibrate.success();

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
				<p class="max-w-3xl">The product is connected to Wifi. The network can be changed below.</p>
			{/if}
			<div class="mt-4 space-y-4">
				<div
					class="relative h-28 w-full max-w-xl overflow-hidden p-px pb-0 outline outline-1 -outline-offset-1 outline-border"
				>
					<div class="of-top of-bottom no-scrollbar h-full w-full overflow-y-auto">
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
									class="flex w-full items-center justify-between gap-2 border-b p-2 hover:bg-accent/50 active:bg-accent/50 {network.ssid ===
									selectedWiFiSSID
										? 'pointer-events-none bg-muted'
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
										</p>
									</span>
									<span class="text-sm text-nowrap">{network.signal}/100</span>
								</div>
							{/each}
						{:else}
							<div class="flex h-full w-full items-center justify-center p-4">
								<p class="text-center text-sm">{currentlyLoadingWifi ? "Loading..." : "No networks found."}</p>
							</div>
						{/if}
					</div>
				</div>
				<Button class="w-fit" variant="outline" onclick={getWifiNetworks} disabled={currentlyLoadingWifi}>
					Refresh
					{#if currentlyLoadingWifi}
						<Spinner />
					{:else}
						<RiRefreshLine class="size-4" />
					{/if}
				</Button>
			</div>
		{/if}

		{#if step == 6}
			{#if !relayConfigured}
				<p class="max-w-3xl">
					Please set a relay domain. Custom relay servers give extra flexibility for advanced users.
				</p>
			{:else}
				<p class="max-w-3xl">The relay domain is configured. It can be adjusted below.</p>
			{/if}

			<div class="mt-4 space-y-4">
				<div class="space-y-1">
					<Label for="relay-domain">Domain</Label>
					<Input type="text" placeholder="relay.com" class="max-w-xs" id="relay-domain" bind:value={relayDomainInput} />
				</div>
				<div class="flex flex-wrap items-center gap-4">
					<Button
						class="w-fit"
						variant={relayConfigured ? "outline" : "default"}
						disabled={currentlySettingRelay}
						onclick={async () => {
							try {
								currentlySettingRelay = true;
								const relayDomain = relayDomainInput.trim();
								const encryption = await Encryption.initForProduct(currentProductId);
								const payload = await encryption.encrypt(encode({ relayDomain }), null);
								await bluetoothInstance.writeAndRead("relaySet", {
									deviceId: localStorage.getItem("deviceId"),
									payload
								});
								relayConfigured = true;
								newRelayDomain = relayDomain; // Passed to adjust connect relay dialog
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
							Update domain
						{/if}
					</Button>
					{#if relayDomainInput !== DEFAULT_RELAY_DOMAIN}
						<Label><RiAlertLine class="size-4!" /> Unofficial!</Label>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div class="mt-auto flex w-full justify-between gap-8 p-6 pb-8! max-sm:pb-10! lg:p-8">
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
							All setup progress will be lost.
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

<!-- Wifi dialog -->
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
				<div class="relative flex gap-2">
					<Input
						id="password-input"
						type={showWifiPassword ? "text" : "password"}
						bind:value={wifiPasswordInput}
						placeholder="wifi-password-123"
						autocomplete="off"
					/>
					<Button
						variant="ghost"
						size="icon"
						class="flex items-center justify-center"
						onclick={() => (showWifiPassword = !showWifiPassword)}
						tabindex={-1}
					>
						{#if showWifiPassword}
							<RiEyeLine class="size-4" />
						{:else}
							<RiEyeCloseLine class="size-4" />
						{/if}
					</Button>
				</div>
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
			<AlertDialog.Cancel disabled={currentlyConnectingWifi}>Cancel</AlertDialog.Cancel>
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

<!-- Already Paired Dialog -->
<Dialog.Root bind:open={alreadyPairedDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Already paired</Dialog.Title>
		</Dialog.Header>
		<p>This product is already paired. You can jump ahead to WiFi and relay configuration to adjust those settings.</p>
		<p>
			If you're experiencing issues and want to intentionally re-pair, repeating the full setup process is recommended.
		</p>
		<Dialog.Footer class="mt-4">
			<Button
				onclick={async () => {
					alreadyPairedDialogOpen = false;
					step = 5;
					await getWifiAndRelayStatus();
					await getWifiNetworks();
				}}
			>
				Jump ahead
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<AdjustConnectRelayDialog {newRelayDomain} />
<WebBluetoothUnsupportedDialog />
