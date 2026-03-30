<script>
	import * as RangeCalendar from "$lib/components/ui/range-calendar";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import Label from "./ui/label/label.svelte";
	import { getLocalTimeZone } from "@internationalized/date";
	import {
		RiArrowDownSLine,
		RiCalendarFill,
		RiCalendarLine,
		RiErrorWarningLine,
		RiFilterFill,
		RiFilterLine,
		RiPauseFill,
		RiPlayFill,
		RiSearchAi2Line,
		RiShareLine,
		RiTimeLine
	} from "svelte-remixicon";
	import { slide } from "svelte/transition";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { buttonVariants } from "./ui/button";
	import Button from "./ui/button/button.svelte";
	import Separator from "./ui/separator/separator.svelte";
	import { SvelteDate, SvelteSet } from "svelte/reactivity";
	import CameraDetectionDialog from "./CameraDetectionDialog.svelte";
	import { page } from "$app/state";
	import { tick } from "svelte";
	import { formatDate, formatTime } from "$lib/utils/formatDateTime";

	let highlightEventId = $derived(page.url.searchParams.get("event-id"));

	let {
		events = [],
		loading,
		scrollElement,
		eventThumbnails = {},
		loadingThumbnails = [],
		thumbnailQueue = new SvelteSet(),
		observeThumbnail = () => {},
		viewRecording = () => {},
		viewRecordingDialog = $bindable(false),
		recordingAudioElement = $bindable(),
		recordingVideoElement = $bindable(),
		recordingAudioUrl,
		onShareRecording = () => {},
		onVideoError = () => {}
	} = $props();

	// Events list state
	let dateRangeOpen = $state(false);
	let typeFilterOpen = $state(false);
	let dateRangeValue = $state(undefined);
	let selectedTypes = $state([]);
	let selectedEvent = $state(null);
	let viewedEventIds = new SvelteSet();
	let expandedStacks = new SvelteSet();
	let detectionEvent = $state(null);
	let detectionDialogOpen = $state(false);

	// Highlight event from notification deep link
	let highlightedEventId = $state(null);
	let lastHandledEventId = null;
	let eventElements = $state({});

	$effect(() => {
		if (!highlightEventId || highlightEventId === lastHandledEventId || events.length === 0) return;
		if (!events.some((e) => e.id === highlightEventId)) return;
		lastHandledEventId = highlightEventId;
		highlightedEventId = highlightEventId;

		// Ensure the target date group is loaded
		const targetDayIndex = Object.entries(groupedEvents).findIndex(([_dateKey, clusters]) =>
			clusters.some((c) => c.events.some((e) => e.id === highlightEventId))
		);
		if (targetDayIndex >= visibleDayCount) visibleDayCount = targetDayIndex + 1;

		// Expand the cluster if the event is collapsed inside a stack
		for (const clusters of Object.values(groupedEvents)) {
			for (const cluster of clusters) {
				if (cluster.events.length > 1 && cluster.events.some((e) => e.id === highlightEventId)) {
					expandedStacks.add(cluster.id);
					break;
				}
			}
		}

		tick().then(() => {
			const el = eventElements[highlightEventId];
			if (el && scrollElement) {
				const elRect = el.getBoundingClientRect();
				const scrollRect = scrollElement.getBoundingClientRect();
				scrollElement.scrollTop += elRect.top - scrollRect.top - scrollElement.clientHeight / 2 + el.clientHeight / 2;
			}
			setTimeout(() => (highlightedEventId = null), 1500);
		});
	});

	// Recording player state
	let videoPaused = $state(true);
	let videoEnded = $state(false);
	let videoCurrentTime = $state(0);
	let videoDuration = $state(0);
	let controlsVisible = $state(true);
	let controlsTimeout = null;
	let scrubBarEl = $state(null);

	// Auto-hide controls during playback, keep visible when paused
	$effect(() => {
		if (videoPaused) {
			controlsVisible = true;
			clearTimeout(controlsTimeout);
		} else {
			controlsTimeout = setTimeout(() => {
				controlsVisible = false;
			}, 3000);
		}
	});

	function showControls() {
		controlsVisible = true;
		clearTimeout(controlsTimeout);
		if (!videoPaused)
			controlsTimeout = setTimeout(() => {
				controlsVisible = false;
			}, 3000);
	}

	function togglePlayPause() {
		if (!recordingVideoElement) return;
		if (videoEnded) {
			recordingVideoElement.currentTime = 0;
			videoEnded = false;
		}
		if (recordingVideoElement.paused) recordingVideoElement.play().catch(() => {});
		else recordingVideoElement.pause();
	}

	function scrubTo(clientX) {
		if (!recordingVideoElement || !videoDuration || !scrubBarEl) return;
		const rect = scrubBarEl.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		recordingVideoElement.currentTime = ratio * videoDuration;
		videoEnded = false;
		showControls();
	}

	function startScrubDrag(e) {
		e.currentTarget.setPointerCapture(e.pointerId);
		scrubTo(e.clientX);
	}

	// Event filtering
	const hasDateFilter = $derived(dateRangeValue?.start && dateRangeValue?.end);
	const hasTypeFilter = $derived(selectedTypes.length > 0);
	const availableTypes = $derived([...new Set(events.map((e) => e.eventType).filter(Boolean))].sort());
	const filteredEvents = $derived(
		events.filter((event) => {
			if (hasDateFilter) {
				const eventDate = new SvelteDate(event.timestamp).setHours(0, 0, 0, 0);
				const startDate = dateRangeValue.start.toDate(getLocalTimeZone()).getTime();
				const endDate = dateRangeValue.end.toDate(getLocalTimeZone()).getTime();
				if (eventDate < startDate || eventDate > endDate) return false;
			}
			if (hasTypeFilter && !selectedTypes.includes(event.eventType)) return false;
			return true;
		})
	);

	const GROUP_EVENTS_THRESHOLD = 5 * 60 * 1000; // 5 minutes

	// Group by date, then cluster consecutive events within groupEventsThreshold
	const groupedEvents = $derived.by(() => {
		const byDate = filteredEvents.reduce((groups, event) => {
			const dateKey = formatDate(event.timestamp);
			(groups[dateKey] ||= []).push(event);
			return groups;
		}, {});

		const result = {};

		for (const [dateKey, dateEvents] of Object.entries(byDate)) {
			const clusters = [];
			let current = [dateEvents[0]];

			for (let i = 1; i < dateEvents.length; i++) {
				const prev = new SvelteDate(dateEvents[i - 1]?.timestamp).getTime();
				const curr = new SvelteDate(dateEvents[i]?.timestamp).getTime();
				if (Math.abs(curr - prev) <= GROUP_EVENTS_THRESHOLD) current.push(dateEvents[i]);
				else {
					clusters.push(current);
					current = [dateEvents[i]];
				}
			}
			clusters.push(current);
			result[dateKey] = clusters.map((evts) => ({ id: evts[0]?.id, events: evts }));
		}
		return result;
	});

	// Pagination -------------------------------------------------------------------

	// Show 7 more date groups (= one week) each time the sentinel is visible
	const DAYS_PER_PAGE = 7;
	let visibleDayCount = $state(DAYS_PER_PAGE);

	// Only show the first visibleDayCount date groups
	const visibleDateEntries = $derived(Object.entries(groupedEvents).slice(0, visibleDayCount));
	const hasMoreDays = $derived(visibleDayCount < Object.entries(groupedEvents).length);

	// Reset visible count when filters change
	$effect(() => {
		dateRangeValue;
		selectedTypes;
		visibleDayCount = DAYS_PER_PAGE;
	});

	function observeLoadMore(element) {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && hasMoreDays) visibleDayCount += DAYS_PER_PAGE;
			},
			{ rootMargin: "0px 0px 400px 0px" }
		);
		observer.observe(element);
		return () => observer.disconnect();
	}
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
	<!-- Date range filter -->
	<Dialog.Root bind:open={dateRangeOpen}>
		<Dialog.Trigger class="{buttonVariants({ variant: 'outline' })} gap-2">
			{#if !hasDateFilter}
				<RiCalendarLine class="size-4" />
			{:else}
				<RiCalendarFill class="size-4" />
			{/if}
		</Dialog.Trigger>
		<Dialog.Content class="w-fit">
			<Dialog.Header>
				<Dialog.Title>Date range</Dialog.Title>
			</Dialog.Header>
			<div class="space-y-4">
				<RangeCalendar.RangeCalendar bind:value={dateRangeValue} class="border" />
				<Button variant="outline" disabled={!hasDateFilter} class="w-full" onclick={() => (dateRangeValue = undefined)}>
					Clear
				</Button>
			</div>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Type filter -->
	<Dialog.Root bind:open={typeFilterOpen}>
		<Dialog.Trigger class="{buttonVariants({ variant: 'outline' })} gap-2">
			{#if !hasTypeFilter}
				<RiFilterLine class="size-4" />
			{:else}
				<RiFilterFill class="size-4" />
			{/if}
		</Dialog.Trigger>
		<Dialog.Content class="w-fit min-w-xs">
			<Dialog.Header>
				<Dialog.Title>Type</Dialog.Title>
			</Dialog.Header>
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
		</Dialog.Content>
	</Dialog.Root>
</div>

{#if events.length === 0}
	<div class="mt-6 border p-8 text-center text-sm text-muted-foreground">
		{loading.is("events") ? "Events loading..." : "No events available."}
	</div>
{:else if Object.keys(groupedEvents).length === 0}
	<div class="mt-6 border p-8 text-center text-sm text-muted-foreground">No events match the selected filters.</div>
{:else}
	{#snippet eventItem(event)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			bind:this={eventElements[event.id]}
			class="relative flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-accent active:bg-accent {highlightedEventId ===
			event.id
				? 'animate-highlight'
				: ''}"
			role="button"
			tabindex="0"
			onclick={() => {
				selectedEvent = event;
				viewedEventIds.add(event.id);
				viewRecording(event);
			}}
		>
			<div class="flex-1">
				<p class="mb-2 w-full font-medium">{new Date(event.timestamp).toLocaleTimeString()}</p>
				<div class="flex flex-col gap-1">
					<button
						class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground capitalize hover:underline active:underline"
						onclick={(e) => {
							e.stopPropagation();
							detectionEvent = event;
							detectionDialogOpen = true;
						}}
					>
						<RiSearchAi2Line class="size-4" />{event.eventType || "N/A"}
					</button>
					<p class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground">
						<RiTimeLine class="size-4" />{event.duration || "N/A"}s
					</p>
				</div>
			</div>
			<div class="aspect-video h-20 shrink-0 overflow-hidden border bg-muted" {@attach observeThumbnail(event.id)}>
				{#if eventThumbnails[event.id] && eventThumbnails[event.id] !== "error"}
					<img src={eventThumbnails[event.id]} alt="Event thumbnail" class="h-full w-full object-cover" />
				{:else}
					<div class="flex h-full w-full items-center justify-center">
						{#if !eventThumbnails[event.id] && (loadingThumbnails.has(event.id) || thumbnailQueue.includes(event.id))}
							<Spinner class="size-4" />
						{:else}
							<RiErrorWarningLine class="size-4" />
						{/if}
					</div>
				{/if}
			</div>
			{#if viewedEventIds.has(event.id)}
				<div class="absolute top-2 left-2 h-1 w-1 bg-border"></div>
			{/if}
		</div>
	{/snippet}

	{#each visibleDateEntries as [dateKey, clusters]}
		<!-- Date header -->
		<div class="smooth-mask-b sticky -top-6 z-10 flex items-center gap-4 bg-background py-4">
			<span class="shrink-0 text-sm text-muted-foreground">{dateKey}</span>
			<Separator class="flex-1" />
		</div>
		<!-- Scrollable event list -->
		<div class="divide-y overflow-y-auto border">
			{#each clusters as cluster}
				{#if cluster.events.length === 1}
					{@render eventItem(cluster.events[0])}
				{:else}
					{@const expanded = expandedStacks.has(cluster.id)}
					<div class="relative">
						{#if expanded}
							<div
								class="absolute top-0 bottom-0 left-0 z-1 w-0.5 bg-border"
								transition:slide={{ duration: 150, axis: "x" }}
							></div>
						{/if}
						<div class="border-b">{@render eventItem(cluster.events[0])}</div>
						{#if !expanded}
							<div class="pb-2" in:slide={{ duration: 150 }}>
								{#each { length: Math.min(cluster.events.length - 1, 3) } as _, i}
									<div
										class="h-1.5 border-x border-b bg-muted/50"
										class:mx-2={i == 0}
										class:mx-4={i == 1}
										class:mx-6={i == 2}
									></div>
								{/each}
							</div>
						{:else}
							<div class="divide-y" transition:slide={{ duration: 150 }}>
								{#each cluster.events.slice(1) as event}
									{@render eventItem(event)}
								{/each}
							</div>
						{/if}
						<Button
							variant="outline"
							class="absolute top-3 right-3 z-3 text-sm"
							onclick={() => (expanded ? expandedStacks.delete(cluster.id) : expandedStacks.add(cluster.id))}
						>
							<RiArrowDownSLine class="size-4 {expanded ? 'rotate-180' : ''}" />{cluster.events.length} events
						</Button>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
	{#if hasMoreDays}
		<div {@attach observeLoadMore} class="flex justify-center p-6">
			<Spinner class="size-6" />
		</div>
	{/if}
{/if}

<!-- Recording Viewer Dialog -->
<Dialog.Root bind:open={viewRecordingDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>
				{selectedEvent
					? formatDate(selectedEvent.timestamp) + ", " + new Date(selectedEvent.timestamp).toLocaleTimeString()
					: ""}
			</Dialog.Title>
		</Dialog.Header>
		<div class="relative flex aspect-video w-full items-center justify-center border bg-muted text-muted-foreground">
			{#if loading.is("recording") || (!recordingVideoElement?.src && viewRecordingDialog)}
				<div class="absolute inset-0 flex items-center justify-center">
					{#if loading.is("recording")}
						<Spinner class="size-8" />
					{:else}
						<RiErrorWarningLine class="size-8" />
					{/if}
				</div>
			{/if}
			<div
				class="relative h-full w-full {loading.is('recording') || !recordingVideoElement?.src ? 'invisible' : ''}"
				role="button"
				tabindex="0"
				onpointerup={(e) => {
					if (e.pointerType !== "mouse") {
						clearTimeout(controlsTimeout);
						if (controlsVisible) controlsVisible = false;
						else showControls();
					}
				}}
				onpointermove={(e) => {
					if (e.pointerType === "mouse") showControls();
				}}
			>
				<video
					bind:this={recordingVideoElement}
					disableremoteplayback
					playsinline
					muted
					class="h-full w-full object-cover"
					onplay={() => {
						videoPaused = false;
						if (recordingAudioElement) {
							recordingAudioElement.currentTime = recordingVideoElement.currentTime;
							recordingAudioElement.play().catch(console.error);
						}
					}}
					onpause={() => {
						videoPaused = true;
						if (recordingAudioElement) recordingAudioElement.pause();
					}}
					onseeked={() => {
						if (recordingAudioElement) {
							recordingAudioElement.currentTime = recordingVideoElement.currentTime;
							if (!recordingVideoElement.paused) recordingAudioElement.play().catch(console.error);
						}
					}}
					ontimeupdate={() => {
						videoCurrentTime = recordingVideoElement?.currentTime || 0;
					}}
					onloadedmetadata={() => {
						videoDuration = recordingVideoElement?.duration || 0;
					}}
					onended={() => {
						videoEnded = true;
					}}
					onerror={(e) => {
						const error = e.currentTarget.error;
						if (!error.message?.toLowerCase()?.includes("empty src")) console.error("Recording playback error:", error); // Ignore empty src
						if (error?.code === 3) onVideoError();
					}}
				></video>
			</div>
			<!-- Custom controls (native controls break ManagedMediaSource on iOS) -->
			<div
				class="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-black/50 to-transparent p-4 pb-3 text-white transition-opacity duration-150 {controlsVisible &&
				!loading.is('recording') &&
				recordingVideoElement?.src
					? 'opacity-100'
					: 'pointer-events-none opacity-0'}"
				role="toolbar"
				tabindex="-1"
				onpointerup={(e) => e.stopPropagation()}
				onpointerdown={showControls}
			>
				<button onclick={togglePlayPause} class="-m-2 shrink-0 p-2">
					{#if videoPaused}
						<RiPlayFill class="size-6" />
					{:else}
						<RiPauseFill class="size-6" />
					{/if}
				</button>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={scrubBarEl}
					class="relative -mx-2 flex flex-1 cursor-pointer touch-none items-center px-2 py-3 select-none"
					onpointerdown={startScrubDrag}
					onpointermove={(e) => {
						if (scrubBarEl?.hasPointerCapture(e.pointerId)) scrubTo(e.clientX);
					}}
				>
					<div class="relative h-2 w-full bg-background/25 dark:bg-foreground/25">
						<div
							class="pointer-events-none absolute inset-y-0 left-0 bg-background dark:bg-foreground"
							style:width={(videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0) + "%"}
						></div>
					</div>
				</div>
				<span class="shrink-0 text-sm tabular-nums select-none"
					>{formatTime(videoCurrentTime)} / {formatTime(videoDuration)}</span
				>
				<button onclick={onShareRecording} class="-m-2 shrink-0 p-2">
					<RiShareLine class="size-5" />
				</button>
			</div>
			{#if recordingAudioUrl}
				<audio src={recordingAudioUrl} class="hidden" bind:this={recordingAudioElement}></audio>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

<CameraDetectionDialog
	bind:open={detectionDialogOpen}
	event={detectionEvent}
	thumbnailSrc={detectionEvent && eventThumbnails[detectionEvent.id] !== "error" ? eventThumbnails[detectionEvent.id] : null}
/>

<style>
	.animate-highlight {
		animation: highlight 1.5s ease-out;
	}

	@keyframes highlight {
		0%,
		15% {
			background-color: var(--accent);
		}
		30% {
			background-color: transparent;
		}
		45% {
			background-color: var(--accent);
		}
		70%,
		100% {
			background-color: transparent;
		}
	}

	.smooth-mask-b {
		mask-image: linear-gradient(
			to bottom,
			black 0%,
			black 70%,
			rgba(0, 0, 0, 0.67) 77.5%,
			rgba(0, 0, 0, 0.45) 83%,
			rgba(0, 0, 0, 0.26) 88.5%,
			rgba(0, 0, 0, 0.1) 94%,
			transparent 100%
		);
	}
</style>
