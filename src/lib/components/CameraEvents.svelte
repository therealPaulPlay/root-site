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
		RiRefreshLine,
		RiSearchAi2Line,
		RiTimeLine
	} from "svelte-remixicon";
	import { slide } from "svelte/transition";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { buttonVariants } from "./ui/button";
	import Button from "./ui/button/button.svelte";
	import Separator from "./ui/separator/separator.svelte";
	import { SvelteSet } from "svelte/reactivity";

	const groupEventsThreshold = 5 * 60 * 1000; // 5 minutes

	let {
		events = [],
		loadEvents = () => {},
		eventsLoading = false,
		recordingHasAudio = false,
		eventThumbnails = {},
		loadingThumbnails = [],
		thumbnailQueue = new SvelteSet(),
		observeThumbnail = () => {},
		viewRecording = () => {},
		viewRecordingDialog = $bindable(false),
		recordingAudioElement = $bindable(),
		recordingVideoElement = $bindable(),
		recordingLoading = false,
		recordingLoadingPercent = 0,
		recordingVideoUrl,
		recordingAudioUrl
	} = $props();

	let dateRangeOpen = $state(false);
	let typeFilterOpen = $state(false);
	let dateRangeValue = $state(undefined);
	let selectedTypes = $state([]);
	let selectedEvent = $state(null);
	let viewedEventIds = new SvelteSet();
	let expandedStacks = new SvelteSet();

	const hasDateFilter = $derived(dateRangeValue?.start && dateRangeValue?.end);
	const hasTypeFilter = $derived(selectedTypes.length > 0);
	const availableTypes = $derived([...new Set(events.map((e) => e.event_type).filter(Boolean))].sort());
	const filteredEvents = $derived(
		events.filter((event) => {
			if (hasDateFilter) {
				const eventDate = new Date(event.timestamp).setHours(0, 0, 0, 0);
				const startDate = dateRangeValue.start.toDate(getLocalTimeZone()).getTime();
				const endDate = dateRangeValue.end.toDate(getLocalTimeZone()).getTime();
				if (eventDate < startDate || eventDate > endDate) return false;
			}
			if (hasTypeFilter && !selectedTypes.includes(event.event_type)) return false;
			return true;
		})
	);

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
				const prev = new Date(dateEvents[i - 1]?.timestamp).getTime();
				const curr = new Date(dateEvents[i]?.timestamp).getTime();
				if (Math.abs(curr - prev) <= groupEventsThreshold) current.push(dateEvents[i]);
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

	function formatDate(date) {
		const d = new Date(date);
		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		if (d.toDateString() === today.toDateString()) return "Today";
		if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
		return d.toLocaleDateString();
	}

	function tryPlayRecording() {
		if (!recordingVideoElement || recordingVideoElement.readyState < 2) return;
		if (recordingHasAudio && (!recordingAudioElement || recordingAudioElement.readyState < 2)) return;
		if (recordingAudioElement) recordingAudioElement.currentTime = 0;
		recordingVideoElement.play().catch(console.error);
	}
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
	<!-- Date range filter -->
	<Dialog.Root bind:open={dateRangeOpen}>
		<Dialog.Trigger class="{buttonVariants({ variant: 'outline', size: 'sm' })} gap-2">
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
		</Dialog.Content>
	</Dialog.Root>

	<!-- Type filter -->
	<Dialog.Root bind:open={typeFilterOpen}>
		<Dialog.Trigger class="{buttonVariants({ variant: 'outline', size: 'sm' })} gap-2">
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
	<div class="mt-6 border p-8 text-center text-sm text-muted-foreground">No events available.</div>
{:else if Object.keys(groupedEvents).length === 0}
	<div class="mt-6 border p-8 text-center text-sm text-muted-foreground">No events match the selected filters.</div>
{:else}
	{#snippet eventItem(event)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="relative flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-accent active:bg-accent"
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
					<p class="inline-flex items-center gap-1 text-sm text-muted-foreground capitalize">
						<RiSearchAi2Line class="size-4" />{event.event_type || "N/A"}
					</p>
					<p class="inline-flex items-center gap-1 text-sm text-muted-foreground">
						<RiTimeLine class="size-4" />{event.duration || "N/A"}s
					</p>
				</div>
			</div>
			<div class="aspect-video h-20 shrink-0 overflow-hidden border bg-muted" {@attach observeThumbnail(event.id)}>
				{#if eventThumbnails[event.id]}
					<img src={eventThumbnails[event.id]} alt="Event thumbnail" class="h-full w-full object-cover" />
				{:else}
					<div class="flex h-full w-full items-center justify-center">
						{#if loadingThumbnails.has(event.id) || thumbnailQueue.includes(event.id)}
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

	{#each Object.entries(groupedEvents) as [dateKey, clusters]}
		<!-- Date header -->
		<div class="sticky -top-6 z-10 flex items-center gap-4 bg-background mask-b-from-70% mask-b-to-100% py-4">
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
						<!-- Thread line for expanded events from the same cluster -->
						{#if expanded}
							<div
								class="absolute top-0 bottom-0 left-0 z-1 w-0.5 bg-border"
								transition:slide={{ duration: 150, axis: "x" }}
							></div>
						{/if}
						<div class="border-b">{@render eventItem(cluster.events[0])}</div>
						{#if !expanded}
							<!-- Stacked events visualization -->
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
							<!-- Actual expanded events -->
							<div class="divide-y" transition:slide={{ duration: 150 }}>
								{#each cluster.events.slice(1) as event}
									{@render eventItem(event)}
								{/each}
							</div>
						{/if}
						<Button
							variant="outline"
							size="sm"
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
{/if}

<!-- Recording Viewer Dialog -->
<Dialog.Root bind:open={viewRecordingDialog}>
	<Dialog.Content class="max-w-4xl">
		<Dialog.Header>
			<Dialog.Title
				>{selectedEvent
					? formatDate(selectedEvent.timestamp) + ", " + new Date(selectedEvent.timestamp).toLocaleTimeString()
					: ""}</Dialog.Title
			>
		</Dialog.Header>
		<div class="relative flex aspect-video w-full items-center justify-center border bg-foreground">
			{#if recordingLoading}
				<Spinner class="size-8 text-background" />
				<p class="absolute mt-22 w-full -translate-y-1/2 text-center text-sm text-background">
					{recordingLoadingPercent}%
				</p>
			{:else if recordingVideoUrl || !viewRecordingDialog}
				<video
					src={recordingVideoUrl}
					bind:this={recordingVideoElement}
					controls
					class="h-full w-full"
					onloadeddata={tryPlayRecording}
					onplay={() => {
						if (recordingAudioElement) {
							recordingAudioElement.currentTime = recordingVideoElement.currentTime;
							recordingAudioElement.play().catch(console.error);
						}
					}}
					onpause={() => {
						if (recordingAudioElement) recordingAudioElement.pause();
					}}
					onseeked={() => {
						if (recordingAudioElement) {
							recordingAudioElement.currentTime = recordingVideoElement.currentTime;
							if (!recordingVideoElement.paused) recordingAudioElement.play().catch(console.error);
						}
					}}
				>
					<track kind="captions" />
				</video>
				{#if recordingAudioUrl}
					<audio
						src={recordingAudioUrl}
						class="hidden"
						bind:this={recordingAudioElement}
						onloadeddata={tryPlayRecording}
					>
						<track kind="captions" />
					</audio>
				{/if}
			{:else}
				<RiErrorWarningLine class="size-8 text-background" />
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
