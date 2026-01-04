<script>
	import { page } from "$app/state";
	import { onMount, onDestroy, tick } from "svelte";
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { getProduct } from "$lib/utils/pairedProductsStorage";
	import { RelayComm, RELAY_REQUEST_TIMEOUT } from "$lib/utils/relaycomm";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";
	import {
		RiArrowLeftLine,
		RiPlayCircleLine,
		RiStopCircleLine,
		RiRestartLine,
		RiDeleteBinLine,
		RiDownloadLine,
		RiRefreshLine
	} from "svelte-remixicon";

	const productId = page.params.productId;

	let product = $state(null);
	let relayCommInstance;
	let isStreaming = $state(false);
	let streamLoading = $state(true);
	let heartbeatInterval;

	// Events
	let events = $state([]);
	let eventsLoading = $state(false);
	let selectedEvent = $state(null);
	let eventThumbnails = $state({});
	let viewRecordingDialog = $state(false);

	// Controls
	let micEnabled = $state(false);
	let recordingSoundEnabled = $state(false);
	let controlsLoading = $state({});

	// Health
	let health = $state(null);
	let healthLoading = $state(false);
	let logsContainer = $state();
	let activeTab = $state("events");

	// Video streaming
	let videoElement = $state();
	let mediaSource;
	let sourceBuffer;

	onMount(async () => {
		product = getProduct(productId);
		if (!product) {
			toast.error("Product not found");
			goto("/connect");
			return;
		}

		const relayDomain = localStorage.getItem("relayDomain") || DEFAULT_RELAY_DOMAIN;
		const deviceId = localStorage.getItem("deviceId");
		if (!deviceId) return toast.error("No device ID set!");

		try {
			// Set up MediaSource early so it's ready when chunks arrive
			setupMediaSource();

			relayCommInstance = new RelayComm(relayDomain, deviceId);
			await relayCommInstance.connect();

			// Set up message handlers
			relayCommInstance.on("getEventsResult", handleEventsResult);
			relayCommInstance.on("getThumbnailResult", handleThumbnailResult);
			relayCommInstance.on("getRecordingResult", handleRecordingResult);
			relayCommInstance.on("setMicrophoneResult", handleSetMicrophoneResult);
			relayCommInstance.on("setRecordingSoundResult", handleSetRecordingSoundResult);
			relayCommInstance.on("getHealthResult", handleHealthResult);
			relayCommInstance.on("startUpdateResult", handleStartUpdateResult);
			relayCommInstance.on("restartResult", handleRestartResult);
			relayCommInstance.on("resetResult", handleResetResult);
			relayCommInstance.on("startStreamResult", handleStartStreamResult);
			relayCommInstance.on("continueStreamResult", (msg) => {
				if (!msg.payload.success) toast.error(msg.payload.error || "Stream heartbeat failed");
			});
			relayCommInstance.on("streamVideoChunkResult", handleStreamVideoChunk);

			// Load initial data and start stream
			loadEvents();
			loadHealth();
			startStream();
		} catch (error) {
			toast.error("Failed to connect to relay: " + error.message);
			console.error("Failed to connect to relay:", error);
		}
	});

	onDestroy(() => {
		if (heartbeatInterval) clearInterval(heartbeatInterval);
		if (mediaSource) {
			if (videoElement) videoElement.src = "";
			mediaSource = null;
			sourceBuffer = null;
		}
		if (relayCommInstance) relayCommInstance.disconnect();
	});

	// Events handlers
	function loadEvents() {
		eventsLoading = true;
		relayCommInstance.send(productId, "getEvents").catch((error) => {
			toast.error("Failed to load events: " + error.message);
			console.error(error);
		});
	}

	function handleEventsResult(msg) {
		if (!msg.payload.success) {
			toast.error(msg.payload.error || "Failed to load events");
			eventsLoading = false;
			return;
		}
		events = msg.payload.events || [];
		eventsLoading = false;

		// Load thumbnails for events
		events.forEach((event) => {
			relayCommInstance.send(productId, "getThumbnail", { id: event.id }).catch(console.error);
		});
	}

	function handleThumbnailResult(msg) {
		if (!msg.payload.success) return;

		const eventId = msg.payload.id || Object.keys(eventThumbnails).length;
		eventThumbnails[eventId] = msg.payload.data;
	}

	function viewRecording(event) {
		selectedEvent = event;
		viewRecordingDialog = true;
		relayCommInstance.send(productId, "getRecording", { id: event.id }).catch((error) => {
			toast.error("Failed to load recording: " + error.message);
			console.error(error);
		});
	}

	function handleRecordingResult(msg) {
		if (!msg.payload.success) return toast.error(msg.payload.error || "Failed to load recording");

		// Create blob and download
		const byteCharacters = atob(msg.payload.data);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: "video/mp4" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `recording-${selectedEvent.id}.mp4`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Streaming handlers
	function setupMediaSource() {
		mediaSource = new MediaSource();
		videoElement.src = URL.createObjectURL(mediaSource);

		mediaSource.addEventListener("sourceopen", () => {
			sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001f"');
			sourceBuffer.mode = "sequence";
		});

		videoElement.addEventListener("error", () => {
			if (videoElement?.error) {
				console.error("Video playback error:", videoElement.error);
				streamLoading = false;
			}
		});
	}

	function startStream() {
		relayCommInstance.send(productId, "startStream").catch((error) => {
			toast.error("Failed to start stream: " + error.message);
			console.error(error);
			streamLoading = false;
		});
	}

	function sendHeartbeat() {
		relayCommInstance.send(productId, "continueStream").catch((error) => {
			console.error("Failed to send heartbeat:", error);
		});
	}

	function handleStartStreamResult(msg) {
		if (!msg.payload.success) {
			streamLoading = false;
			return toast.error(msg.payload.error || "Failed to start stream");
		}

		isStreaming = true;
		heartbeatInterval = setInterval(sendHeartbeat, 2000);
	}

	function handleStreamVideoChunk(msg) {
		if (!msg.payload.success) return;

		// Wait for MediaSource to be ready
		if (mediaSource.readyState !== "open" || !sourceBuffer) return;

		if (videoElement?.error) return; // Stop processing if video has an error
		if (streamLoading) streamLoading = false; // Hide loading spinner on first chunk

		const bytes = atob(msg.payload.chunk);
		const buffer = new Uint8Array(bytes.length);
		for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);

		if (!sourceBuffer.updating) {
			try {
				sourceBuffer.appendBuffer(buffer);
			} catch (err) {
				console.error("Failed to append buffer:", err);
			}
		}
	}

	// Controls handlers
	function toggleMicrophone() {
		controlsLoading.mic = true;
		const newValue = !micEnabled;
		relayCommInstance.send(productId, "setMicrophone", { enabled: newValue }).catch((error) => {
			toast.error("Failed to toggle microphone: " + error.message);
			console.error(error);
			controlsLoading.mic = false;
		});
	}

	function handleSetMicrophoneResult(msg) {
		controlsLoading.mic = false;
		if (!msg.payload.success) {
			toast.error(msg.payload.error || "Failed to set microphone");
			return;
		}
		micEnabled = msg.payload.enabled;
	}

	function toggleRecordingSound() {
		controlsLoading.sound = true;
		const newValue = !recordingSoundEnabled;
		relayCommInstance.send(productId, "setRecordingSound", { enabled: newValue }).catch((error) => {
			toast.error("Failed to toggle recording sound: " + error.message);
			console.error(error);
			controlsLoading.sound = false;
		});
	}

	function handleSetRecordingSoundResult(msg) {
		controlsLoading.sound = false;
		if (!msg.payload.success) {
			toast.error(msg.payload.error || "Failed to set recording sound");
			return;
		}
		recordingSoundEnabled = msg.payload.enabled;
	}

	function restartDevice() {
		controlsLoading.restart = true;
		relayCommInstance.send(productId, "restart").catch((error) => {
			toast.error("Failed to restart device: " + error.message);
			console.error(error);
			controlsLoading.restart = false;
		});
	}

	function handleRestartResult(msg) {
		controlsLoading.restart = false;
		if (!msg.payload.success) {
			toast.error(msg.payload.error || "Failed to restart device");
			return;
		}
		toast.success("Restarting.");
	}

	function resetDevice() {
		controlsLoading.reset = true;
		relayCommInstance.send(productId, "reset").catch((error) => {
			toast.error("Failed to reset device: " + error.message);
			console.error(error);
			controlsLoading.reset = false;
		});
	}

	function handleResetResult(msg) {
		controlsLoading.reset = false;
		if (!msg.payload.success) {
			toast.error(msg.payload.error || "Failed to reset device");
			return;
		}
		toast.success("Reset initiated.");
		setTimeout(() => {
			goto("/connect");
		}, 2000);
	}

	// Health handlers
	function loadHealth() {
		healthLoading = true;
		relayCommInstance.send(productId, "getHealth").catch((error) => {
			toast.error("Failed to load health data: " + error.message);
			console.error(error);
			healthLoading = false;
		});
	}

	function handleHealthResult(msg) {
		healthLoading = false;
		if (!msg.payload.success) {
			toast.error(msg.payload.error || "Failed to load health data");
			return;
		}
		health = {
			battery: msg.payload.battery,
			wifi: msg.payload.wifi,
			firmwareVersion: msg.payload.firmwareVersion,
			update: msg.payload.update,
			relayDomain: msg.payload.relayDomain,
			logs: msg.payload.logs,
			performance: msg.payload.performance
		};
	}

	$effect(() => {
		// Scroll logs to bottom by default upon load
		if (logsContainer && health?.logs?.length && activeTab === "health") {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});

	function startUpdate() {
		controlsLoading.update = true;
		relayCommInstance.send(productId, "startUpdate").catch((error) => {
			toast.error("Failed to start update: " + error.message);
			console.error(error);
			controlsLoading.update = false;
		});
	}

	function handleStartUpdateResult(msg) {
		controlsLoading.update = false;
		if (!msg.payload.success) {
			toast.error(msg.payload.error || "Failed to start update");
			return;
		}
		toast.success("Update started!");
		loadHealth();
	}
</script>

<div class="absolute top-0 left-0 flex text-xl">
	<Button class="h-20! border-t-0 border-b-0 border-l-0 p-6!" variant="outline" href="/connect">
		<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
	</Button>
</div>

<div class="flex min-h-svh w-full flex-col divide-y pt-20">
	<div class="relative aspect-16/9 w-full border-t bg-black">
		{#if streamLoading}
			<div class="absolute inset-0 flex items-center justify-center text-background">
				<Spinner class="size-8" />
			</div>
		{/if}
		<video bind:this={videoElement} class="h-full w-full" autoplay playsinline muted></video>
	</div>
	<div class="w-full basis-full">
		<Tabs.Root value="events" onValueChange={(v) => (activeTab = v)}>
			<div class="w-full">
				<Tabs.List class="w-full">
					<Tabs.Trigger value="events">Events</Tabs.Trigger>
					<Tabs.Trigger value="controls">Controls</Tabs.Trigger>
					<Tabs.Trigger value="health">Health</Tabs.Trigger>
				</Tabs.List>
			</div>
			<Tabs.Content value="events" class="relative space-y-6 p-6">
				<div class="flex items-center justify-end">
					<Button onclick={loadEvents} variant="outline" size="sm" disabled={eventsLoading}>
						Refresh
						{#if !eventsLoading}
							<RiRefreshLine class="size-4" />
						{:else}
							<Spinner class="size-4" />
						{/if}
					</Button>
				</div>
				<div class="of-top of-bottom no-scrollbar max-h-[50svh] w-full divide-y overflow-y-auto border">
					{#if events.length === 0}
						<div class="p-4 text-center text-muted-foreground">No events recorded yet.</div>
					{:else}
						{#each events as event}
							<div class="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
								<div class="aspect-video h-20 shrink-0 overflow-hidden rounded bg-muted">
									{#if eventThumbnails[event.id]}
										<img
											src={"data:image/jpg;base64," + eventThumbnails[event.id]}
											alt="Event thumbnail"
											class="h-full w-full object-cover"
										/>
									{:else}
										<div class="flex h-full w-full items-center justify-center">
											<Spinner class="size-4" />
										</div>
									{/if}
								</div>
								<div class="flex-1">
									<p class="font-medium">{new Date(event.timestamp).toLocaleString()}</p>
									<p class="text-sm text-muted-foreground">
										Duration: {event.duration || "N/A"}s
									</p>
								</div>
								<Button onclick={() => viewRecording(event)} variant="outline" size="sm" class="gap-2">
									<RiDownloadLine class="size-4" />
									Download
								</Button>
							</div>
						{/each}
					{/if}
				</div>
			</Tabs.Content>
			<Tabs.Content value="controls" class="space-y-6 p-6">
				<div class="space-y-6">
					<div class="flex items-center justify-between rounded-lg border p-4">
						<div>
							<Label class="text-base">Microphone</Label>
							<p class="text-sm text-muted-foreground">Record audio together with video.</p>
						</div>
						<Button onclick={toggleMicrophone} variant="outline" disabled={controlsLoading.mic}>
							{#if controlsLoading.mic}
								<Spinner class="size-4" />
							{:else}
								{micEnabled ? "Enabled" : "Disabled"}
							{/if}
						</Button>
					</div>
					<div class="flex items-center justify-between rounded-lg border p-4">
						<div>
							<Label class="text-base">Recording sound</Label>
							<p class="text-sm text-muted-foreground">Play sound when recording or streaming.</p>
						</div>
						<Button onclick={toggleRecordingSound} variant="outline" disabled={controlsLoading.sound}>
							{#if controlsLoading.sound}
								<Spinner class="size-4" />
							{:else}
								{recordingSoundEnabled ? "Enabled" : "Disabled"}
							{/if}
						</Button>
					</div>
					<AlertDialog.Root>
						<AlertDialog.Trigger
							class="{buttonVariants({ variant: 'outline' })} w-full gap-2"
							disabled={controlsLoading.restart}
						>
							{#if controlsLoading.restart}
								<Spinner class="size-4" />
							{:else}
								<RiRestartLine class="size-4" />
							{/if}
							Restart
						</AlertDialog.Trigger>
						<AlertDialog.Content>
							<AlertDialog.Header>
								<AlertDialog.Title>Restart?</AlertDialog.Title>
								<AlertDialog.Description>
									This will restart the product. The connection will be lost temporarily.
								</AlertDialog.Description>
							</AlertDialog.Header>
							<AlertDialog.Footer>
								<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
								<AlertDialog.Action onclick={restartDevice}>Restart</AlertDialog.Action>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>

					<AlertDialog.Root>
						<AlertDialog.Trigger
							class="{buttonVariants({ variant: 'outline' })} w-full gap-2"
							disabled={controlsLoading.reset}
						>
							{#if controlsLoading.reset}
								<Spinner class="size-4" />
							{:else}
								<RiDeleteBinLine class="size-4" />
							{/if}
							Factory reset
						</AlertDialog.Trigger>
						<AlertDialog.Content>
							<AlertDialog.Header>
								<AlertDialog.Title>Factory reset</AlertDialog.Title>
								<AlertDialog.Description>
									This will erase all data and settings. This action cannot be undone.
								</AlertDialog.Description>
							</AlertDialog.Header>
							<AlertDialog.Footer>
								<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
								<AlertDialog.Action onclick={resetDevice}>Reset product</AlertDialog.Action>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>
				</div>
			</Tabs.Content>
			<Tabs.Content value="health" class="space-y-6 p-6">
				<div class="flex items-center justify-end">
					<Button onclick={loadHealth} variant="outline" size="sm" disabled={healthLoading}>
						Refresh
						{#if !healthLoading}
							<RiRefreshLine class="size-4" />
						{:else}
							<Spinner class="size-4" />
						{/if}
					</Button>
				</div>

				{#if health}
					<div class="space-y-6">
						<div class="rounded-lg border p-4">
							<h4 class="mb-4 font-medium">Performance</h4>
							<div class="space-y-2 text-sm">
								{#if health.performance.cpuUsagePercent !== undefined}
									<div class="flex justify-between">
										<span class="text-muted-foreground">CPU usage</span>
										<span>{health.performance.cpuUsagePercent.toFixed(1)}%</span>
									</div>
								{/if}
								{#if health.performance.cpuTempCelsius !== undefined}
									<div class="flex justify-between">
										<span class="text-muted-foreground">CPU temperature</span>
										<span>{health.performance.cpuTempCelsius.toFixed(1)}°C</span>
									</div>
								{/if}
								{#if health.performance.memoryUsagePercent !== undefined}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Memory usage</span>
										<span>{health.performance.memoryUsagePercent.toFixed(1)}%</span>
									</div>
								{/if}
								{#if health.performance.diskUsagePercent !== undefined}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Disk usage</span>
										<span>{health.performance.diskUsagePercent.toFixed(1)}%</span>
									</div>
								{/if}
								{#if health.performance.uptimeSeconds !== undefined}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Uptime</span>
										<span
											>{Math.floor(health.performance.uptimeSeconds / 3600)}h {Math.floor(
												(health.performance.uptimeSeconds % 3600) / 60
											)}m</span
										>
									</div>
								{/if}
							</div>
						</div>

						<div class="rounded-lg border p-4">
							<h4 class="mb-4 font-medium">Network</h4>
							<div class="space-y-2 text-sm">
								<div class="flex justify-between">
									<span class="text-muted-foreground">WiFi status</span>
									<span>{health.wifi.connected ? "Connected" : "Disconnected"}</span>
								</div>
								{#if health.wifi.ssid}
									<div class="flex justify-between">
										<span class="text-muted-foreground">SSID</span>
										<span>{health.wifi.ssid}</span>
									</div>
								{/if}
								<div class="flex justify-between">
									<span class="text-muted-foreground">Relay</span>
									<span class="truncate">{health.relayDomain}</span>
								</div>
							</div>
						</div>

						<div class="rounded-lg border p-4">
							<h4 class="mb-4 font-medium">Firmware</h4>
							<div class="space-y-2 text-sm">
								<div class="flex justify-between">
									<span class="text-muted-foreground">Version</span>
									<span>{health.firmwareVersion}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">Update status</span>
									<span>{health.update.status}</span>
								</div>
								{#if health.update.availableVersion}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Available</span>
										<span>{health.update.availableVersion}</span>
									</div>
									<Button onclick={startUpdate} class="w-full" disabled={controlsLoading.update}>
										{#if controlsLoading.update}
											<Spinner class="size-4" />
										{:else}
											Install update
										{/if}
									</Button>
								{/if}
								{#if health.update.error}
									<p class="text-sm text-destructive">{health.update.error}</p>
								{/if}
							</div>
						</div>

						{#if health.logs && health.logs.length > 0}
							<div class="rounded-lg border p-4">
								<h4 class="mb-4 font-medium">Logs</h4>
								<div class="relative h-60 overflow-hidden border bg-muted p-4 text-xs">
									<div
										bind:this={logsContainer}
										class="of-top of-bottom of-length-2 h-full w-full overflow-x-hidden overflow-y-auto break-all"
									>
										{#each health.logs as log}
											<div><span class="text-muted-foreground">[{log.time}]</span> {log.msg}</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</Tabs.Content>
		</Tabs.Root>
	</div>
</div>
