<script>
	import { page } from "$app/state";
	import { onMount, onDestroy } from "svelte";
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import Separator from "$lib/components/ui/separator/separator.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import * as Popover from "$lib/components/ui/popover";
	import * as RangeCalendar from "$lib/components/ui/range-calendar";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { getProduct } from "$lib/utils/pairedProductsStorage";
	import { RelayComm, RELAY_REQUEST_TIMEOUT } from "$lib/utils/relaycomm";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";
	import {
		RiArrowLeftLine,
		RiRestartLine,
		RiDownloadLine,
		RiRefreshLine,
		RiVolumeUpLine,
		RiVolumeMuteLine,
		RiCloseLine,
		RiFileShredLine,
		RiFullscreenLine,
		RiFullscreenExitLine,
		RiSearchAi2Line,
		RiTimeLine,
		RiEyeLine,
		RiCalendarLine,
		RiFilter3Line
	} from "svelte-remixicon";
	import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
	import { base64ToBlob } from "$lib/utils/base64ToBlob";

	const productId = page.params.productId;

	let product = $state(null);
	let relayCommInstance;
	let streamLoading = $state(true);
	let streamHeartbeatInterval;

	// Events
	let events = $state([]);
	let eventsLoading = $state(false);
	let selectedEvent = $state(null);
	let eventThumbnails = $state({});
	let viewRecordingDialog = $state(false);
	let recordingAudioElement = $state();
	let recordingVideoLoading = $state(false);
	let recordingVideoUrl = $state(null);
	let recordingAudioUrl = $state(null);

	// Event filters
	let dateRangeOpen = $state(false);
	let dateRangeValue = $state(undefined);
	let typeFilterOpen = $state(false);
	let selectedTypes = $state([]);

	// Controls
	let micEnabled = $state(false);
	let recordingSoundEnabled = $state(false);
	let controlsLoading = $state({});
	let restartDialogOpen = $state(false);
	let resetDialogOpen = $state(false);

	// Devices
	let devices = $state([]);
	let devicesLoading = $state(false);
	let removeDeviceDialogOpen = $state({});

	// Health
	let health = $state(null);
	let healthLoading = $state(false);
	let logsContainer = $state();
	let activeTab = $state("events");

	// Video streaming
	let videoElement = $state();
	let mediaSource;
	let sourceBuffer;
	let videoStarted = false;

	// Audio streaming
	let audioContext;
	let audioMuted = $state(false);
	let nextAudioTime = 0;
	let audioStarted = false;

	// Fullscreen
	let isFullscreen = $state(false);

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
			relayCommInstance = new RelayComm(relayDomain, deviceId);
			await relayCommInstance.connect();

			// Set up message handlers
			relayCommInstance.on("getEventsResult", handleEventsResult);
			relayCommInstance.on("getThumbnailResult", handleThumbnailResult);
			relayCommInstance.on("getRecordingResult", handleRecordingResult);
			relayCommInstance.on("getMicrophoneResult", handleGetMicrophoneResult);
			relayCommInstance.on("setMicrophoneResult", handleSetMicrophoneResult);
			relayCommInstance.on("getRecordingSoundResult", handleGetRecordingSoundResult);
			relayCommInstance.on("setRecordingSoundResult", handleSetRecordingSoundResult);
			relayCommInstance.on("getDevicesResult", handleGetDevicesResult);
			relayCommInstance.on("removeDeviceResult", handleRemoveDeviceResult);
			relayCommInstance.on("getHealthResult", handleHealthResult);
			relayCommInstance.on("startUpdateResult", handleStartUpdateResult);
			relayCommInstance.on("restartResult", handleRestartResult);
			relayCommInstance.on("resetResult", handleResetResult);
			relayCommInstance.on("startStreamResult", handleStartStreamResult);
			relayCommInstance.on("continueStreamResult", (msg) => {
				if (!msg.payload.success) toast.error(msg.payload.error || "Stream heartbeat failed");
			});
			relayCommInstance.on("streamVideoChunkResult", handleStreamVideoChunk);
			relayCommInstance.on("streamAudioChunkResult", handleStreamAudioChunk);

			// Handle tab visibility changes
			if (typeof window !== "undefined") document.addEventListener("visibilitychange", handleVisibilityChange);

			// Load initial data and start stream
			loadEvents();
			loadHealth();
			loadMicrophone();
			loadRecordingSound();
			loadDevices();
			startStream();
		} catch (error) {
			toast.error("Failed to connect to relay: " + error.message);
			console.error("Failed to connect to relay:", error);
		}
	});

	onDestroy(() => {
		if (typeof window !== "undefined") document.removeEventListener("visibilitychange", handleVisibilityChange);
		stopStream();
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
			toast.error("Failed to load events: " + msg.payload.error || "Unknown error");
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
		if (!msg.payload.success) return toast.error("Failed to get thumbnail: " + msg.payload.error || "Unknown error");
		eventThumbnails[msg.payload.eventId] = msg.payload.data;
	}

	function viewRecording(event) {
		selectedEvent = event;
		viewRecordingDialog = true;
		recordingVideoLoading = true;
		recordingVideoUrl = null;
		recordingAudioUrl = null;
		relayCommInstance.send(productId, "getRecording", { id: event.id }).catch((error) => {
			toast.error("Failed to load recording: " + error.message);
			console.error(error);
			recordingVideoLoading = false;
		});
	}

	function handleRecordingResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to load recording: " + msg.payload.error || "Unknown error");
			recordingVideoLoading = false;
			return;
		}

		recordingVideoUrl = URL.createObjectURL(base64ToBlob(msg.payload.video, "video/mp4"));
		if (msg.payload.audio) recordingAudioUrl = URL.createObjectURL(base64ToBlob(msg.payload.audio, "audio/mp4"));
		recordingVideoLoading = false;
	}

	function onRecordingDialogClose() {
		if (recordingVideoUrl) {
			URL.revokeObjectURL(recordingVideoUrl);
			recordingVideoUrl = null;
		}
		if (recordingAudioUrl) {
			URL.revokeObjectURL(recordingAudioUrl);
			recordingAudioUrl = null;
		}
	}

	// Streaming handlers
	function setupMediaSource() {
		mediaSource = new MediaSource();
		videoElement.src = URL.createObjectURL(mediaSource);

		mediaSource.addEventListener("sourceopen", () => {
			sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001f"');
			sourceBuffer.mode = "sequence";
			processPendingChunks();
			sourceBuffer.addEventListener("updateend", () => {
				processPendingChunks();

				// Start playback once we at least one chunk in the buffer
				if (!videoStarted && videoElement.buffered.length > 0) {
					videoStarted = true;
					videoElement.play().catch(console.error);
				}
			});
		});

		videoElement.addEventListener("error", () => {
			// Ignore empty src errors (code 4) from stopStream()
			if (videoElement?.error && videoElement.error.code !== 4) {
				console.error("Video playback error:", videoElement.error);
			}
		});
	}

	function startStream() {
		relayCommInstance.send(productId, "startStream").catch((error) => {
			onStreamStopped(error);
		});
	}

	function stopStream() {
		pendingChunks = [];
		if (streamHeartbeatInterval) {
			clearInterval(streamHeartbeatInterval);
			streamHeartbeatInterval = null;
		}
		if (mediaSource) {
			mediaSource = null;
			sourceBuffer = null;
			videoStarted = false;
		}
		if (videoElement) {
			videoElement.src = "";
			videoElement.load();
		}
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		bufferedChunks = [];
		nextAudioTime = 0;
		audioStarted = false;
		streamLoading = true;
	}

	function onStreamStopped(reason) {
		toast.error("Stream failed: " + reason);
		console.error("Stream failed: ", reason);
		stopStream();
	}

	function startStreamHeartbeat() {
		streamHeartbeatInterval = setInterval(() => {
			relayCommInstance.send(productId, "continueStream").catch((error) => {
				console.error("Failed to send heartbeat:", error);
			});
		}, 2000);
	}

	function handleStartStreamResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to start stream: " + msg.payload.error || "Unknown error");
			return;
		}

		if (!mediaSource) setupMediaSource();
		if (micEnabled && !audioContext) setupAudioContext();
		if (!streamHeartbeatInterval) startStreamHeartbeat();
	}

	let pendingChunks = $state([]);

	function handleStreamVideoChunk(msg) {
		if (!msg.payload.success) {
			onStreamStopped(msg.payload.error);
			return;
		}

		if (streamLoading && msg.payload.chunkIndex !== 0)
			return console.warn("Received chunk with wrong index, waiting for index 0.");

		if (videoElement?.error) return;

		const bytes = atob(msg.payload.chunk);
		const buffer = new Uint8Array(bytes.length);
		for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);

		// Queue chunks if MediaSource isn't ready yet
		if (mediaSource.readyState !== "open" || !sourceBuffer) {
			pendingChunks.push(buffer);
			return;
		}

		// Always queue chunks and let processPendingChunks handle them sequentially
		streamLoading = false; // Hide loading spinner, now that chunks are coming in and displaying
		pendingChunks.push(buffer);
		processPendingChunks();
	}

	function processPendingChunks() {
		if (pendingChunks.length > 0 && sourceBuffer && !sourceBuffer.updating) {
			const next = pendingChunks.shift();
			try {
				sourceBuffer.appendBuffer(next);
			} catch (err) {
				console.error("Failed to append queued buffer:", err);
			}
		}
	}

	function handleVisibilityChange() {
		if (document.hidden) stopStream();
		else startStream();
	}

	// Audio streaming functions
	function setupAudioContext() {
		audioContext = new AudioContext();
		nextAudioTime = 0;
		audioStarted = false;
	}

	let bufferedChunks = [];
	function handleStreamAudioChunk(msg) {
		if (!msg.payload.success) {
			console.error("Audio stream error:", msg.payload.error);
			return;
		}
		if (!audioContext || audioMuted) return;

		// Decode PCM data
		const bytes = atob(msg.payload.chunk);
		const pcmData = new Int16Array(bytes.length / 2);
		for (let i = 0; i < pcmData.length; i++) {
			pcmData[i] = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8); // Bitwise OR (|)
		}

		// Convert Int16 PCM to Float32
		const float32Data = new Float32Array(pcmData.length);
		for (let i = 0; i < pcmData.length; i++) {
			float32Data[i] = pcmData[i] / 32768.0;
		}

		// Create audio buffer (48kHz mono)
		const audioBuffer = audioContext.createBuffer(1, float32Data.length, 48000);
		audioBuffer.getChannelData(0).set(float32Data);
		bufferedChunks.push(audioBuffer);

		// Wait for initial buffer before starting (1 chunk)
		if (!audioStarted && bufferedChunks.length >= 1) {
			audioStarted = true;
			nextAudioTime = audioContext.currentTime;
			scheduleAudio();
		} else if (audioStarted) scheduleAudio();
	}

	function scheduleAudio() {
		const drift = audioContext.currentTime - nextAudioTime;
		if (drift > 0.05) nextAudioTime += drift * 0.5; // Only correct if drift is >50ms, correct "halfway" for smooth correction

		// Schedule chunks to maintain ~500ms buffer
		while (bufferedChunks.length > 0 && nextAudioTime - audioContext.currentTime < 0.5) {
			const chunk = bufferedChunks.shift();
			const source = audioContext.createBufferSource();
			source.buffer = chunk;
			source.connect(audioContext.destination);
			source.start(nextAudioTime);
			nextAudioTime += chunk.duration;
		}
	}

	// Controls handlers
	function loadMicrophone() {
		relayCommInstance.send(productId, "getMicrophone").catch((error) => {
			console.error("Failed to load microphone setting:", error);
		});
	}

	function handleGetMicrophoneResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to load microphone setting: " + msg.payload.error || "Unknown error");
			return;
		}
		micEnabled = msg.payload.enabled;
	}

	function toggleMicrophone() {
		controlsLoading.mic = true;
		const newValue = !micEnabled;
		relayCommInstance.send(productId, "setMicrophone", { enabled: newValue }).catch((error) => {
			toast.error("Failed to set microphone: " + error.message);
			console.error(error);
			controlsLoading.mic = false;
		});
	}

	function handleSetMicrophoneResult(msg) {
		controlsLoading.mic = false;
		if (!msg.payload.success) {
			toast.error("Failed to set microphone: " + msg.payload.error || "Unknown error");
			return;
		}
		micEnabled = msg.payload.enabled;
		startStream(); // Restart stream to apply microphone changes
	}

	function loadRecordingSound() {
		relayCommInstance.send(productId, "getRecordingSound").catch((error) => {
			console.error("Failed to load recording sound setting:", error);
		});
	}

	function handleGetRecordingSoundResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to load recording sound setting: " + msg.payload.error || "Unknown error");
			return;
		}
		recordingSoundEnabled = msg.payload.enabled;
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
			toast.error("Failed to set recording sound: " + msg.payload.error || "Unknown error");
			return;
		}
		recordingSoundEnabled = msg.payload.enabled;
	}

	function loadDevices() {
		devicesLoading = true;
		relayCommInstance.send(productId, "getDevices").catch((error) => {
			toast.error("Failed to load devices: " + error.message);
			console.error(error);
			devicesLoading = false;
		});
	}

	function handleGetDevicesResult(msg) {
		devicesLoading = false;
		if (!msg.payload.success) {
			toast.error("Failed to load devices: " + msg.payload.error || "Unknown error");
			return;
		}
		devices = msg.payload.devices || [];
	}

	function removeDevice(deviceId) {
		removeDeviceDialogOpen[deviceId] = false;
		controlsLoading[`remove-${deviceId}`] = true;
		relayCommInstance.send(productId, "removeDevice", { targetDeviceId: deviceId }).catch((error) => {
			toast.error("Failed to remove device: " + error.message);
			console.error(error);
			controlsLoading[`remove-${deviceId}`] = false;
		});
	}

	function handleRemoveDeviceResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to remove device: " + msg.payload.error || "Unknown error");
			Object.keys(controlsLoading).forEach((key) => {
				if (key.startsWith("remove-")) controlsLoading[key] = false;
			});
			return;
		}
		const removedId = msg.payload.removedDeviceId;
		devices = devices.filter((d) => d.id !== removedId);
		controlsLoading[`remove-${removedId}`] = false;
	}

	function restartDevice() {
		restartDialogOpen = false;
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
		resetDialogOpen = false;
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
			toast.error("Failed to reset device: " + msg.payload.error || "Unknown error");
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
			toast.error("Failed to load health data: " + msg.payload.error || "Unknown error");
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
			toast.error("Failed to start update: " + msg.payload.error || "Unknown error");
			return;
		}
		toast.success("Update started!");
		loadHealth();
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			videoElement?.parentElement?.requestFullscreen();
			isFullscreen = true;
		} else {
			document.exitFullscreen();
			isFullscreen = false;
		}
	}

	// Event filtering and grouping
	const hasDateFilter = $derived(dateRangeValue?.start && dateRangeValue?.end);
	const hasTypeFilter = $derived(selectedTypes.length > 0);

	function capitalizeType(type) {
		return type?.charAt(0).toUpperCase() + type?.slice(1);
	}

	const availableTypes = $derived([...new Set(events.map((e) => capitalizeType(e.event_type)).filter(Boolean))].sort());

	const filteredEvents = $derived(
		events.filter((event) => {
			// Date range filter
			if (hasDateFilter) {
				const eventDate = new Date(event.timestamp).setHours(0, 0, 0, 0);
				const startDate = dateRangeValue.start.toDate(getLocalTimeZone()).getTime();
				const endDate = dateRangeValue.end.toDate(getLocalTimeZone()).getTime();
				if (eventDate < startDate || eventDate > endDate) return false;
			}

			// Type filter
			if (hasTypeFilter && !selectedTypes.includes(capitalizeType(event.event_type))) return false;

			return true;
		})
	);

	const groupedEvents = $derived(
		filteredEvents.reduce((groups, event) => {
			const dateKey = new Date(event.timestamp).toLocaleDateString();
			(groups[dateKey] ||= []).push(event);
			return groups;
		}, {})
	);
</script>

<div class="flex h-svh w-full flex-col divide-y overflow-hidden">
	<div class="flex text-xl">
		<Button class="h-20! border-t-0 border-b-0 border-l-0 p-6!" variant="outline" href="/connect">
			<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
		</Button>
	</div>
	<div class="relative aspect-video max-h-[45svh] w-full bg-black" class:border-0!={isFullscreen}>
		{#if streamLoading}
			<div class="flex h-full w-full items-center justify-center text-background">
				<Spinner class="size-8" />
			</div>
		{/if}
		<video bind:this={videoElement} class="h-full w-full" playsinline muted></video>
		<div class="absolute right-4 bottom-4 flex gap-2">
			{#if micEnabled}
				<Button onclick={() => (audioMuted = !audioMuted)} class="px-3 opacity-50 hover:opacity-100">
					{#if audioMuted}
						<RiVolumeMuteLine class="size-4" />
					{:else}
						<RiVolumeUpLine class="size-4" />
					{/if}
				</Button>
			{/if}
			<Button onclick={toggleFullscreen} class="px-3 opacity-50 hover:opacity-100">
				{#if isFullscreen}
					<RiFullscreenExitLine class="size-4" />
				{:else}
					<RiFullscreenLine class="size-4" />
				{/if}
			</Button>
		</div>
	</div>
	<div class="w-full basis-full overflow-hidden">
		<Tabs.Root value="events" onValueChange={(v) => (activeTab = v)} class="relative max-h-full">
			<div class="w-full">
				<Tabs.List class="w-full">
					<Tabs.Trigger value="events">Events</Tabs.Trigger>
					<Tabs.Trigger value="controls">Controls</Tabs.Trigger>
					<Tabs.Trigger value="health">Health</Tabs.Trigger>
				</Tabs.List>
			</div>
			<Tabs.Content
				value="events"
				class="of-bottom overflow-y-auto p-6"
				onscroll={() => {
					dateRangeOpen = false;
					typeFilterOpen = false;
				}}
			>
				<div class="flex flex-wrap items-center justify-end gap-2">
					<!-- Date range filter -->
					<Popover.Root bind:open={dateRangeOpen}>
						<Popover.Trigger
							class="{buttonVariants({ variant: hasDateFilter ? 'default' : 'outline', size: 'sm' })} gap-2"
						>
							<RiCalendarLine class="size-4" />
							Date
						</Popover.Trigger>
						<Popover.Content class="w-auto p-4" align="start">
							<div class="space-y-4">
								<RangeCalendar.RangeCalendar bind:value={dateRangeValue} class="rounded-md border" />
								<Button
									size="sm"
									variant="outline"
									disabled={!hasDateFilter}
									class="w-full"
									onclick={() => (dateRangeValue = undefined)}
								>
									Clear
								</Button>
							</div>
						</Popover.Content>
					</Popover.Root>

					<!-- Type filter -->
					<Popover.Root bind:open={typeFilterOpen}>
						<Popover.Trigger
							class="{buttonVariants({ variant: hasTypeFilter ? 'default' : 'outline', size: 'sm' })} gap-2"
						>
							<RiFilter3Line class="size-4" />
							Type
						</Popover.Trigger>
						<Popover.Content class="w-56 p-4" align="start">
							<div class="space-y-3">
								{#each availableTypes as type}
									<Label class="text-nowrap">
										<Checkbox
											checked={selectedTypes.includes(type)}
											onCheckedChange={() => {
												if (selectedTypes.includes(type)) selectedTypes = selectedTypes.filter((t) => t !== type);
												else selectedTypes = [...selectedTypes, type];
											}}
										/>
										<p class="truncate">{type}</p>
									</Label>
								{/each}
								{#if availableTypes.length === 0}
									<p class="text-sm text-muted-foreground">No types available.</p>
								{/if}
							</div>
						</Popover.Content>
					</Popover.Root>

					<Button onclick={loadEvents} variant="outline" size="sm" disabled={eventsLoading}>
						Refresh
						{#if !eventsLoading}
							<RiRefreshLine class="size-4" />
						{:else}
							<Spinner class="size-4" />
						{/if}
					</Button>
				</div>

				{#if events.length === 0}
					<div class="mt-6 rounded-lg border p-8 text-center text-muted-foreground">No events recorded yet.</div>
				{:else if Object.keys(groupedEvents).length === 0}
					<div class="mt-6 rounded-lg border p-8 text-center text-muted-foreground">
						No events match the selected filters.
					</div>
				{:else}
					{#each Object.entries(groupedEvents) as [dateKey, dateEvents]}
						<div class="sticky -top-6 z-10 flex items-center gap-4 bg-background mask-b-from-70% mask-b-to-100% py-4">
							<span class="shrink-0 text-sm font-medium text-muted-foreground">{dateKey}</span>
							<Separator class="flex-1" />
						</div>
						<div class="divide-y overflow-y-auto rounded-lg border">
							{#each dateEvents as event}
								<div class="flex flex-wrap items-center gap-4 p-4 hover:bg-muted/50">
									<div class="aspect-video h-20 shrink-0 overflow-hidden border bg-muted">
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
									<div class="flex-1 gap-4">
										<p class="mb-2 w-full font-medium">{new Date(event.timestamp).toLocaleTimeString()}</p>
										<p class="inline-flex items-center gap-1 text-sm text-muted-foreground">
											<RiSearchAi2Line class="size-4" />
											{capitalizeType(event.event_type) || "N/A"}
										</p>
										<p class="inline-flex items-center gap-1 text-sm text-muted-foreground">
											<RiTimeLine class="size-4" />
											{event.duration || "N/A"}s
										</p>
									</div>
									<Button onclick={() => viewRecording(event)} variant="outline" size="sm" class="gap-2 max-sm:grow">
										<RiEyeLine class="size-4" />
										View
									</Button>
								</div>
							{/each}
						</div>
					{/each}
				{/if}
			</Tabs.Content>
			<Tabs.Content value="controls" class="of-top of-bottom space-y-6 overflow-y-auto p-6">
				<div class="space-y-6">
					<div class="flex items-center justify-between gap-4 rounded-lg border p-4">
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
					<div class="flex items-center justify-between gap-4 rounded-lg border p-4">
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

					<div class="border p-4">
						<div class="mb-4 flex items-center justify-between gap-4">
							<Label class="text-base">Paired devices</Label>
							<Button onclick={loadDevices} variant="outline" size="sm" disabled={devicesLoading}>
								Refresh
								{#if devicesLoading}
									<Spinner class="size-4" />
								{:else}
									<RiRefreshLine class="size-4" />
								{/if}
							</Button>
						</div>
						{#if devices.length === 0}
							<p class="text-sm text-muted-foreground">No devices paired.</p>
						{:else}
							<div class="space-y-4">
								{#each devices as device}
									<div
										class="flex items-center justify-between gap-4 border p-4 {device.id ===
										localStorage.getItem('deviceId')
											? 'bg-foreground text-background'
											: ''}"
									>
										<div class="flex-1 truncate">
											<p class="text-sm font-medium">{device.name || "Unknown device"}</p>
											<p class="truncate text-xs text-muted-foreground">ID: {device.id}</p>
										</div>
										<!-- Removing the user's currently used device is done via the /connect page -->
										{#if device.id !== localStorage.getItem("deviceId")}
											<AlertDialog.Root
												open={removeDeviceDialogOpen[device.id]}
												onOpenChange={(open) => {
													removeDeviceDialogOpen[device.id] = open;
												}}
											>
												<AlertDialog.Trigger
													class={buttonVariants({ variant: "outline", size: "sm" })}
													disabled={controlsLoading[`remove-${device.id}`]}
												>
													{#if controlsLoading[`remove-${device.id}`]}
														<Spinner class="size-4" />
													{:else}
														<RiCloseLine class="size-4" />
													{/if}
												</AlertDialog.Trigger>
												<AlertDialog.Content>
													<AlertDialog.Header>
														<AlertDialog.Title>Remove device?</AlertDialog.Title>
														<AlertDialog.Description>
															This will unpair "{device.name || "Unknown device"}" from this product. The device will no
															longer be able to access this product.
														</AlertDialog.Description>
													</AlertDialog.Header>
													<AlertDialog.Footer>
														<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
														<AlertDialog.Action onclick={() => removeDevice(device.id)}>Remove</AlertDialog.Action>
													</AlertDialog.Footer>
												</AlertDialog.Content>
											</AlertDialog.Root>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<AlertDialog.Root bind:open={restartDialogOpen}>
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

					<AlertDialog.Root bind:open={resetDialogOpen}>
						<AlertDialog.Trigger
							class="{buttonVariants({ variant: 'outline' })} w-full gap-2"
							disabled={controlsLoading.reset}
						>
							{#if controlsLoading.reset}
								<Spinner class="size-4" />
							{:else}
								<RiFileShredLine class="size-4" />
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
			<Tabs.Content value="health" class="of-top of-bottom space-y-6 overflow-y-auto p-6">
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
						<div class="space-y-4 rounded-lg border p-4">
							<Label class="text-base">Performance</Label>
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

						<div class="space-y-4 rounded-lg border p-4">
							<Label class="text-base">Network</Label>
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

						<div class="space-y-4 rounded-lg border p-4">
							<Label class="text-base">Firmware</Label>
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
							<div class="space-y-4 rounded-lg border p-4">
								<Label class="text-base">Logs</Label>
								<div class="relative h-60 overflow-hidden border bg-muted text-xs">
									<div
										bind:this={logsContainer}
										class="of-top of-bottom of-length-2 h-full w-full overflow-x-hidden overflow-y-auto p-4 break-all"
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

<!-- Recording Viewer Dialog -->
<Dialog.Root bind:open={viewRecordingDialog} onOpenChange={(open) => !open && onRecordingDialogClose()}>
	<Dialog.Content class="max-w-4xl">
		<Dialog.Header>
			<Dialog.Title>{selectedEvent ? new Date(selectedEvent.timestamp).toLocaleString() : ""}</Dialog.Title>
		</Dialog.Header>
		<div class="relative flex aspect-video w-full items-center justify-center border bg-foreground">
			{#if recordingVideoLoading}
				<Spinner class="size-8 text-background" />
			{:else if recordingVideoUrl}
				<video
					src={recordingVideoUrl}
					controls
					autoplay
					class="w-full"
					onloadedmetadata={(e) => {
						// Sync audio with video if both exist
						if (recordingAudioUrl && recordingAudioElement) {
							e.target.addEventListener("play", () => recordingAudioElement?.play());
							e.target.addEventListener("pause", () => recordingAudioElement?.pause());
							e.target.addEventListener("seeked", () => {
								recordingAudioElement.currentTime = e.target.currentTime;
							});
						}
					}}
				>
					<track kind="captions" />
				</video>
				{#if recordingAudioUrl}
					<audio src={recordingAudioUrl} class="hidden" bind:this={recordingAudioElement}>
						<track kind="captions" />
					</audio>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
