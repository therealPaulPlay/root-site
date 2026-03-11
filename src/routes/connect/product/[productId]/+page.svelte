<script>
	import { page } from "$app/state";
	import { onMount, onDestroy } from "svelte";
	import { on } from "svelte/events";
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
	import PullToRefresh from "$lib/components/PullToRefresh.svelte";
	import { RiArrowLeftLine, RiDownload2Line, RiErrorWarningLine } from "svelte-remixicon";
	import { slide } from "svelte/transition";
	import { SvelteSet } from "svelte/reactivity";
	import { MediaSourceManager } from "$lib/utils/mediaSourceManager";
	import { LoadingState } from "$lib/utils/loadingState.svelte.js";
	import { getFCMToken } from "$lib/utils/pushNotifications.js";
	import { Capacitor } from "@capacitor/core";

	const productId = page.params.productId;

	const loading = new LoadingState();

	let product = $state(null);
	let relayCommInstance;
	let streamEnded = $state(false);
	let streamHeartbeatInterval;

	// Events
	let events = $state([]);
	let eventThumbnails = $state({});
	let viewRecordingDialog = $state(false);
	let recordingAudioElement = $state();
	let recordingVideoElement = $state();
	let recordingAudioUrl = $state(null);
	let recordingHasAudio = $state(false);
	let recordingChunks = $state({ video: [], audio: [] });
	let recordingTotalChunks = $state({ video: 0, audio: 0 });
	let recordingManager = null;
	let eventListScrollElement = $state(null);
	let eventListScrollTop = $state(0);

	// Controls
	let micEnabled = $state(false);
	let recordingSoundEnabled = $state(false);
	let eventDetectionEnabled = $state(false);
	let eventDetectionTypes = $state([]);
	let notificationsEnabled = $state(false);

	// Dialog open states (closed on success)
	let restartDialogOpen = $state(false);
	let resetDialogOpen = $state(false);
	let removeDeviceDialogOpen = $state({});
	let updateDialogOpen = $state(false);
	let devDialogOpen = $state(false);

	// Devices
	let devices = $state([]);

	// Health
	let health = $state(null);

	// Update status
	let updateStatus = $state(null);

	// Tab lazy loading
	const TABS = { EVENTS: "events", CONTROLS: "controls", HEALTH: "health" };
	let activeTab = $state(TABS.EVENTS);
	let tabsLoaded = $state({ [TABS.EVENTS]: false, [TABS.CONTROLS]: false, [TABS.HEALTH]: false });

	// Switch to events tab and reload when navigating from a notification tap
	$effect(() => {
		if (!page.url.searchParams.get("event-id")) return;
		activeTab = TABS.EVENTS;
		if (relayCommInstance) relayCommInstance.onConnected(() => loadEvents());
	});

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
	let streamVideoElement = $state();
	let streamManager = null;
	let streamVideoStarted = false;

	// Audio streaming
	let audioContext;
	let audioGainNode;
	let audioMuted = $state(true);
	let nextAudioTime = 0;
	let audioStarted = $state(false);
	let audioUnlockEl = $state(null);

	// Track event tab scroll position reactively
	$effect(() => {
		if (!eventListScrollElement) return;
		return on(eventListScrollElement, "scroll", () => (eventListScrollTop = eventListScrollElement.scrollTop), {
			passive: true
		});
	});

	// Mute/unmute via gain node
	$effect(() => {
		const muted = audioMuted;
		if (audioGainNode) audioGainNode.gain.value = muted ? 0 : 1;
	});

	onMount(async () => {
		product = getProduct(productId);
		if (!product) {
			toast.error("Product not found!");
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
			relayCommInstance.on("getNotificationsResult", handleGetNotificationsResult);
			relayCommInstance.on("setNotificationsResult", handleSetNotificationsResult);
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

			// Load events immediately (default tab), update status (shows tab bar), start stream
			loadEvents();
			loadUpdateStatus();
			startStream();
		} catch (error) {
			toast.error("Failed to connect to relay: " + error.message);
			console.error("Failed to connect to relay:", error);
		}
	});

	onDestroy(() => {
		endStream();
		cleanupRecording();
		clearTimeout(thumbnailDrainTimeout);
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
		if (recordingVideoElement?.src) {
			URL.revokeObjectURL(recordingVideoElement.src);
			recordingVideoElement.src = "";
		}
		if (recordingAudioUrl) URL.revokeObjectURL(recordingAudioUrl);
		recordingAudioUrl = null;
	}

	// Events handlers
	function loadEvents() {
		loading.set("events", true);
		relayCommInstance.send(productId, "getEvents").catch((error) => {
			toast.error("Failed to load events: " + error.message);
			console.error("Failed to load events:", error);
			loading.set("events", false);
		});
	}

	function handleEventsResult(msg) {
		loading.set("events", false);
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
	let thumbnailDrainTimeout;

	function queueThumbnail(eventId) {
		if (eventThumbnails[eventId] || loadingThumbnails.has(eventId) || thumbnailQueue.includes(eventId)) return;
		thumbnailQueue.push(eventId);
		drainThumbnailQueue();
	}

	function drainThumbnailQueue() {
		while (thumbnailQueue.length > 0 && thumbnailsThisSecond < 5) {
			if (thumbnailsThisSecond === 0)
				thumbnailDrainTimeout = setTimeout(() => {
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
		loading.set("recording", true);
		recordingDuration = event.duration || 0;
		cleanupRecording();
		recordingHasAudio = false;
		recordingChunks = { video: [], audio: [] };
		recordingTotalChunks = { video: 0, audio: 0 };
		currentRecordingEventId = event.id;
		relayCommInstance.send(productId, "getRecording", { id: event.id }).catch((error) => {
			toast.error("Failed to load recording: " + error.message);
			console.error("Failed to load recording:", error);
			loading.set("recording", false);
		});
	}

	let currentRecordingEventId = $state(null);

	function handleRecordingResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to load recording: " + msg.payload.error || "Unknown error");
			loading.set("recording", false);
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
				loading.set("recording", false);
				let recordingPlayStarted = false;
				recordingManager = new MediaSourceManager({
					isLive: false,
					duration: recordingDuration,
					onChunkAppended: () => {
						if (!recordingPlayStarted && recordingVideoElement?.buffered.length > 0) {
							recordingPlayStarted = true;
							recordingVideoElement.play().catch(console.error);
						}
					}
				});
				recordingVideoElement.src = recordingManager.setup();
				recordingManager.appendChunk(chunk);
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

	async function shareRecording() {
		if (!navigator.share) return toast.error("Sharing is not supported in this environment.");
		const chunks = recordingChunks?.video?.filter(Boolean);
		if (!chunks?.length) return;
		try {
			const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
			const combined = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}
			const eventTimestamp = events.find((e) => e.id === currentRecordingEventId)?.timestamp;
			const timestamp = eventTimestamp
				? new Date(eventTimestamp).toISOString().replace(/[:.]/g, "-")
				: "default-no-date";
			const file = new File([combined], `recording-${timestamp}.mp4`, { type: "video/mp4" });
			await navigator.share({ files: [file] });
		} catch (error) {
			if (error.name !== "AbortError") console.error("Share failed:", error);
		}
	}

	function switchRecordingToBlobUrl() {
		if (!recordingChunks.video.length || !recordingVideoElement) return;
		if (recordingManager) {
			recordingManager.cleanup();
			recordingManager = null;
		}
		// Revoke old blob URL if present
		if (recordingVideoElement.src?.startsWith("blob:")) URL.revokeObjectURL(recordingVideoElement.src);
		const chunks = recordingChunks.video.filter(Boolean);
		recordingVideoElement.src = createBlobUrl(chunks, "video/mp4");
	}

	// Streaming handlers
	function setupMediaSource() {
		streamManager = new MediaSourceManager({
			isLive: true,
			onChunkAppended: () => {
				// Start playback once we have at least one chunk in the buffer
				if (!streamVideoStarted && streamVideoElement?.buffered.length > 0) {
					streamVideoStarted = true;
					streamVideoElement.play().catch(console.error);
				}
			}
		});
		streamVideoElement.src = streamManager.setup();
	}

	function startStream() {
		loading.set("stream", true);
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
		}
		if (streamVideoElement) {
			streamVideoElement.src = "";
			streamVideoElement.load();
		}
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		bufferedChunks = [];
		nextAudioTime = 0;
		audioStarted = false;
		streamVideoStarted = false;
		streamEnded = true;
		loading.set("stream", false);
	}

	function onStreamEnded(error) {
		if (!loading.is("stream")) toast.error("Stream ended: " + error?.message); // Only toast if the stream was previously running, and not in the loading state
		console.error("Stream ended: ", error);
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
		if (!streamHeartbeatInterval) startStreamHeartbeat();
	}

	function handleStreamVideoChunk(msg) {
		if (!msg.payload.success) {
			onStreamEnded(new Error(msg.payload.error));
			return;
		}

		if (loading.is("stream") && msg.payload.chunkIndex !== 0)
			return console.warn("Received chunk with wrong index, waiting for index 0.");

		if (streamVideoElement?.error) return;

		loading.set("stream", false); // Hide loading spinner
		streamManager?.appendChunk(msg.payload.chunk);
		correctVideoDrift();
	}

	function correctVideoDrift() {
		if (!streamVideoElement || !streamVideoStarted || streamVideoElement.buffered.length === 0) return;

		const bufferEnd = streamVideoElement.buffered.end(streamVideoElement.buffered.length - 1);
		const currentTime = streamVideoElement.currentTime;
		const drift = bufferEnd - currentTime;

		// If video is more than 500ms behind the buffer end, seek forward to catch up (100ms behind to avoid edge issues)
		if (drift > 0.5) streamVideoElement.currentTime = bufferEnd - 0.1;
	}

	function handleVisibilityChange() {
		if (document.hidden) endStream();
		else relayCommInstance.onConnected(() => startStream());
	}

	// Audio streaming functions
	function setupAudioContext() {
		audioUnlockEl?.play()?.catch(() => {}); // Unlock iOS audio session
		audioContext = new AudioContext();
		audioGainNode = audioContext.createGain();
		audioGainNode.gain.value = audioMuted ? 0 : 1;
		audioGainNode.connect(audioContext.destination);
		nextAudioTime = audioContext.currentTime;
	}

	let bufferedChunks = [];

	function handleStreamAudioChunk(msg) {
		if (!msg.payload.success) return console.error("Audio stream error:", msg.payload.error);
		if (!audioStarted) audioStarted = true; // Set audio started when first chunk arrives
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
		scheduleAudio();
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
		loading.set("mic", true);
		relayCommInstance.send(productId, "getMicrophone").catch((error) => {
			toast.error("Failed to load microphone setting: " + error.message);
			console.error("Failed to load microphone setting:", error);
			loading.set("mic", false);
		});
	}

	function handleGetMicrophoneResult(msg) {
		loading.set("mic", false);
		if (!msg.payload.success) {
			toast.error("Failed to load microphone setting: " + msg.payload.error || "Unknown error");
			return;
		}
		micEnabled = msg.payload.enabled;
	}

	function toggleMicrophone() {
		loading.set("mic", true);
		relayCommInstance.send(productId, "setMicrophone", { enabled: micEnabled }).catch((error) => {
			micEnabled = !micEnabled;
			toast.error("Failed to set microphone: " + error.message);
			console.error("Failed to set microphone:", error);
			loading.set("mic", false);
		});
	}

	function handleSetMicrophoneResult(msg) {
		loading.set("mic", false);
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
		loading.set("sound", true);
		relayCommInstance.send(productId, "getRecordingSound").catch((error) => {
			toast.error("Failed to load recording sound setting: " + error.message);
			console.error("Failed to load recording sound setting:", error);
			loading.set("sound", false);
		});
	}

	function handleGetRecordingSoundResult(msg) {
		loading.set("sound", false);
		if (!msg.payload.success) {
			toast.error("Failed to load recording sound setting: " + msg.payload.error || "Unknown error");
			return;
		}
		recordingSoundEnabled = msg.payload.enabled;
	}

	function toggleRecordingSound() {
		loading.set("sound", true);
		relayCommInstance.send(productId, "setRecordingSound", { enabled: recordingSoundEnabled }).catch((error) => {
			recordingSoundEnabled = !recordingSoundEnabled;
			toast.error("Failed to toggle recording sound: " + error.message);
			console.error("Failed to toggle recording sound:", error);
			loading.set("sound", false);
		});
	}

	function handleSetRecordingSoundResult(msg) {
		loading.set("sound", false);
		if (!msg.payload.success) {
			recordingSoundEnabled = !recordingSoundEnabled;
			toast.error("Failed to set recording sound: " + msg.payload.error || "Unknown error");
			return;
		}
		recordingSoundEnabled = msg.payload.enabled;
	}

	function loadEventDetectionConfig() {
		loading.set("eventDetection", true);
		relayCommInstance.send(productId, "getEventDetectionConfig").catch((error) => {
			toast.error("Failed to load event detection config: " + error.message);
			console.error("Failed to load event detection config:", error);
			loading.set("eventDetection", false);
		});
	}

	function handleGetEventDetectionConfigResult(msg) {
		loading.set("eventDetection", false);
		if (!msg.payload.success) {
			toast.error("Failed to load event detection config: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionEnabled = msg.payload.enabled;
		const types = msg.payload.enabledTypes || [];
		eventDetectionTypes = types.length > 0 ? types : ["person", "pet", "vehicle"];
	}

	function toggleEventDetection() {
		loading.set("eventDetection", true);
		relayCommInstance.send(productId, "setEventDetectionEnabled", { enabled: eventDetectionEnabled }).catch((error) => {
			eventDetectionEnabled = !eventDetectionEnabled;
			toast.error("Failed to toggle event detection: " + error.message);
			console.error("Failed to toggle event detection:", error);
			loading.set("eventDetection", false);
		});
	}

	function handleSetEventDetectionEnabledResult(msg) {
		loading.set("eventDetection", false);
		if (!msg.payload.success) {
			eventDetectionEnabled = !eventDetectionEnabled;
			toast.error("Failed to set event detection: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionEnabled = msg.payload.enabled;
	}

	function updateEventDetectionTypes() {
		loading.set("eventDetectionTypes", true);
		relayCommInstance
			.send(productId, "setEventDetectionTypes", { enabledTypes: eventDetectionTypes })
			.catch((error) => {
				toast.error("Failed to update event detection types: " + error.message || "Unknown error");
				console.error("Failed to update event detection types:", error);
				loading.set("eventDetectionTypes", false);
			});
	}

	function handleSetEventDetectionTypesResult(msg) {
		loading.set("eventDetectionTypes", false);
		if (!msg.payload.success) {
			toast.error("Failed to set event detection types: " + msg.payload.error || "Unknown error");
			return;
		}
		eventDetectionTypes = msg.payload.enabledTypes || [];
	}

	function loadNotifications() {
		loading.set("notifications", true);
		relayCommInstance.send(productId, "getNotifications").catch((error) => {
			toast.error("Failed to load notification status: " + error.message);
			console.error("Failed to load notification status:", error);
			loading.set("notifications", false);
		});
	}

	function handleGetNotificationsResult(msg) {
		loading.set("notifications", false);
		if (!msg.payload.success) {
			toast.error("Failed to load notification status: " + msg.payload.error || "Unknown error");
			return;
		}
		notificationsEnabled = msg.payload.enabled;
	}

	async function toggleNotifications() {
		if (!Capacitor.isNativePlatform()) {
			setTimeout(() => (notificationsEnabled = false), 250);
			return toast.error("Push notifications are not available in this environment.");
		}
		loading.set("notifications", true);

		if (notificationsEnabled) {
			// Enabling: get FCM token first
			const fcmToken = await getFCMToken();
			if (!fcmToken) {
				notificationsEnabled = false;
				loading.set("notifications", false);
				return;
			}
			relayCommInstance.send(productId, "setNotifications", { enabled: true, fcmToken }).catch((error) => {
				notificationsEnabled = false;
				toast.error("Failed to enable notifications: " + error.message);
				console.error("Failed to enable notifications:", error);
				loading.set("notifications", false);
			});
		} else {
			relayCommInstance.send(productId, "setNotifications", { enabled: false }).catch((error) => {
				notificationsEnabled = true;
				toast.error("Failed to disable notifications: " + error.message);
				console.error("Failed to disable notifications:", error);
				loading.set("notifications", false);
			});
		}
	}

	function handleSetNotificationsResult(msg) {
		loading.set("notifications", false);
		if (!msg.payload.success) {
			notificationsEnabled = !notificationsEnabled;
			toast.error("Failed to update notifications: " + msg.payload.error || "Unknown error");
			return;
		}
		notificationsEnabled = msg.payload.enabled;
	}

	function loadDevices() {
		loading.set("devices", true);
		relayCommInstance.send(productId, "getDevices").catch((error) => {
			toast.error("Failed to load devices: " + error.message);
			console.error("Failed to load devices:", error);
			loading.set("devices", false);
		});
	}

	function handleGetDevicesResult(msg) {
		loading.set("devices", false);
		if (!msg.payload.success) {
			toast.error("Failed to load devices: " + msg.payload.error || "Unknown error");
			return;
		}
		devices = msg.payload.devices || [];
	}

	function removeDevice(deviceId) {
		loading.set(`remove-${deviceId}`, true);
		relayCommInstance.send(productId, "removeDevice", { targetDeviceId: deviceId }).catch((error) => {
			toast.error("Failed to remove device: " + error.message);
			console.error("Failed to remove device:", error);
			loading.set(`remove-${deviceId}`, false);
		});
	}

	function handleRemoveDeviceResult(msg) {
		if (!msg.payload.success) {
			toast.error("Failed to remove device: " + msg.payload.error || "Unknown error");
			for (const d of devices) loading.set(`remove-${d.id}`, false);
			return;
		}
		const removedId = msg.payload.removedDeviceId;
		devices = devices.filter((d) => d.id !== removedId);
		delete removeDeviceDialogOpen[removedId];
		loading.set(`remove-${removedId}`, false);
	}

	function restartProduct() {
		loading.set("restart", true);
		relayCommInstance.send(productId, "restart").catch((error) => {
			toast.error("Failed to restart device: " + error.message);
			console.error("Failed to restart device:", error);
			loading.set("restart", false);
		});
	}

	function handleRestartResult(msg) {
		loading.set("restart", false);
		if (!msg.payload.success) {
			toast.error("Failed to restart product: " + msg.payload.error || "Unknown error");
			return;
		}
		restartDialogOpen = false;
		toast.success("Restarting!");
		setTimeout(() => {
			if (page.url.pathname.endsWith("/product/" + productId)) goto("/connect");
		}, 1000);
	}

	function resetProduct() {
		loading.set("reset", true);
		relayCommInstance.send(productId, "reset").catch((error) => {
			toast.error("Failed to reset device: " + error.message);
			console.error("Failed to reset device:", error);
			loading.set("reset", false);
		});
	}

	function handleResetResult(msg) {
		loading.set("reset", false);
		if (!msg.payload.success) {
			toast.error("Failed to reset device: " + msg.payload.error || "Unknown error");
			return;
		}
		resetDialogOpen = false;
		toast.success("Reset initiated!");
		removeProduct(msg.originId); // Remove product, since factory resetting will remove all paired devices
		setTimeout(() => {
			if (page.url.pathname.endsWith("/product/" + productId)) goto("/connect");
		}, 1000);
	}

	// Health handlers
	function loadHealth() {
		loading.set("health", true);
		relayCommInstance.send(productId, "getHealth").catch((error) => {
			toast.error("Failed to load health data: " + error.message);
			console.error("Failed to load health data:", error);
			loading.set("health", false);
		});
	}

	function handleHealthResult(msg) {
		loading.set("health", false);
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
		loading.set("updateStatus", true);
		relayCommInstance.send(productId, "getUpdateStatus").catch((error) => {
			toast.error("Failed to load update status: " + error.message);
			console.error("Failed to load update status:", error);
			loading.set("updateStatus", false);
		});
	}

	function handleUpdateStatusResult(msg) {
		loading.set("updateStatus", false);
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
		loading.set("update", true);
		relayCommInstance.send(productId, "startUpdate").catch((error) => {
			toast.error("Failed to start update: " + error.message);
			console.error("Failed to start update:", error);
			loading.set("update", false);
		});
	}

	function handleStartUpdateResult(msg) {
		loading.set("update", false);
		if (!msg.payload.success) {
			toast.error("Failed to start update: " + msg.payload.error || "Unknown error");
			return;
		}
		updateDialogOpen = false;
		toast.success("Update started!");
		loadUpdateStatus();
	}

	function setVersionDev() {
		loading.set("setVersionDev", true);
		relayCommInstance.send(productId, "setVersionDev").catch((error) => {
			toast.error("Failed to set version to dev: " + error.message);
			console.error("Failed to set version to dev:", error);
			loading.set("setVersionDev", false);
		});
	}

	function handleSetVersionDevResult(msg) {
		loading.set("setVersionDev", false);
		if (!msg.payload.success) {
			toast.error("Failed to set version to dev: " + msg.payload.error || "Unknown error");
			return;
		}
		devDialogOpen = false;
		toast.success("Version set to dev!");
		loadUpdateStatus();
	}
</script>

<audio
	bind:this={audioUnlockEl}
	src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
	class="hidden"
></audio>
<div class="safe-h-svh flex w-full flex-col overflow-hidden">
	<div class="flex border-b text-xl">
		<Button class="h-20! border-t-0 border-b-0 border-l-0 p-6!" variant="outline" href="/connect">
			<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
		</Button>
	</div>
	<StreamPlayer
		bind:audioMuted
		bind:videoElement={streamVideoElement}
		{loading}
		{streamEnded}
		showMuteButton={audioStarted}
		onAudioToggle={() => {
			if (!audioContext) setupAudioContext(); // Set up audio context on user input for working playback
		}}
	/>
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
					loadNotifications();
					loadDevices();
				} else if (v === TABS.HEALTH && !tabsLoaded[TABS.HEALTH]) {
					tabsLoaded[TABS.HEALTH] = true;
					loadHealth();
					// Update status is loaded in onMount() already
				}
			}}
			class="relative h-full"
		>
			<div class="w-full">
				<Tabs.List class="w-full">
					<Tabs.Trigger value={TABS.EVENTS}>Events</Tabs.Trigger>
					<Tabs.Trigger value={TABS.CONTROLS}>Controls</Tabs.Trigger>
					<Tabs.Trigger value={TABS.HEALTH}>
						Health
						{#if updateStatus?.status && updateStatus.status !== "up-to-date"}
							<span
								transition:slide={{ axis: "x" }}
								class="inline-flex bg-muted-foreground/10 p-1"
								class:animate-pulse={updateStatus.status === "downloading" || updateStatus.status === "installing"}
							>
								{#if updateStatus.status === "error"}
									<RiErrorWarningLine class="size-3" />
								{:else}
									<RiDownload2Line class="size-3" />
								{/if}
							</span>
						{/if}
					</Tabs.Trigger>
				</Tabs.List>
			</div>
			<Tabs.Content value={TABS.EVENTS} class="min-h-0">
				<PullToRefresh
					onRefresh={() => {
						loadEvents();
						return loading.promise("events");
					}}
					bind:scrollEl={eventListScrollElement}
					class="of-bottom relative mask-t-from-100% p-6 pb-12"
				>
					<div
						class="pointer-events-none absolute top-0 right-0 left-0 h-25 bg-linear-to-b from-background via-background to-background/50"
						style:opacity={Math.min(1, eventListScrollTop / 30) * 100 + "%"}
					></div>
					<CameraEvents
						{events}
						{observeThumbnail}
						{viewRecording}
						{loading}
						{eventThumbnails}
						{loadingThumbnails}
						{thumbnailQueue}
						{recordingHasAudio}
						bind:viewRecordingDialog
						bind:recordingAudioElement
						bind:recordingVideoElement
						{recordingAudioUrl}
						onVideoError={switchRecordingToBlobUrl}
						onShareRecording={shareRecording}
					/>
				</PullToRefresh>
			</Tabs.Content>
			<Tabs.Content value={TABS.CONTROLS} class="min-h-0">
				<PullToRefresh
					onRefresh={() => {
						loadMicrophone();
						loadRecordingSound();
						loadEventDetectionConfig();
						loadNotifications();
						loadDevices();
						return loading.promise("mic", "sound", "eventDetection", "notifications", "devices");
					}}
					class="of-top of-bottom space-y-6 p-6 pb-12"
				>
					<CameraControls
						{loading}
						bind:restartDialogOpen
						bind:resetDialogOpen
						bind:removeDeviceDialogOpen
						{toggleMicrophone}
						{toggleRecordingSound}
						{toggleNotifications}
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
						bind:notificationsEnabled
						{devices}
					/>
				</PullToRefresh>
			</Tabs.Content>
			<Tabs.Content value={TABS.HEALTH} class="min-h-0">
				<PullToRefresh
					onRefresh={() => {
						loadHealth();
						loadUpdateStatus();
						return loading.promise("health", "updateStatus");
					}}
					class="of-top of-bottom space-y-6 p-6 pb-12"
				>
					<CameraHealth
						{loading}
						bind:devDialogOpen
						bind:updateDialogOpen
						{loadHealth}
						{loadUpdateStatus}
						{health}
						model={product?.model}
						{updateStatus}
						{activeTab}
						healthTab={TABS.HEALTH}
						{startUpdate}
						{setVersionDev}
					/>
				</PullToRefresh>
			</Tabs.Content>
		</Tabs.Root>
	</div>
</div>
