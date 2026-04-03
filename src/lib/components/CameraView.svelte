<script>
	import { getContext, onMount } from "svelte";
	import { on } from "svelte/events";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import * as Drawer from "$lib/components/ui/drawer";
	import { removeProduct } from "$lib/utils/pairedProductsStorage";
	import { toast } from "svelte-sonner";
	import CameraControls from "$lib/components/CameraControls.svelte";
	import CameraHealth from "$lib/components/CameraHealth.svelte";
	import CameraEvents from "$lib/components/CameraEvents.svelte";
	import PullToRefresh from "$lib/components/PullToRefresh.svelte";
	import StreamPlayer from "$lib/components/StreamPlayer.svelte";
	import { RiCloseLine, RiDownload2Line, RiErrorWarningLine } from "svelte-remixicon";
	import { slide } from "svelte/transition";
	import { SvelteSet } from "svelte/reactivity";
	import { MediaSourceManager } from "$lib/utils/mediaSourceManager";
	import { LoadingState } from "$lib/utils/loadingState.svelte.js";
	import { getFCMToken } from "$lib/utils/pushNotifications.js";
	import { Capacitor } from "@capacitor/core";
	import { snapshotVideo } from "$lib/utils/snapshotVideo";
	import { innerWidth } from "svelte/reactivity/window";

	let {
		productId,
		product,
		relayCommInstance,
		streamHandle,
		videoElement,
		highlightEventId = null,
		updateStatus = $bindable(),
		open = $bindable(false),
		onClose = () => {},
		onProductRemoved = () => {}
	} = $props();

	const getArticleEl = getContext("articleEl");

	const loading = new LoadingState();

	// Events
	let events = $state([]);
	let eventThumbnails = $state({});
	let viewRecordingDialog = $state(false);
	let recordingAudioElement = $state();
	let recordingVideoElement = $state();
	let recordingAudioUrl = $state(null);
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
	let notificationCooldown = $state(0);

	// Dialog open states
	let restartDialogOpen = $state(false);
	let resetDialogOpen = $state(false);
	let removeDeviceDialogOpen = $state({});
	let updateDialogOpen = $state(false);
	let devDialogOpen = $state(false);

	// Devices
	let devices = $state([]);

	// Health
	let health = $state(null);

	// Tab lazy loading
	const TABS = { EVENTS: "events", CONTROLS: "controls", HEALTH: "health" };
	let activeTab = $state(TABS.EVENTS);
	let tabsLoaded = $state({ [TABS.EVENTS]: false, [TABS.CONTROLS]: false, [TABS.HEALTH]: false });

	// Switch to events tab and reload when opened from a notification tap
	let lastHandledEventId = null;
	$effect(() => {
		if (!highlightEventId || highlightEventId === lastHandledEventId) return;
		lastHandledEventId = highlightEventId;
		activeTab = TABS.EVENTS;
		if (!events.some((e) => e.id === highlightEventId) && relayCommInstance) relayCommInstance.onConnected(() => loadEvents());
	});

	// Video element reparenting
	let videoMountTarget = $state(null);
	let originalParent = null;
	let snapshotCanvas = null;

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
				if (element.getBoundingClientRect().top < window.innerHeight + 100) queueThumbnail(eventId);
			});
			return () => observer.disconnect();
		};
	}

	// Stream
	let audioUnlockEl = $state(null);

	// Track event tab scroll position reactively
	$effect(() => {
		if (!eventListScrollElement) return;
		return on(eventListScrollElement, "scroll", () => (eventListScrollTop = eventListScrollElement.scrollTop), {
			passive: true
		});
	});

	// Reparent video element into CameraView when container is ready
	$effect(() => {
		if (videoElement && videoMountTarget) {
			originalParent = videoElement.parentElement;

			// Snapshot once the first frame is available so the player element doesn't flash black on close
			snapshotCanvas = snapshotVideo(videoElement, originalParent);
			function onLoadedData() {
				snapshotCanvas?.remove();
				snapshotCanvas = snapshotVideo(videoElement, originalParent);
			}
			videoElement.addEventListener("loadeddata", onLoadedData, { once: true });
			videoMountTarget.appendChild(videoElement);

			return () => {
				videoElement?.removeEventListener("loadeddata", onLoadedData);
				snapshotCanvas?.remove();
				snapshotCanvas = null;
				if (originalParent && videoElement) originalParent.appendChild(videoElement);
			};
		}
	});

	// Listen for drawer close
	let closeTimer;
	$effect(() => {
		if (!open) closeTimer = setTimeout(onClose, 500);
		return () => clearTimeout(closeTimer);
	});

	onMount(() => {
		if (!relayCommInstance) return console.warn("No relayComm instance passed to CameraView!");
		
		// Register all relay handlers
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
		relayCommInstance.on("setNotificationCooldownResult", handleSetNotificationCooldownResult);
		relayCommInstance.on("getDevicesResult", handleGetDevicesResult);
		relayCommInstance.on("removeDeviceResult", handleRemoveDeviceResult);
		relayCommInstance.on("getHealthResult", handleHealthResult);
		relayCommInstance.on("getUpdateStatusResult", handleUpdateStatusResult);
		relayCommInstance.on("startUpdateResult", handleStartUpdateResult);
		relayCommInstance.on("setVersionDevResult", handleSetVersionDevResult);
		relayCommInstance.on("restartResult", handleRestartResult);
		relayCommInstance.on("resetResult", handleResetResult);

		// Load events once connected since it's the default tab
		relayCommInstance.onConnected(() => loadEvents());

		return () => {
			// Unregister all relay handlers
			relayCommInstance.off("getEventsResult", handleEventsResult);
			relayCommInstance.off("getThumbnailResult", handleThumbnailResult);
			relayCommInstance.off("getRecordingResult", handleRecordingResult);
			relayCommInstance.off("getMicrophoneResult", handleGetMicrophoneResult);
			relayCommInstance.off("setMicrophoneResult", handleSetMicrophoneResult);
			relayCommInstance.off("getRecordingSoundResult", handleGetRecordingSoundResult);
			relayCommInstance.off("setRecordingSoundResult", handleSetRecordingSoundResult);
			relayCommInstance.off("getEventDetectionConfigResult", handleGetEventDetectionConfigResult);
			relayCommInstance.off("setEventDetectionEnabledResult", handleSetEventDetectionEnabledResult);
			relayCommInstance.off("setEventDetectionTypesResult", handleSetEventDetectionTypesResult);
			relayCommInstance.off("getNotificationsResult", handleGetNotificationsResult);
			relayCommInstance.off("setNotificationsResult", handleSetNotificationsResult);
			relayCommInstance.off("setNotificationCooldownResult", handleSetNotificationCooldownResult);
			relayCommInstance.off("getDevicesResult", handleGetDevicesResult);
			relayCommInstance.off("removeDeviceResult", handleRemoveDeviceResult);
			relayCommInstance.off("getHealthResult", handleHealthResult);
			relayCommInstance.off("getUpdateStatusResult", handleUpdateStatusResult);
			relayCommInstance.off("startUpdateResult", handleStartUpdateResult);
			relayCommInstance.off("setVersionDevResult", handleSetVersionDevResult);
			relayCommInstance.off("restartResult", handleRestartResult);
			relayCommInstance.off("resetResult", handleResetResult);

			// Cleanup local resources (NOT streamHandle or relayComm — those belong to parent)
			if (streamHandle) streamHandle.audioMuted = true;
			cleanupRecording();
			clearTimeout(thumbnailDrainTimeout);
			for (const url of Object.values(eventThumbnails)) if (url !== "error") URL.revokeObjectURL(url);
		};
	});

	// Cleanup recording when dialog closes
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
			relayCommInstance.send(productId, "getThumbnail", { id }).catch(() => {
				loadingThumbnails.delete(id);
				eventThumbnails[id] = "error";
			});
		}
	}

	function removeThumbnailFromQueue(eventId) {
		const index = thumbnailQueue.indexOf(eventId);
		if (index > -1) thumbnailQueue.splice(index, 1);
	}

	function handleThumbnailResult(msg) {
		loadingThumbnails.delete(msg.payload.eventId);
		if (!msg.payload.success) {
			eventThumbnails[msg.payload.eventId] = "error";
			return;
		}
		eventThumbnails[msg.payload.eventId] = URL.createObjectURL(new Blob([msg.payload.data], { type: "image/jpeg" }));
	}

	let recordingDuration = 0;

	function viewRecording(event) {
		viewRecordingDialog = true;
		loading.set("recording", true);
		recordingDuration = event.duration || 0;
		cleanupRecording();
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

		const eventId = msg.payload.eventId || msg.payload.metadata?.eventId;
		if (eventId && eventId !== currentRecordingEventId) return;

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
		// Pause and reset playback once the new blob src loads
		recordingVideoElement.addEventListener(
			"loadedmetadata",
			() => {
				recordingVideoElement.pause();
				recordingVideoElement.dispatchEvent(new Event("pause")); // Ensure onpause fires even if already paused through reset
				recordingVideoElement.currentTime = 0;
				if (recordingAudioElement) {
					recordingAudioElement.pause();
					recordingAudioElement.currentTime = 0;
				}
			},
			{ once: true }
		);
		recordingVideoElement.src = createBlobUrl(chunks, "video/mp4");
	}

	// Controls handlers
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

	let previousEventDetectionTypes = [];

	function updateEventDetectionTypes() {
		loading.set("eventDetectionTypes", true);
		previousEventDetectionTypes = [...eventDetectionTypes];
		relayCommInstance
			.send(productId, "setEventDetectionTypes", { enabledTypes: eventDetectionTypes })
			.catch((error) => {
				eventDetectionTypes = previousEventDetectionTypes;
				toast.error("Failed to update event detection types: " + error.message);
				console.error("Failed to update event detection types:", error);
				loading.set("eventDetectionTypes", false);
			});
	}

	function handleSetEventDetectionTypesResult(msg) {
		loading.set("eventDetectionTypes", false);
		if (!msg.payload.success) {
			eventDetectionTypes = previousEventDetectionTypes;
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
		notificationCooldown = msg.payload.cooldownMinutes;
	}

	async function toggleNotifications() {
		if (!Capacitor.isNativePlatform()) {
			setTimeout(() => (notificationsEnabled = false), 250);
			return toast.error("Push notifications are only available in the app.");
		}
		loading.set("notifications", true);

		if (notificationsEnabled) {
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

	let previousCooldown = 0;

	function updateNotificationCooldown() {
		loading.set("notificationCooldown", true);
		previousCooldown = notificationCooldown;
		relayCommInstance
			.send(productId, "setNotificationCooldown", { cooldownMinutes: notificationCooldown })
			.catch((error) => {
				notificationCooldown = previousCooldown;
				toast.error("Failed to update notification cooldown: " + error.message);
				console.error("Failed to update notification cooldown:", error);
				loading.set("notificationCooldown", false);
			});
	}

	function handleSetNotificationCooldownResult(msg) {
		loading.set("notificationCooldown", false);
		if (!msg.payload.success) {
			notificationCooldown = previousCooldown;
			toast.error("Failed to update notification cooldown: " + msg.payload.error || "Unknown error");
			return;
		}
		notificationCooldown = msg.payload.cooldownMinutes;
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
		toast.success("Restarting.");
		open = false; // Close drawer
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
		toast.success("Reset initiated.");
		removeProduct(msg.originId);
		open = false; // Close drawer & remove product
		onProductRemoved();
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
		// eslint-disable-next-line no-unused-vars
		const { success, ...status } = msg.payload;
		updateStatus = status;
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
		toast.success("Update started.");
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
		toast.success("Version set to dev.");
		loadUpdateStatus();
	}
</script>

<Drawer.Root
	bind:open
	shouldScaleBackground={false}
	container={getArticleEl()}
	modal={Capacitor.isNativePlatform() || innerWidth.current < 640}
>
	<Drawer.Content class="top-0! bottom-auto! safe-h-svh" showHandle={false}>
		<!-- Top bar with close button -->
		<div class="flex border-b text-xl">
			<Button class="h-20! border-t-0 border-b-0 border-l-0 p-6!" variant="outline" onclick={() => (open = false)}>
				<RiCloseLine class="shape-crisp h-8! w-8!" />
			</Button>
		</div>

		<!-- Video — StreamPlayer provides loading/ended/controls UI, video element is reparented into videoMountTarget -->
		<StreamPlayer
			bind:videoMountTarget
			streamLoading={streamHandle?.loading ?? true}
			streamEnded={streamHandle?.ended ?? false}
			showMuteButton={streamHandle?.audioActive ?? false}
			audioMuted={streamHandle?.audioMuted ?? true}
			onAudioToggle={() => {
				if (!streamHandle) return;
				streamHandle.setupAudio(audioUnlockEl);
				streamHandle.audioMuted = !streamHandle.audioMuted;
			}}
		/>

		<!-- Audio unlock element -->
		<audio
			bind:this={audioUnlockEl}
			src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
			class="hidden"
		></audio>

		<!-- Tabs — data-vaul-no-drag prevents pull-to-refresh from dragging the drawer -->
		<div class="w-full basis-full overflow-hidden border-t" data-vaul-no-drag>
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
							{highlightEventId}
							scrollElement={eventListScrollElement}
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
							{updateNotificationCooldown}
							{toggleEventDetection}
							{updateEventDetectionTypes}
							{removeDevice}
							{restartProduct}
							{resetProduct}
							bind:micEnabled
							bind:recordingSoundEnabled
							bind:eventDetectionEnabled
							bind:eventDetectionTypes
							bind:notificationsEnabled
							bind:notificationCooldown
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
							{health}
							model={product?.model}
							{updateStatus}
							{activeTab}
							{productId}
							healthTab={TABS.HEALTH}
							{startUpdate}
							{setVersionDev}
						/>
					</PullToRefresh>
				</Tabs.Content>
			</Tabs.Root>
		</div>
	</Drawer.Content>
</Drawer.Root>
