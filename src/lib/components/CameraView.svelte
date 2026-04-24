<script>
	import { getContext, onMount } from "svelte";
	import { on } from "svelte/events";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import * as Drawer from "$lib/components/ui/drawer";
	import { removeProduct } from "$lib/utils/pairedProductsStorage";
	import { getLocalTimeZone } from "@internationalized/date";
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
	import { muxVideoAndAudio } from "$lib/utils/muxRecording";
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
	let eventsNextCursor = $state(0);
	let eventsDateRange = $state();
	let eventsSelectedTypes = $state([]);
	let initialEventsLoaded = false;
	let eventThumbnails = $state({});
	let viewRecordingDialog = $state(false);
	let recordingAudioElement = $state();
	let recordingVideoElement = $state();
	let recordingAudioUrl = $state(null);
	let recordingChunks = $state({ video: [], audio: [] });
	let recordingTotalChunks = $state({ video: 0, audio: 0 });
	let recordingFullyLoaded = $derived(
		recordingTotalChunks.video > 0 && recordingChunks.video.filter(Boolean).length === recordingTotalChunks.video
	);
	let recordingManager = null;
	let eventListScrollElement = $state(null);
	let eventListScrollTop = $state(0);

	// Controls
	let micEnabled = $state(false);
	let recordingSoundEnabled = $state(false);
	let eventDetectionEnabled = $state(false);
	let eventDetectionTypes = $state([]);
	let eventTypes = $state([]);
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
	let tabsLoaded = $state(Object.fromEntries(Object.values(TABS).map((t) => [t, false])));

	// Switch to events tab and reload when opened from a notification tap
	let lastHandledEventId = null;
	$effect(() => {
		if (!highlightEventId || highlightEventId === lastHandledEventId) return;
		lastHandledEventId = highlightEventId;
		activeTab = TABS.EVENTS;

		// If events have already been loaded but the target is missing (stale), reload until required event
		if (initialEventsLoaded && !events.some((e) => e.id === highlightEventId) && relayCommInstance) {
			relayCommInstance.onConnected(() => loadEvents(0, { untilEventId: highlightEventId, resetFilter: true }));
		}
	});

	// Video element reparenting
	let videoMountTarget = $state(null);
	let originalParent = null;
	let snapshotCanvas = null;

	// Thumbnail IntersectionObserver
	function observeThumbnail(eventId) {
		const rootMargin = 100; // Expand intersection area by this
		return (element) => {
			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) queueThumbnail(eventId);
					else removeThumbnailFromQueue(eventId);
				},
				{ root: eventListScrollElement, rootMargin: rootMargin + "px" }
			);
			observer.observe(element);
			requestAnimationFrame(() => {
				if (element.getBoundingClientRect().top < window.innerHeight + rootMargin) queueThumbnail(eventId);
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
				if (originalParent && videoElement) originalParent.appendChild(videoElement);
				snapshotCanvas?.remove();
				snapshotCanvas = null;
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

		// getRecording streams chunks back as server pushes after the initial reply
		relayCommInstance.onPush(productId, "fileChunk", handleRecordingChunk);

		// Load events and event detection config once connected (events is the default tab)
		relayCommInstance.onConnected(() => {
			loadEvents(0, { untilEventId: highlightEventId }); // highlightedEventId can be undefined
			loadEventDetectionConfig();
		});

		return () => {
			relayCommInstance.offPush(productId, "fileChunk", handleRecordingChunk);

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
	function filterKey() {
		return `${eventsDateRange?.start}|${eventsDateRange?.end}|${eventsSelectedTypes.join()}`;
	}
	let lastFilterKey = filterKey();

	function applyFilterIfChanged() {
		const key = filterKey();
		if (key === lastFilterKey) return;
		lastFilterKey = key;
		loadEvents(0);
	}

	function buildFilterParams() {
		const params = {};
		if (eventsDateRange?.start && eventsDateRange?.end) {
			params.startTime = BigInt(eventsDateRange.start.toDate(getLocalTimeZone()).getTime());
			const endDate = eventsDateRange.end.toDate(getLocalTimeZone());
			endDate.setHours(23, 59, 59, 999);
			params.endTime = BigInt(endDate.getTime());
		}
		if (eventsSelectedTypes.length > 0) params.eventTypes = eventsSelectedTypes;
		return params;
	}

	async function loadEvents(cursor = 0, { untilEventId, resetFilter } = {}) {
		if (cursor === 0) {
			eventsNextCursor = 0;
			if (resetFilter) {
				eventsDateRange = undefined;
				eventsSelectedTypes = [];
				lastFilterKey = filterKey();
			}
		}
		loading.set("events", true);
		const params = { limit: 200, cursor, ...buildFilterParams() };
		if (untilEventId) params.untilEventId = untilEventId;
		try {
			const response = await relayCommInstance.request(productId, "getEvents", params);
			if (!response.success) {
				toast.error("Failed to load events: " + (response.error || "Unknown error"));
				return;
			}
			initialEventsLoaded = true;
			const incoming = response.events || [];
			if (eventsNextCursor > 0) events = [...events, ...incoming];
			else events = incoming;
			// Firmware returns 0 as nextCursor when there are no more pages
			eventsNextCursor = response.nextCursor ?? 0;
		} catch (error) {
			toast.error("Failed to load events: " + error.message);
			console.error("Failed to load events:", error);
		} finally {
			loading.set("events", false);
		}
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
			loadThumbnail(id);
		}
	}

	async function loadThumbnail(eventId) {
		try {
			const response = await relayCommInstance.request(productId, "getThumbnail", { id: eventId });
			if (!response.success) {
				eventThumbnails[eventId] = "error";
				return;
			}
			eventThumbnails[eventId] = URL.createObjectURL(
				new Blob([response.data], { type: "image/jpeg" })
			);
		} catch {
			eventThumbnails[eventId] = "error";
		} finally {
			loadingThumbnails.delete(eventId);
		}
	}

	function removeThumbnailFromQueue(eventId) {
		const index = thumbnailQueue.indexOf(eventId);
		if (index > -1) thumbnailQueue.splice(index, 1);
	}

	let recordingDuration = 0;

	async function viewRecording(event) {
		viewRecordingDialog = true;
		loading.set("recording", true);
		recordingDuration = event.duration || 0;
		cleanupRecording();
		recordingChunks = { video: [], audio: [] };
		recordingTotalChunks = { video: 0, audio: 0 };
		currentRecordingEventId = event.id;
		try {
			const response = await relayCommInstance.request(productId, "getRecording", { id: event.id });
			if (!response.success) {
				toast.error("Failed to load recording: " + (response.error || "Unknown error"));
				loading.set("recording", false);
			}
			// Chunks follow as pushes and are dispatched by handleRecordingChunk
		} catch (error) {
			toast.error("Failed to load recording: " + error.message);
			console.error("Failed to load recording:", error);
			loading.set("recording", false);
		}
	}

	let currentRecordingEventId = $state(null);

	// Dispatched by onPush for each streamed file chunk after a successful viewRecording
	function handleRecordingChunk(payload, error) {
		if (error) return console.error("Protocol error for recording chunk:", error.message);
		if (!payload.success) return console.error("Recording chunk error:", payload.error);
		const eventId = payload.eventId || payload.metadata?.eventId;
		if (eventId && eventId !== currentRecordingEventId) return;
		if (!payload.chunk) return;

		const { fileType, chunkIndex, totalChunks, chunk } = payload;
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

	function combineChunks(chunks) {
		const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}
		return combined;
	}

	async function shareRecording() {
		if (!navigator.share) return toast.error("Sharing is not supported in this environment.");
		const videoChunks = recordingChunks?.video?.filter(Boolean);
		if (!videoChunks?.length) return;
		try {
			const videoBytes = combineChunks(videoChunks);

			// recordingAudioUrl is only set once every audio chunk has arrived, so it's our completion signal
			const audioChunks = recordingAudioUrl ? recordingChunks.audio : null;
			let fileBytes = videoBytes;
			if (audioChunks?.length) {
				try {
					fileBytes = muxVideoAndAudio(videoBytes, combineChunks(audioChunks));
				} catch (error) {
					console.error("Failed to mux audio with video, sharing video only:", error);
					fileBytes = videoBytes;
				}
			}

			const eventTimestamp = events.find((e) => e.id === currentRecordingEventId)?.timestamp;
			const timestamp = eventTimestamp
				? new Date(eventTimestamp).toISOString().replace(/[:.]/g, "-")
				: "default-no-date";
			const file = new File([fileBytes], `recording-${timestamp}.mp4`, { type: "video/mp4" });
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
	async function loadMicrophone() {
		loading.set("mic", true);
		try {
			const response = await relayCommInstance.request(productId, "getMicrophone");
			if (!response.success) {
				toast.error("Failed to load microphone setting: " + (response.error || "Unknown error"));
				return;
			}
			micEnabled = response.enabled;
		} catch (error) {
			toast.error("Failed to load microphone setting: " + error.message);
			console.error("Failed to load microphone setting:", error);
		} finally {
			loading.set("mic", false);
		}
	}

	async function toggleMicrophone() {
		loading.set("mic", true);
		try {
			const response = await relayCommInstance.request(productId, "setMicrophone", { enabled: micEnabled });
			if (!response.success) {
				micEnabled = !micEnabled;
				toast.error("Failed to set microphone: " + (response.error || "Unknown error"));
				return;
			}
			micEnabled = response.enabled;
		} catch (error) {
			micEnabled = !micEnabled;
			toast.error("Failed to set microphone: " + error.message);
			console.error("Failed to set microphone:", error);
		} finally {
			loading.set("mic", false);
		}
	}

	async function loadRecordingSound() {
		loading.set("sound", true);
		try {
			const response = await relayCommInstance.request(productId, "getRecordingSound");
			if (!response.success) {
				toast.error("Failed to load recording sound setting: " + (response.error || "Unknown error"));
				return;
			}
			recordingSoundEnabled = response.enabled;
		} catch (error) {
			toast.error("Failed to load recording sound setting: " + error.message);
			console.error("Failed to load recording sound setting:", error);
		} finally {
			loading.set("sound", false);
		}
	}

	async function toggleRecordingSound() {
		loading.set("sound", true);
		try {
			const response = await relayCommInstance.request(productId, "setRecordingSound", { enabled: recordingSoundEnabled });
			if (!response.success) {
				recordingSoundEnabled = !recordingSoundEnabled;
				toast.error("Failed to set recording sound: " + (response.error || "Unknown error"));
				return;
			}
			recordingSoundEnabled = response.enabled;
		} catch (error) {
			recordingSoundEnabled = !recordingSoundEnabled;
			toast.error("Failed to toggle recording sound: " + error.message);
			console.error("Failed to toggle recording sound:", error);
		} finally {
			loading.set("sound", false);
		}
	}

	async function loadEventDetectionConfig() {
		loading.set("eventDetection", true);
		try {
			const response = await relayCommInstance.request(productId, "getEventDetectionConfig");
			if (!response.success) {
				toast.error("Failed to load event detection config: " + (response.error || "Unknown error"));
				return;
			}
			eventDetectionEnabled = response.enabled;
			eventDetectionTypes = response.enabledTypes || [];
			eventTypes = response.availableEventTypes || [];
		} catch (error) {
			toast.error("Failed to load event detection config: " + error.message);
			console.error("Failed to load event detection config:", error);
		} finally {
			loading.set("eventDetection", false);
		}
	}

	async function toggleEventDetection() {
		loading.set("eventDetection", true);
		try {
			const response = await relayCommInstance.request(productId, "setEventDetectionEnabled", { enabled: eventDetectionEnabled });
			if (!response.success) {
				eventDetectionEnabled = !eventDetectionEnabled;
				toast.error("Failed to set event detection: " + (response.error || "Unknown error"));
				return;
			}
			eventDetectionEnabled = response.enabled;
		} catch (error) {
			eventDetectionEnabled = !eventDetectionEnabled;
			toast.error("Failed to toggle event detection: " + error.message);
			console.error("Failed to toggle event detection:", error);
		} finally {
			loading.set("eventDetection", false);
		}
	}

	let previousEventDetectionTypes = [];

	async function updateEventDetectionTypes() {
		loading.set("eventDetectionTypes", true);
		previousEventDetectionTypes = [...eventDetectionTypes];
		try {
			const response = await relayCommInstance.request(productId, "setEventDetectionTypes", { enabledTypes: eventDetectionTypes });
			if (!response.success) {
				eventDetectionTypes = previousEventDetectionTypes;
				toast.error("Failed to set event detection types: " + (response.error || "Unknown error"));
				return;
			}
			eventDetectionTypes = response.enabledTypes || [];
		} catch (error) {
			eventDetectionTypes = previousEventDetectionTypes;
			toast.error("Failed to update event detection types: " + error.message);
			console.error("Failed to update event detection types:", error);
		} finally {
			loading.set("eventDetectionTypes", false);
		}
	}

	async function loadNotifications() {
		loading.set("notifications", true);
		try {
			const response = await relayCommInstance.request(productId, "getNotifications");
			if (!response.success) {
				toast.error("Failed to load notification status: " + (response.error || "Unknown error"));
				return;
			}
			notificationsEnabled = response.enabled;
			notificationCooldown = response.cooldownMinutes;
		} catch (error) {
			toast.error("Failed to load notification status: " + error.message);
			console.error("Failed to load notification status:", error);
		} finally {
			loading.set("notifications", false);
		}
	}

	async function toggleNotifications() {
		if (!Capacitor.isNativePlatform()) {
			setTimeout(() => (notificationsEnabled = false), 250);
			return toast.error("Push notifications are only available in the app.");
		}
		loading.set("notifications", true);

		try {
			let response;
			if (notificationsEnabled) {
				const fcmToken = await getFCMToken();
				if (!fcmToken) {
					notificationsEnabled = false;
					return;
				}
				response = await relayCommInstance.request(productId, "setNotifications", { enabled: true, fcmToken });
			} else {
				response = await relayCommInstance.request(productId, "setNotifications", { enabled: false });
			}
			if (!response.success) {
				notificationsEnabled = !notificationsEnabled;
				toast.error("Failed to update notifications: " + (response.error || "Unknown error"));
				return;
			}
			notificationsEnabled = response.enabled;
		} catch (error) {
			notificationsEnabled = !notificationsEnabled;
			toast.error("Failed to update notifications: " + error.message);
			console.error("Failed to update notifications:", error);
		} finally {
			loading.set("notifications", false);
		}
	}

	let previousCooldown = 0;

	async function updateNotificationCooldown() {
		loading.set("notificationCooldown", true);
		previousCooldown = notificationCooldown;
		try {
			const response = await relayCommInstance.request(productId, "setNotificationCooldown", {
				cooldownMinutes: notificationCooldown
			});
			if (!response.success) {
				notificationCooldown = previousCooldown;
				toast.error("Failed to update notification cooldown: " + (response.error || "Unknown error"));
				return;
			}
			notificationCooldown = response.cooldownMinutes;
		} catch (error) {
			notificationCooldown = previousCooldown;
			toast.error("Failed to update notification cooldown: " + error.message);
			console.error("Failed to update notification cooldown:", error);
		} finally {
			loading.set("notificationCooldown", false);
		}
	}

	async function loadDevices() {
		loading.set("devices", true);
		try {
			const response = await relayCommInstance.request(productId, "getDevices");
			if (!response.success) {
				toast.error("Failed to load devices: " + (response.error || "Unknown error"));
				return;
			}
			devices = response.devices || [];
		} catch (error) {
			toast.error("Failed to load devices: " + error.message);
			console.error("Failed to load devices:", error);
		} finally {
			loading.set("devices", false);
		}
	}

	async function removeDevice(deviceId) {
		loading.set(`remove-${deviceId}`, true);
		try {
			const response = await relayCommInstance.request(productId, "removeDevice", { targetDeviceId: deviceId });
			if (!response.success) {
				toast.error("Failed to remove device: " + (response.error || "Unknown error"));
				return;
			}
			const removedId = response.removedDeviceId;
			devices = devices.filter((d) => d.id !== removedId);
			delete removeDeviceDialogOpen[removedId];
		} catch (error) {
			toast.error("Failed to remove device: " + error.message);
			console.error("Failed to remove device:", error);
		} finally {
			loading.set(`remove-${deviceId}`, false);
		}
	}

	async function restartProduct() {
		loading.set("restart", true);
		try {
			const response = await relayCommInstance.request(productId, "restart");
			if (!response.success) {
				toast.error("Failed to restart product: " + (response.error || "Unknown error"));
				return;
			}
			restartDialogOpen = false;
			toast.success("Restarting.");
			open = false;
		} catch (error) {
			toast.error("Failed to restart device: " + error.message);
			console.error("Failed to restart device:", error);
		} finally {
			loading.set("restart", false);
		}
	}

	async function resetProduct() {
		loading.set("reset", true);
		try {
			const response = await relayCommInstance.request(productId, "reset");
			if (!response.success) {
				toast.error("Failed to reset device: " + (response.error || "Unknown error"));
				return;
			}
			resetDialogOpen = false;
			toast.success("Reset initiated.");
			removeProduct(productId);
			open = false;
			onProductRemoved();
		} catch (error) {
			toast.error("Failed to reset device: " + error.message);
			console.error("Failed to reset device:", error);
		} finally {
			loading.set("reset", false);
		}
	}

	async function loadHealth() {
		loading.set("health", true);
		try {
			const response = await relayCommInstance.request(productId, "getHealth");
			if (!response.success) {
				toast.error("Failed to load health data: " + (response.error || "Unknown error"));
				return;
			}
			health = {
				battery: response.battery,
				wifi: response.wifi,
				relayDomain: response.relayDomain,
				logs: response.logs,
				uptimeSeconds: response.uptimeSeconds,
				metrics: response.metrics
			};
		} catch (error) {
			toast.error("Failed to load health data: " + error.message);
			console.error("Failed to load health data:", error);
		} finally {
			loading.set("health", false);
		}
	}

	async function loadUpdateStatus() {
		loading.set("updateStatus", true);
		try {
			const response = await relayCommInstance.request(productId, "getUpdateStatus");
			if (!response.success) {
				toast.error("Failed to load update status: " + (response.error || "Unknown error"));
				return;
			}
			// eslint-disable-next-line no-unused-vars
			const { success, ...status } = response;
			updateStatus = status;
		} catch (error) {
			toast.error("Failed to load update status: " + error.message);
			console.error("Failed to load update status:", error);
		} finally {
			loading.set("updateStatus", false);
		}
	}

	async function startUpdate() {
		loading.set("update", true);
		try {
			const response = await relayCommInstance.request(productId, "startUpdate");
			if (!response.success) {
				toast.error("Failed to start update: " + (response.error || "Unknown error"));
				return;
			}
			updateDialogOpen = false;
			toast.success("Update started.");
			loadUpdateStatus();
		} catch (error) {
			toast.error("Failed to start update: " + error.message);
			console.error("Failed to start update:", error);
		} finally {
			loading.set("update", false);
		}
	}

	async function setVersionDev() {
		loading.set("setVersionDev", true);
		try {
			const response = await relayCommInstance.request(productId, "setVersionDev");
			if (!response.success) {
				toast.error("Failed to set version to dev: " + (response.error || "Unknown error"));
				return;
			}
			devDialogOpen = false;
			toast.success("Version set to dev.");
			loadUpdateStatus();
		} catch (error) {
			toast.error("Failed to set version to dev: " + error.message);
			console.error("Failed to set version to dev:", error);
		} finally {
			loading.set("setVersionDev", false);
		}
	}
</script>

<Drawer.Root
	bind:open
	shouldScaleBackground={false}
	container={getArticleEl()}
	modal={Capacitor.isNativePlatform() || innerWidth.current < 640}
>
	<Drawer.Content class="safe-h-svh top-0! bottom-auto!" showHandle={false}>
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
							loadEvents(0, { resetFilter: true });
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
							{eventTypes}
							{observeThumbnail}
							{viewRecording}
							{loading}
							{eventThumbnails}
							{loadingThumbnails}
							{thumbnailQueue}
							{highlightEventId}
							hasMore={eventsNextCursor !== 0}
							bind:dateRange={eventsDateRange}
							bind:selectedTypes={eventsSelectedTypes}
							onApplyFilter={applyFilterIfChanged}
							onLoadMore={() => {
								if (eventsNextCursor !== 0 && !loading.is("events")) loadEvents(eventsNextCursor);
							}}
							scrollElement={eventListScrollElement}
							bind:viewRecordingDialog
							bind:recordingAudioElement
							bind:recordingVideoElement
							{recordingAudioUrl}
							{recordingFullyLoaded}
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
							{eventTypes}
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
