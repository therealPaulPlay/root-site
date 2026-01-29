<script>
	import * as Popover from "$lib/components/ui/popover";
	import * as RangeCalendar from "$lib/components/ui/range-calendar";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import Label from "./ui/label/label.svelte";
	import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
	import {
		RiCalendarLine,
		RiErrorWarningLine,
		RiFilter3Line,
		RiRefreshLine,
		RiSearchAi2Line,
		RiTimeLine
	} from "svelte-remixicon";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { buttonVariants } from "./ui/button";
	import Button from "./ui/button/button.svelte";
	import Separator from "./ui/separator/separator.svelte";
	import { SvelteSet } from "svelte/reactivity";

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
		dateRangeOpen = $bindable(false),
		typeFilterOpen = $bindable(false),
		viewRecordingDialog = $bindable(false),
		recordingAudioElement = $bindable(),
		recordingVideoElement = $bindable(),
		recordingLoading = false,
		recordingLoadingPercent = 0,
		recordingVideoUrl,
		recordingAudioUrl
	} = $props();

	let dateRangeValue = $state(undefined);
	let selectedTypes = $state([]);
	let selectedEvent = $state(null);
	let viewedEventIds = new SvelteSet();

	const hasDateFilter = $derived(dateRangeValue?.start && dateRangeValue?.end);
	const hasTypeFilter = $derived(selectedTypes.length > 0);
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
			const dateKey = formatDate(event.timestamp);
			(groups[dateKey] ||= []).push(event);
			return groups;
		}, {})
	);

	const capitalizeType = (type) => type?.charAt(0).toUpperCase() + type?.slice(1);

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
	<Popover.Root bind:open={dateRangeOpen}>
		<Popover.Trigger
			class="{buttonVariants({ variant: 'outline', size: 'sm' })} gap-2 {hasDateFilter ? 'bg-muted' : ''}"
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
			class="{buttonVariants({ variant: 'outline', size: 'sm' })} gap-2 {hasTypeFilter ? 'bg-muted' : ''}"
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
	<div class="mt-6 border p-8 text-center text-muted-foreground">No events available.</div>
{:else if Object.keys(groupedEvents).length === 0}
	<div class="mt-6 border p-8 text-center text-muted-foreground">No events match the selected filters.</div>
{:else}
	{#each Object.entries(groupedEvents) as [dateKey, dateEvents]}
		<div class="sticky -top-6 z-10 flex items-center gap-4 bg-background mask-b-from-70% mask-b-to-100% py-4">
			<span class="shrink-0 text-sm font-medium text-muted-foreground">{dateKey}</span>
			<Separator class="flex-1" />
		</div>
		<div class="divide-y overflow-y-auto border">
			{#each dateEvents as event}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="relative flex flex-wrap items-center gap-4 p-4 hover:bg-accent active:bg-accent"
					role="button"
					tabindex="0"
					onclick={() => {
						selectedEvent = event;
						viewedEventIds.add(event.id);
						viewRecording(event);
					}}
				>
					<div class="aspect-video h-20 shrink-0 overflow-hidden border bg-muted" {@attach observeThumbnail(event.id)}>
						{#if eventThumbnails[event.id]}
							<img
								src={"data:image/jpg;base64," + eventThumbnails[event.id]}
								alt="Event thumbnail"
								class="h-full w-full object-cover"
							/>
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
					<div class="flex-1">
						<p class="mb-2 w-full font-medium">{new Date(event.timestamp).toLocaleTimeString()}</p>
						<div class="flex flex-col gap-1">
							<p class="inline-flex items-center gap-1 text-sm text-muted-foreground">
								<RiSearchAi2Line class="size-4" />
								{capitalizeType(event.event_type) || "N/A"}
							</p>
							<p class="inline-flex items-center gap-1 text-sm text-muted-foreground">
								<RiTimeLine class="size-4" />
								{event.duration || "N/A"}s
							</p>
						</div>
					</div>
					{#if viewedEventIds.has(event.id)}
						<div class="absolute top-2 right-2 w-1 h-1 bg-border"></div>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
{/if}

<!-- Recording Viewer Dialog -->
<Dialog.Root
	bind:open={viewRecordingDialog}
	onOpenChange={(open) => {
		if (!open) {
			if (recordingVideoUrl) {
				URL.revokeObjectURL(recordingVideoUrl);
				recordingVideoUrl = null;
			}
			if (recordingAudioUrl) {
				URL.revokeObjectURL(recordingAudioUrl);
				recordingAudioUrl = null;
			}
		}
	}}
>
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
			{:else if recordingVideoUrl}
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
