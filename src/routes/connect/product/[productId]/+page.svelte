<script>
	import { page } from "$app/state";
	import { onMount, onDestroy, tick } from "svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import { getProduct, removeProduct } from "$lib/utils/pairedProductsStorage";
	import { RelayComm } from "$lib/utils/relaycomm";
	import { DEFAULT_RELAY_DOMAIN } from "$lib/config";
	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";
	import StreamPlayer from "$lib/components/StreamPlayer.svelte";
	import CameraControls from "$lib/components/CameraControls.svelte";
	import CameraHealth from "$lib/components/CameraHealth.svelte";
	import CameraEvents from "$lib/components/CameraEvents.svelte";
	import { RiArrowLeftLine } from "svelte-remixicon";
	import { SvelteSet } from "svelte/reactivity";
	import { MediaSourceManager } from "$lib/utils/mediaSourceManager";

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
	let recordingVideoUrl = $state(null);
	let recordingAudioUrl = $state(null);
	let recordingHasAudio = $state(false);
	let recordingChunks = $state({ video: [], audio: [] });
	let recordingTotalChunks = $state({ video: 0, audio: 0 });
	let recordingManager = null;

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
			requestAnimationFrame(() => {
				// Immediate check since the observer misbehaves during svelte transitions (e.g. slide)
				if (element.getBoundingClientRect().top < window.innerHeight + 100) queueThumbnail(eventId);
			});
			return () => observer.disconnect();
		};
	}

	// Video streaming
	let videoElement = $state();
	let streamManager = null;
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
		cleanupRecording();
		if (typeof window !== "undefined") document.removeEventListener("visibilitychange", handleVisibilityChange);
		if (relayCommInstance) relayCommInstance.disconnect();
		for (const url of Object.values(eventThumbnails)) URL.revokeObjectURL(url);
	});

	// Cleanup recording when dialog closes - set eventId to null to ignore remaining chunks
	$effect(() => {
		if (!viewRecordingDialog && currentRecordingEventId) {
			currentRecordingEventId = null;
			cleanupRecording();
		}
	});

	function cleanupRecording() {
		recordingManager?.cleanup();
		recordingManager = null;
		if (recordingVideoUrl) URL.revokeObjectURL(recordingVideoUrl);
		if (recordingAudioUrl) URL.revokeObjectURL(recordingAudioUrl);
		recordingVideoUrl = null;
		recordingAudioUrl = null;
	}

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
			if (thumbnailsThisSecond === 0)
				setTimeout(() => {
					thumbnailsThisSecond = 0;
					drainThumbnailQueue();
				}, 1000);
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
		eventThumbnails[msg.payload.eventId] = URL.createObjectURL(new Blob([msg.payload.data], { type: "image/jpeg" }));
		loadingThumbnails.delete(msg.payload.eventId);
	}

	let recordingDuration = 0;

	function viewRecording(event) {
		viewRecordingDialog = true;
		recordingLoading = true;
		recordingDuration = event.duration || 0;
		cleanupRecording();
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

		// Set audio state from initial response (before any chunks arrive)
		if (msg.payload.hasAudio !== undefined) recordingHasAudio = msg.payload.hasAudio;
		if (!msg.payload.chunk) return; // Initial response lacks chunk, only contains metadata

		const { fileType, chunkIndex, totalChunks, chunk } = msg.payload;
		recordingChunks[fileType][chunkIndex] = chunk;
		recordingTotalChunks[fileType] = totalChunks;

		if (fileType === "audio") {
			// Audio: wait for all chunks, then create blob URL
			if (chunkIndex === totalChunks - 1) {
				const chunks = recordingChunks.audio.filter(Boolean);
				if (chunks.length === totalChunks) recordingAudioUrl = createBlobUrl(chunks, "audio/mp4");
			}
		} else {
			// Video: use MediaSource for progressive playback
			if (chunkIndex === 0) {
				recordingLoading = false;
				tick().then(() => {
					recordingManager = new MediaSourceManager({ isLive: false, duration: recordingDuration });
					recordingVideoUrl = recordingManager.setup();
					recordingManager.appendChunk(chunk);
				});
			} else recordingManager?.appendChunk(chunk);
			if (chunkIndex === totalChunks - 1) recordingManager?.finalize();
		}
	}

	function createBlobUrl(chunks, mimeType) {
		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}
		return URL.createObjectURL(new Blob([combined], { type: mimeType }));
	}

	function switchRecordingToBlobUrl() {
		if (!recordingManager || !recordingChunks.video.length) return;
		const savedTime = recordingVideoElement?.currentTime || 0;
		recordingManager.cleanup();
		recordingManager = null;
		const chunks = recordingChunks.video.filter(Boolean);
		recordingVideoUrl = createBlobUrl(chunks, "video/mp4");
		tick().then(() => {
			if (recordingVideoElement && savedTime > 0) recordingVideoElement.currentTime = savedTime;
		});
	}

	// Streaming handlers
	function setupMediaSource() {
		streamManager = new MediaSourceManager({
			isLive: true,
			onChunkAppended: () => {
				// Start playback once we have at least one chunk in the buffer
				if (!videoStarted && videoElement && videoElement.buffered.length > 0) {
					videoStarted = true;
					videoElement.play().catch(console.error);
				}
			}
		});
		videoElement.src = streamManager.setup();
	}

	function startStream() {
		streamLoading = true;
		streamEnded = false;
		relayCommInstance.send(productId, "startStream").catch((error) => {
			onStreamEnded(error);
		});
	}

	function endStream() {
		if (streamHeartbeatInterval) {
			clearInterval(streamHeartbeatInterval);
			streamHeartbeatInterval = null;
		}
		if (streamManager) {
			streamManager.cleanup();
			streamManager = null;
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

		if (!streamManager) setupMediaSource();
		if (!audioContext) setupAudioContext();
		if (!streamHeartbeatInterval) startStreamHeartbeat();
	}

	function handleStreamVideoChunk(msg) {
		if (!msg.payload.success) {
			onStreamEnded(msg.payload.error);
			return;
		}

		if (streamLoading && msg.payload.chunkIndex !== 0)
			return console.warn("Received chunk with wrong index, waiting for index 0.");

		if (videoElement?.error) return;

		streamLoading = false; // Hide loading spinner
		streamManager?.appendChunk(msg.payload.chunk);
		correctVideoDrift();
	}

	function correctVideoDrift() {
		if (!videoElement || !videoStarted || videoElement.buffered.length === 0) return;

		const bufferEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
		const currentTime = videoElement.currentTime;
		const drift = bufferEnd - currentTime;

		// If video is more than 500ms behind the buffer end, seek forward to catch up (100ms behind to avoid edge issues)
		if (drift > 0.5) videoElement.currentTime = bufferEnd - 0.1;
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

		// Decode PCM data from chunk field (slice creates aligned copy for Int16Array)
		const pcmData = new Int16Array(msg.payload.chunk.slice().buffer);

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
		relayCommInstance.send(productId, "setMicrophone", { enabled: micEnabled }).catch((error) => {
			micEnabled = !micEnabled;
			toast.error("Failed to set microphone: " + error.message);
			console.error("Failed to set microphone:", error);
			buttonsLoading.mic = false;
		});
	}

	function handleSetMicrophoneResult(msg) {
		buttonsLoading.mic = false;
		if (!msg.payload.success) {
			micEnabled = !micEnabled;
			toast.error("Failed to set microphone: " + msg.payload.error || "Unknown error");
			return;
		}
		micEnabled = msg.payload.enabled;

		// Restart stream to apply microphone changes
		endStream();
		startStream();
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
		relayCommInstance.send(productId, "setRecordingSound", { enabled: recordingSoundEnabled }).catch((error) => {
			recordingSoundEnabled = !recordingSoundEnabled;
			toast.error("Failed to toggle recording sound: " + error.message);
			console.error("Failed to toggle recording sound:", error);
			buttonsLoading.sound = false;
		});
	}

	function handleSetRecordingSoundResult(msg) {
		buttonsLoading.sound = false;
		if (!msg.payload.success) {
			recordingSoundEnabled = !recordingSoundEnabled;
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
		relayCommInstance.send(productId, "setEventDetectionEnabled", { enabled: eventDetectionEnabled }).catch((error) => {
			eventDetectionEnabled = !eventDetectionEnabled;
			toast.error("Failed to toggle event detection: " + error.message);
			console.error("Failed to toggle event detection:", error);
			buttonsLoading.eventDetection = false;
		});
	}

	function handleSetEventDetectionEnabledResult(msg) {
		buttonsLoading.eventDetection = false;
		if (!msg.payload.success) {
			eventDetectionEnabled = !eventDetectionEnabled;
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
		removeProduct(msg.originId); // Remove product, since factory resetting will remove all paired devices
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
			uptimeSeconds: msg.payload.uptimeSeconds,
			metrics: msg.payload.metrics
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
		loadUpdateStatus();
	}

	function setVersionDev() {
		buttonsLoading.setVersionDev = true;
		relayCommInstance.send(productId, "setVersionDev").catch((error) => {
			toast.error("Failed to set version to dev: " + error.message);
			console.error("Failed to set version to dev:", error);
			buttonsLoading.setVersionDev = false;
		});
	}

	function handleSetVersionDevResult(msg) {
		buttonsLoading.setVersionDev = false;
		if (!msg.payload.success) {
			toast.error("Failed to set version to dev: " + msg.payload.error || "Unknown error");
			return;
		}
		toast.success("Version set to dev!");
		loadUpdateStatus();
	}
</script>

<div class="flex h-svh w-full flex-col overflow-hidden">
	<div class="flex border-b text-xl">
		<Button class="h-20! border-t-0 border-b-0 border-l-0 p-6!" variant="outline" href="/connect">
			<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
		</Button>
	</div>
	<StreamPlayer bind:audioMuted bind:videoElement {streamLoading} {streamEnded} showMuteButton={audioStarted} />
	<div class="w-full basis-full overflow-hidden border-t">
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
			<Tabs.Content value={TABS.EVENTS} class="of-bottom overflow-y-auto p-6">
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
					bind:viewRecordingDialog
					bind:recordingAudioElement
					bind:recordingVideoElement
					{recordingLoading}
					{recordingVideoUrl}
					{recordingAudioUrl}
					onVideoError={switchRecordingToBlobUrl}
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
					bind:micEnabled
					bind:recordingSoundEnabled
					bind:eventDetectionEnabled
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
					model={product?.model}
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
