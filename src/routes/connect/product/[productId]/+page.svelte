<script>
	import { page } from "$app/state";
	import { onMount, onDestroy } from "svelte";
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import Separator from "$lib/components/ui/separator/separator.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import { getProduct } from "$lib/utils/pairedProductsStorage";
	import { RelayComm, RELAY_REQUEST_TIMEOUT } from "$lib/utils/relaycomm";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";
	import { base64ToBlob } from "$lib/utils/base64ToBlob";
	import StreamPlayer from "$lib/components/StreamPlayer.svelte";
	import CameraControls from "$lib/components/CameraControls.svelte";
	import CameraHealth from "$lib/components/CameraHealth.svelte";
	import CameraEvents from "$lib/components/CameraEvents.svelte";
	import { RiArrowLeftLine } from "svelte-remixicon";

	const productId = page.params.productId;

	let product = $state(null);
	let relayCommInstance;
	let streamLoading = $state(true);
	let streamHeartbeatInterval;

	// Events
	let events = $state([]);
	let eventsLoading = $state(false);
	let eventThumbnails = $state({});
	let viewRecordingDialog = $state(false);
	let recordingAudioElement = $state();
	let recordingVideoElement = $state();
	let recordingLoading = $state(false);
	let recordingLoadingPercent = $state(0);
	let recordingVideoUrl = $state(null);
	let recordingAudioUrl = $state(null);
	let recordingHasAudio = $state(false);
	let recordingChunks = $state({ video: [], audio: [] });
	let recordingTotalChunks = $state({ video: 0, audio: 0 });

	// Event filters
	let dateRangeOpen = $state(false);
	let typeFilterOpen = $state(false);

	// Controls
	let micEnabled = $state(false);
	let recordingSoundEnabled = $state(false);
	let eventDetectionEnabled = $state(false);
	let eventDetectionTypes = $state([]);
	let eventDetectionTypesInput = $state("");
	let controlsLoading = $state({});

	// Devices
	let devices = $state([]);

	// Health
	let health = $state(null);
	let healthLoading = $state(false);

	// Tab lazy loading
	const TABS = { EVENTS: "events", CONTROLS: "controls", HEALTH: "health" };
	let activeTab = $state(TABS.EVENTS);
	let tabsLoaded = $state({ [TABS.EVENTS]: false, [TABS.CONTROLS]: false, [TABS.HEALTH]: false });

	// Thumbnail IntersectionObserver
	function observeThumbnail(eventId) {
		return (element) => {
			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) queueThumbnail(eventId);
					else removeThumbnailFromQueue(eventId);
				},
				{ rootMargin: "100px" }
			);
			observer.observe(element);
			return () => observer.disconnect();
		};
	}

	// Video streaming
	let videoElement = $state();
	let mediaSource;
	let sourceBuffer;
	let videoStarted = false;

	// Audio streaming
	let audioContext;
	let audioMuted = $state(false);
	let nextAudioTime = 0;
	let audioStarted = $state(false);

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
			relayCommInstance.on("getEventDetectionConfigResult", handleGetEventDetectionConfigResult);
			relayCommInstance.on("setEventDetectionEnabledResult", handleSetEventDetectionEnabledResult);
			relayCommInstance.on("setEventDetectionTypesResult", handleSetEventDetectionTypesResult);
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

			// Load events tab immediately (default tab), start stream
			loadEvents();
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
			console.error("Failed to load events:", error);
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
	}

	// Thumbnail loading with rate limiting
	let thumbnailQueue = [];
	let loadingThumbnails = new Set();
	let thumbnailInterval;

	function queueThumbnail(eventId) {
		if (!eventThumbnails[eventId] && !loadingThumbnails.has(eventId) && !thumbnailQueue.includes(eventId)) {
			thumbnailQueue.push(eventId);
			if (!thumbnailInterval) {
				thumbnailInterval = setInterval(() => {
					const toLoad = thumbnailQueue.splice(0, 5);
					toLoad.forEach((id) => {
						loadingThumbnails.add(id);
						relayCommInstance.send(productId, "getThumbnail", { id }).catch(() => loadingThumbnails.delete(id));
					});
					if (thumbnailQueue.length === 0) {
						clearInterval(thumbnailInterval);
						thumbnailInterval = null;
					}
				}, 1000);
			}
		}
	}

	function removeThumbnailFromQueue(eventId) {
		const index = thumbnailQueue.indexOf(eventId);
		if (index > -1) thumbnailQueue.splice(index, 1);
	}

	function handleThumbnailResult(msg) {
		if (!msg.payload.success) return toast.error("Failed to get thumbnail: " + msg.payload.error || "Unknown error");
		eventThumbnails[msg.payload.eventId] = msg.payload.data;
		loadingThumbnails.delete(msg.payload.eventId);
	}

	function viewRecording(event) {
		viewRecordingDialog = true;
		recordingLoading = true;
		recordingLoadingPercent = 0;
		recordingVideoUrl = null;
		recordingAudioUrl = null;
		recordingHasAudio = false;
		recordingChunks = { video: [], audio: [] };
		recordingTotalChunks = { video: 0, audio: 0 };
		currentRecordingEventId = event.id;
		relayCommInstance.send(productId, "getRecording", { id: event.id }).catch((error) => {
			toast.error("Failed to load recording: " + error.message);
			console.error("Failed to load recording:", error);
			recordingLoading = false;
		});
	}

	let currentRecordingEventId = $state(null);

	function handleRecordingResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to load recording: " + msg.payload.error || "Unknown error");
			recordingLoading = false;
			return;
		}

		// Filter by current event ID
		const eventId = msg.payload.eventId || msg.payload.metadata?.eventId;
		if (eventId && eventId !== currentRecordingEventId) return;

		if (msg.payload.hasAudio !== undefined) recordingHasAudio = msg.payload.hasAudio;
		if (!msg.payload.chunk) return;

		const { fileType, chunkIndex, totalChunks, chunk } = msg.payload;
		const bytes = atob(chunk);
		const buffer = new Uint8Array(bytes.length);
		for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);

		recordingChunks[fileType][chunkIndex] = buffer;
		recordingTotalChunks[fileType] = totalChunks;

		// Update progress
		const total = recordingTotalChunks.video + (recordingHasAudio ? recordingTotalChunks.audio : 0);
		const received = recordingChunks.video.filter(Boolean).length + recordingChunks.audio.filter(Boolean).length;
		recordingLoadingPercent = total > 0 ? Math.round((received / total) * 100) : 0;

		if (chunkIndex === totalChunks - 1) {
			const totalLength = recordingChunks[fileType].reduce((sum, chunk) => sum + chunk.length, 0);
			const combined = new Uint8Array(totalLength);
			let offset = 0;

			for (const chunk of recordingChunks[fileType]) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			const mimeType = fileType === "video" ? "video/mp4" : "audio/mp4";
			const blobUrl = URL.createObjectURL(new Blob([combined], { type: mimeType }));

			if (fileType === "video") {
				recordingVideoUrl = blobUrl;
				if (!recordingHasAudio) recordingLoading = false;
			} else {
				recordingAudioUrl = blobUrl;
				recordingLoading = false;
			}
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
				if (!videoStarted && videoElement && videoElement.buffered.length > 0) {
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
		if (!audioContext) setupAudioContext();
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
		if (!mediaSource || mediaSource.readyState !== "open" || !sourceBuffer) {
			pendingChunks.push(buffer);
			return;
		}

		// Always queue chunks and let processPendingChunks handle them sequentially
		streamLoading = false; // Hide loading spinner, now that chunks are coming in and displaying
		pendingChunks.push(buffer);
		processPendingChunks();
		correctVideoDrift(); // Check for video drift and seek forward if too far behind
	}

	function correctVideoDrift() {
		if (!videoElement || !videoStarted || videoElement.buffered.length === 0) return;

		const bufferEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
		const currentTime = videoElement.currentTime;
		const drift = bufferEnd - currentTime;

		// If video is more than 500ms behind the buffer end, seek forward to catch up (100ms behind to avoid edge issues)
		if (drift > 0.5) videoElement.currentTime = bufferEnd - 0.1;
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
		if (bufferedChunks.length > 1) bufferedChunks = bufferedChunks.slice(-1); // Only keep newest chunk to prevent drift

		while (bufferedChunks.length > 0) {
			const currentTime = audioContext.currentTime;
			if (nextAudioTime < currentTime) nextAudioTime = currentTime; // Snap to now if fallen behind (e.g. not enough chunks for a while)
			if (nextAudioTime > currentTime + 0.3) break; // Keep 300ms buffer to absorb network jitter

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
		controlsLoading.mic = false;
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
			console.error("Failed to set microphone:", error);
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
		controlsLoading.sound = false;
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
			console.error("Failed to toggle recording sound:", error);
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

	function loadEventDetectionConfig() {
		relayCommInstance.send(productId, "getEventDetectionConfig").catch((error) => {
			console.error("Failed to load event detection config:", error);
		});
	}

	function handleGetEventDetectionConfigResult(msg) {
		controlsLoading.eventDetection = false;
		if (!msg.payload.success) {
			toast.error("Failed to load event detection config: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionEnabled = msg.payload.enabled;
		eventDetectionTypes = msg.payload.enabledTypes || [];
	}

	function toggleEventDetection() {
		controlsLoading.eventDetection = true;
		const newValue = !eventDetectionEnabled;
		relayCommInstance.send(productId, "setEventDetectionEnabled", { enabled: newValue }).catch((error) => {
			toast.error("Failed to toggle event detection: " + error.message);
			console.error("Failed to toggle event detection:", error);
			controlsLoading.eventDetection = false;
		});
	}

	function handleSetEventDetectionEnabledResult(msg) {
		controlsLoading.eventDetection = false;
		if (!msg.payload.success) {
			toast.error("Failed to set event detection: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionEnabled = msg.payload.enabled;
	}

	function updateEventDetectionTypes() {
		controlsLoading.eventDetectionTypes = true;
		relayCommInstance
			.send(productId, "setEventDetectionTypes", { enabledTypes: eventDetectionTypes })
			.catch((error) => {
				toast.error("Failed to update event detection types: " + error.message);
				console.error("Failed to update event detection types:", error);
				controlsLoading.eventDetectionTypes = false;
			});
	}

	function handleSetEventDetectionTypesResult(msg) {
		controlsLoading.eventDetectionTypes = false;
		if (!msg.payload.success) {
			toast.error("Failed to set event detection types: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionTypes = msg.payload.enabledTypes || [];
	}

	function loadDevices() {
		controlsLoading.devices = true;
		relayCommInstance.send(productId, "getDevices").catch((error) => {
			toast.error("Failed to load devices: " + error.message);
			console.error("Failed to load devices:", error);
			controlsLoading.devices = false;
		});
	}

	function handleGetDevicesResult(msg) {
		controlsLoading.devices = false;
		if (!msg.payload.success) {
			toast.error("Failed to load devices: " + msg.payload.error || "Unknown error");
			return;
		}
		devices = msg.payload.devices || [];
	}

	function removeDevice(deviceId) {
		controlsLoading[`remove-${deviceId}`] = true;
		relayCommInstance.send(productId, "removeDevice", { targetDeviceId: deviceId }).catch((error) => {
			toast.error("Failed to remove device: " + error.message);
			console.error("Failed to remove device:", error);
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

	function restartProduct() {
		controlsLoading.restart = true;
		relayCommInstance.send(productId, "restart").catch((error) => {
			toast.error("Failed to restart device: " + error.message);
			console.error("Failed to restart device:", error);
			controlsLoading.restart = false;
		});
	}

	function handleRestartResult(msg) {
		controlsLoading.restart = false;
		if (!msg.payload.success) {
			toast.error("Failed to restart product: " + msg.payload.error || "Unknown error");
			return;
		}
		toast.success("Restarting.");
		goto("/connect");
	}

	function resetProduct() {
		controlsLoading.reset = true;
		relayCommInstance.send(productId, "reset").catch((error) => {
			toast.error("Failed to reset device: " + error.message);
			console.error("Failed to reset device:", error);
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
		goto("/connect");
	}

	// Health handlers
	function loadHealth() {
		healthLoading = true;
		relayCommInstance.send(productId, "getHealth").catch((error) => {
			toast.error("Failed to load health data: " + error.message);
			console.error("Failed to load health data:", error);
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

	function startUpdate() {
		controlsLoading.update = true;
		relayCommInstance.send(productId, "startUpdate").catch((error) => {
			toast.error("Failed to start update: " + error.message);
			console.error("Failed to start update:", error);
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
</script>

<div class="flex h-svh w-full flex-col divide-y overflow-hidden">
	<div class="flex text-xl">
		<Button class="h-20! border-t-0 border-b-0 border-l-0 p-6!" variant="outline" href="/connect">
			<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
		</Button>
	</div>
	<StreamPlayer bind:audioMuted bind:videoElement {streamLoading} showMuteButton={audioStarted} />
	<div class="w-full basis-full overflow-hidden">
		<Tabs.Root
			bind:value={activeTab}
			onValueChange={(v) => {
				if (!relayCommInstance) return;
				if (v === TABS.CONTROLS && !tabsLoaded[TABS.CONTROLS]) {
					tabsLoaded[TABS.CONTROLS] = true;
					controlsLoading.mic = true;
					controlsLoading.sound = true;
					controlsLoading.eventDetection = true;
					controlsLoading.devices = true;
					loadMicrophone();
					loadRecordingSound();
					loadEventDetectionConfig();
					loadDevices();
				} else if (v === TABS.HEALTH && !tabsLoaded[TABS.HEALTH]) {
					tabsLoaded[TABS.HEALTH] = true;
					loadHealth();
				}
			}}
			class="relative max-h-full"
		>
			<div class="w-full">
				<Tabs.List class="w-full">
					<Tabs.Trigger value={TABS.EVENTS}>Events</Tabs.Trigger>
					<Tabs.Trigger value={TABS.CONTROLS}>Controls</Tabs.Trigger>
					<Tabs.Trigger value={TABS.HEALTH}>Health</Tabs.Trigger>
				</Tabs.List>
			</div>
			<Tabs.Content
				value={TABS.EVENTS}
				class="of-bottom overflow-y-auto p-6"
				onscroll={() => {
					dateRangeOpen = false;
					typeFilterOpen = false;
				}}
			>
				<CameraEvents
					{events}
					{loadEvents}
					{observeThumbnail}
					{viewRecording}
					{eventsLoading}
					{eventThumbnails}
					{recordingHasAudio}
					bind:dateRangeOpen
					bind:typeFilterOpen
					bind:viewRecordingDialog
					bind:recordingAudioElement
					bind:recordingVideoElement
					{recordingLoading}
					{recordingLoadingPercent}
					{recordingVideoUrl}
					{recordingAudioUrl}
				/>
			</Tabs.Content>
			<Tabs.Content value={TABS.CONTROLS} class="of-top of-bottom space-y-6 overflow-y-auto p-6">
				<CameraControls
					bind:controlsLoading
					{toggleMicrophone}
					{toggleRecordingSound}
					{toggleEventDetection}
					{updateEventDetectionTypes}
					{loadDevices}
					{removeDevice}
					{restartProduct}
					{resetProduct}
					{micEnabled}
					{recordingSoundEnabled}
					{eventDetectionEnabled}
					{eventDetectionTypes}
					bind:eventDetectionTypesInput
					{devices}
				/>
			</Tabs.Content>
			<Tabs.Content value={TABS.HEALTH} class="of-top of-bottom space-y-6 overflow-y-auto p-6">
				<CameraHealth {loadHealth} {health} {activeTab} healthTab={TABS.HEALTH} {healthLoading} />
			</Tabs.Content>
		</Tabs.Root>
	</div>
</div>
