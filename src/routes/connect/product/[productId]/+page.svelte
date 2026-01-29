<script>
	import { page } from "$app/state";
	import { onMount, onDestroy } from "svelte";
	import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import Separator from "$lib/components/ui/separator/separator.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import { getProduct, removeProduct } from "$lib/utils/pairedProductsStorage";
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
	import { SvelteSet } from "svelte/reactivity";

	const productId = page.params.productId;

	let product = $state(null);
	let relayCommInstance;
	let streamLoading = $state(true);
	let streamEnded = $state(false);
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

	// Universal button / controls loading state
	let buttonsLoading = $state({});

	// Devices
	let devices = $state([]);

	// Health
	let health = $state(null);
	let healthLoading = $state(false);

	// Update status
	let updateStatus = $state(null);
	let updateStatusLoading = $state(false);

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
	let audioGainNode;
	let audioMuted = $state(false);
	let nextAudioTime = 0;
	let audioStarted = $state(false);

	// Mute/unmute via gain node
	$effect(() => {
		const muted = audioMuted; // Make reactive
		if (audioGainNode) audioGainNode.gain.value = muted ? 0 : 1;
	});

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
			relayCommInstance.on("getUpdateStatusResult", handleUpdateStatusResult);
			relayCommInstance.on("startUpdateResult", handleStartUpdateResult);
			relayCommInstance.on("setVersionDevResult", handleSetVersionDevResult);
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
		endStream();
		if (typeof window !== "undefined") document.removeEventListener("visibilitychange", handleVisibilityChange);
		if (relayCommInstance) relayCommInstance.disconnect();
	});

	// Events handlers
	function loadEvents() {
		eventsLoading = true;
		relayCommInstance.send(productId, "getEvents").catch((error) => {
			toast.error("Failed to load events: " + error.message);
			console.error("Failed to load events:", error);
			eventsLoading = false;
		});
	}

	function handleEventsResult(msg) {
		eventsLoading = false;
		if (!msg.payload.success) {
			toast.error("Failed to load events: " + msg.payload.error || "Unknown error");
			return;
		}
		events = msg.payload.events || [];
	}

	// Thumbnail loading with rate limiting (5/s)
	let thumbnailQueue = $state([]);
	let loadingThumbnails = new SvelteSet();
	let thumbnailsThisSecond = 0;

	function queueThumbnail(eventId) {
		if (eventThumbnails[eventId] || loadingThumbnails.has(eventId) || thumbnailQueue.includes(eventId)) return;
		thumbnailQueue.push(eventId);
		drainThumbnailQueue();
	}

	function drainThumbnailQueue() {
		while (thumbnailQueue.length > 0 && thumbnailsThisSecond < 5) {
			if (thumbnailsThisSecond === 0) setTimeout(() => { thumbnailsThisSecond = 0; drainThumbnailQueue(); }, 1000);
			const id = thumbnailQueue.shift();
			thumbnailsThisSecond++;
			loadingThumbnails.add(id);
			relayCommInstance.send(productId, "getThumbnail", { id }).catch(() => loadingThumbnails.delete(id));
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
			const receivedChunks = recordingChunks[fileType].filter(Boolean);
			if (receivedChunks.length !== totalChunks) {
				recordingLoading = false;
				return toast.error(`Recording incomplete: received ${receivedChunks.length}/${totalChunks} chunks`);
			}
			const totalLength = receivedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
			const combined = new Uint8Array(totalLength);
			let offset = 0;

			for (const chunk of receivedChunks) {
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
			// Ignore empty src errors (code 4)
			if (videoElement?.error && videoElement.error.code !== 4) {
				console.error("Video playback error:", videoElement.error);
			}
		});
	}

	function startStream() {
		streamLoading = true;
		streamEnded = false;
		relayCommInstance.send(productId, "startStream").catch((error) => {
			onStreamEnded(error);
		});
	}

	function endStream() {
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
		streamEnded = true;
		streamLoading = false;
	}

	function onStreamEnded(reason) {
		toast.error("Stream ended: " + reason);
		console.error("Stream ended: ", reason);
		endStream();
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
			onStreamEnded(msg.payload.error);
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
		if (document.hidden) endStream();
		else startStream();
	}

	// Audio streaming functions
	function setupAudioContext() {
		audioContext = new AudioContext();
		audioGainNode = audioContext.createGain();
		audioGainNode.gain.value = audioMuted ? 0 : 1;
		audioGainNode.connect(audioContext.destination);
		nextAudioTime = 0;
		audioStarted = false;
	}

	let bufferedChunks = [];

	function handleStreamAudioChunk(msg) {
		if (!msg.payload.success) return console.error("Audio stream error:", msg.payload.error);
		if (!audioContext) return;

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
			source.connect(audioGainNode);
			source.start(nextAudioTime);
			nextAudioTime += chunk.duration;
		}
	}

	// Controls handlers
	function loadMicrophone() {
		buttonsLoading.mic = true;
		relayCommInstance.send(productId, "getMicrophone").catch((error) => {
			toast.error("Failed to load microphone setting: " + error.message);
			console.error("Failed to load microphone setting:", error);
			buttonsLoading.mic = false;
		});
	}

	function handleGetMicrophoneResult(msg) {
		buttonsLoading.mic = false;
		if (!msg.payload.success) {
			toast.error("Failed to load microphone setting: " + msg.payload.error || "Unknown error");
			return;
		}
		micEnabled = msg.payload.enabled;
	}

	function toggleMicrophone() {
		buttonsLoading.mic = true;
		const newValue = !micEnabled;
		relayCommInstance.send(productId, "setMicrophone", { enabled: newValue }).catch((error) => {
			toast.error("Failed to set microphone: " + error.message);
			console.error("Failed to set microphone:", error);
			buttonsLoading.mic = false;
		});
	}

	function handleSetMicrophoneResult(msg) {
		buttonsLoading.mic = false;
		if (!msg.payload.success) {
			toast.error("Failed to set microphone: " + msg.payload.error || "Unknown error");
			return;
		}
		micEnabled = msg.payload.enabled;
		startStream(); // Restart stream to apply microphone changes
	}

	function loadRecordingSound() {
		buttonsLoading.sound = true;
		relayCommInstance.send(productId, "getRecordingSound").catch((error) => {
			toast.error("Failed to load recording sound setting: " + error.message);
			console.error("Failed to load recording sound setting:", error);
			buttonsLoading.sound = false;
		});
	}

	function handleGetRecordingSoundResult(msg) {
		buttonsLoading.sound = false;
		if (!msg.payload.success) {
			toast.error("Failed to load recording sound setting: " + msg.payload.error || "Unknown error");
			return;
		}
		recordingSoundEnabled = msg.payload.enabled;
	}

	function toggleRecordingSound() {
		buttonsLoading.sound = true;
		const newValue = !recordingSoundEnabled;
		relayCommInstance.send(productId, "setRecordingSound", { enabled: newValue }).catch((error) => {
			toast.error("Failed to toggle recording sound: " + error.message);
			console.error("Failed to toggle recording sound:", error);
			buttonsLoading.sound = false;
		});
	}

	function handleSetRecordingSoundResult(msg) {
		buttonsLoading.sound = false;
		if (!msg.payload.success) {
			toast.error("Failed to set recording sound: " + msg.payload.error || "Unknown error");
			return;
		}
		recordingSoundEnabled = msg.payload.enabled;
	}

	function loadEventDetectionConfig() {
		buttonsLoading.eventDetection = true;
		relayCommInstance.send(productId, "getEventDetectionConfig").catch((error) => {
			toast.error("Failed to load event detection config: " + error.message);
			console.error("Failed to load event detection config:", error);
			buttonsLoading.eventDetection = false;
		});
	}

	function handleGetEventDetectionConfigResult(msg) {
		buttonsLoading.eventDetection = false;
		if (!msg.payload.success) {
			toast.error("Failed to load event detection config: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionEnabled = msg.payload.enabled;
		const types = msg.payload.enabledTypes || [];
		eventDetectionTypes = types.length > 0 ? types : ["person", "pet", "car"];
	}

	function toggleEventDetection() {
		buttonsLoading.eventDetection = true;
		const newValue = !eventDetectionEnabled;
		relayCommInstance.send(productId, "setEventDetectionEnabled", { enabled: newValue }).catch((error) => {
			toast.error("Failed to toggle event detection: " + error.message);
			console.error("Failed to toggle event detection:", error);
			buttonsLoading.eventDetection = false;
		});
	}

	function handleSetEventDetectionEnabledResult(msg) {
		buttonsLoading.eventDetection = false;
		if (!msg.payload.success) {
			toast.error("Failed to set event detection: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionEnabled = msg.payload.enabled;
	}

	function updateEventDetectionTypes() {
		buttonsLoading.eventDetectionTypes = true;
		relayCommInstance
			.send(productId, "setEventDetectionTypes", { enabledTypes: eventDetectionTypes })
			.catch((error) => {
				toast.error("Failed to update event detection types: " + error.message || "Unknown error");
				console.error("Failed to update event detection types:", error);
				buttonsLoading.eventDetectionTypes = false;
			});
	}

	function handleSetEventDetectionTypesResult(msg) {
		buttonsLoading.eventDetectionTypes = false;
		if (!msg.payload.success) {
			toast.error("Failed to set event detection types: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionTypes = msg.payload.enabledTypes || [];
	}

	function loadDevices() {
		buttonsLoading.devices = true;
		relayCommInstance.send(productId, "getDevices").catch((error) => {
			toast.error("Failed to load devices: " + error.message);
			console.error("Failed to load devices:", error);
			buttonsLoading.devices = false;
		});
	}

	function handleGetDevicesResult(msg) {
		buttonsLoading.devices = false;
		if (!msg.payload.success) {
			toast.error("Failed to load devices: " + msg.payload.error || "Unknown error");
			return;
		}
		devices = msg.payload.devices || [];
	}

	function removeDevice(deviceId) {
		buttonsLoading[`remove-${deviceId}`] = true;
		relayCommInstance.send(productId, "removeDevice", { targetDeviceId: deviceId }).catch((error) => {
			toast.error("Failed to remove device: " + error.message);
			console.error("Failed to remove device:", error);
			buttonsLoading[`remove-${deviceId}`] = false;
		});
	}

	function handleRemoveDeviceResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to remove device: " + msg.payload.error || "Unknown error");
			Object.keys(buttonsLoading).forEach((key) => {
				if (key.startsWith("remove-")) buttonsLoading[key] = false;
			});
			return;
		}
		const removedId = msg.payload.removedDeviceId;
		devices = devices.filter((d) => d.id !== removedId);
		buttonsLoading[`remove-${removedId}`] = false;
	}

	function restartProduct() {
		buttonsLoading.restart = true;
		relayCommInstance.send(productId, "restart").catch((error) => {
			toast.error("Failed to restart device: " + error.message);
			console.error("Failed to restart device:", error);
			buttonsLoading.restart = false;
		});
	}

	function handleRestartResult(msg) {
		buttonsLoading.restart = false;
		if (!msg.payload.success) {
			toast.error("Failed to restart product: " + msg.payload.error || "Unknown error");
			return;
		}
		toast.success("Restarting!");
		setTimeout(() => {
			if (page.url.pathname.endsWith("/product/" + productId)) goto("/connect");
		}, 1000);
	}

	function resetProduct() {
		buttonsLoading.reset = true;
		relayCommInstance.send(productId, "reset").catch((error) => {
			toast.error("Failed to reset device: " + error.message);
			console.error("Failed to reset device:", error);
			buttonsLoading.reset = false;
		});
	}

	function handleResetResult(msg) {
		buttonsLoading.reset = false;
		if (!msg.payload.success) {
			toast.error("Failed to reset device: " + msg.payload.error || "Unknown error");
			return;
		}
		toast.success("Reset initiated!");
		removeProduct(msg.productId); // Remove product, since factory resetting will remove all paired devices
		setTimeout(() => {
			if (page.url.pathname.endsWith("/product/" + productId)) goto("/connect");
		}, 1000);
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
			relayDomain: msg.payload.relayDomain,
			logs: msg.payload.logs,
			performance: msg.payload.performance
		};
	}

	// Update status handlers
	function loadUpdateStatus() {
		updateStatusLoading = true;
		relayCommInstance.send(productId, "getUpdateStatus").catch((error) => {
			toast.error("Failed to load update status: " + error.message);
			console.error("Failed to load update status:", error);
			updateStatusLoading = false;
		});
	}

	function handleUpdateStatusResult(msg) {
		updateStatusLoading = false;
		if (!msg.payload.success) {
			toast.error("Failed to load update status: " + msg.payload.error || "Unknown error");
			return;
		}
		updateStatus = {
			status: msg.payload.status,
			currentVersion: msg.payload.currentVersion,
			availableVersion: msg.payload.availableVersion,
			error: msg.payload.error
		};
	}

	function startUpdate() {
		buttonsLoading.update = true;
		relayCommInstance.send(productId, "startUpdate").catch((error) => {
			toast.error("Failed to start update: " + error.message);
			console.error("Failed to start update:", error);
			buttonsLoading.update = false;
		});
	}

	function handleStartUpdateResult(msg) {
		buttonsLoading.update = false;
		if (!msg.payload.success) {
			toast.error("Failed to start update: " + msg.payload.error || "Unknown error");
			return;
		}
		toast.success("Update started!");
		loadHealth();
	}

	function setVersionDev() {
		relayCommInstance.send(productId, "setVersionDev").catch((error) => {
			toast.error("Failed to set version to dev: " + error.message);
			console.error("Failed to set version to dev:", error);
		});
	}

	function handleSetVersionDevResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to set version to dev: " + msg.payload.error || "Unknown error");
			return;
		}
		toast.success("Version set to dev!");
		loadUpdateStatus();
	}
</script>

<div class="flex h-svh w-full flex-col divide-y overflow-hidden">
	<div class="flex text-xl">
		<Button class="h-20! border-t-0 border-b-0 border-l-0 p-6!" variant="outline" href="/connect">
			<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
		</Button>
	</div>
	<StreamPlayer bind:audioMuted bind:videoElement {streamLoading} {streamEnded} showMuteButton={audioStarted} />
	<div class="w-full basis-full overflow-hidden">
		<Tabs.Root
			bind:value={activeTab}
			onValueChange={(v) => {
				if (!relayCommInstance) return;
				if (v === TABS.CONTROLS && !tabsLoaded[TABS.CONTROLS]) {
					tabsLoaded[TABS.CONTROLS] = true;
					loadMicrophone();
					loadRecordingSound();
					loadEventDetectionConfig();
					loadDevices();
				} else if (v === TABS.HEALTH && !tabsLoaded[TABS.HEALTH]) {
					tabsLoaded[TABS.HEALTH] = true;
					loadHealth();
					loadUpdateStatus();
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
					{loadingThumbnails}
					{thumbnailQueue}
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
					bind:buttonsLoading
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
					bind:eventDetectionTypes
					{devices}
				/>
			</Tabs.Content>
			<Tabs.Content value={TABS.HEALTH} class="of-top of-bottom space-y-6 overflow-y-auto p-6">
				<CameraHealth
					bind:buttonsLoading
					{loadHealth}
					{loadUpdateStatus}
					{health}
					{updateStatus}
					{activeTab}
					healthTab={TABS.HEALTH}
					{healthLoading}
					{updateStatusLoading}
					{startUpdate}
					{setVersionDev}
				/>
			</Tabs.Content>
		</Tabs.Root>
	</div>
</div>
