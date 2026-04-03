<script>
	import { RiDownload2Line } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";
	import * as AlertDialog from "./ui/alert-dialog";
	import MetricsChart from "./MetricsChart.svelte";
	import { vibrate } from "$lib/utils/haptics";

	let {
		health,
		loading,
		model,
		updateStatus,
		activeTab,
		healthTab = "",
		productId,
		devDialogOpen = $bindable(false),
		updateDialogOpen = $bindable(false),
		startUpdate = () => {},
		setVersionDev = () => {}
	} = $props();

	let logsContainer = $state();
	let hoveredTimestamp = $state(null);
	let prevLogs = $state(null);

	// Index of the single nearest log to the hovered timestamp (within 2s)
	const highlightedLogIndex = $derived.by(() => {
		if (!hoveredTimestamp || !health?.logs?.length) return -1;
		let closest = 0;
		let closestDist = Math.abs(new Date(health.logs[0].timestamp).getTime() - hoveredTimestamp);
		for (let i = 1; i < health.logs.length; i++) {
			const dist = Math.abs(new Date(health.logs[i].timestamp).getTime() - hoveredTimestamp);
			if (dist < closestDist) {
				closest = i;
				closestDist = dist;
			}
		}
		return closestDist <= 30 * 1000 ? closest : -1;
	});

	// Scroll to bottom whenever logs data changes
	$effect(() => {
		if (logsContainer && health?.logs?.length && activeTab === healthTab && health?.logs !== prevLogs) {
			prevLogs = health?.logs;
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});

	// When hovering on chart, scroll logs container to the highlighted entry
	$effect(() => {
		if (highlightedLogIndex < 0 || !logsContainer) return;
		const entry = logsContainer.children[highlightedLogIndex];
		if (entry) {
			const containerHeight = logsContainer.getBoundingClientRect().height;
			logsContainer.scrollTop =
				entry.offsetTop - logsContainer.offsetTop - containerHeight / 2 + entry.offsetHeight / 2;
		}
	});

	// Haptic feedback whenever the highlighted log changes
	$effect(() => {
		if (highlightedLogIndex !== -1) vibrate.light();
	});
</script>

<div class="space-y-6">
	{#if updateStatus}
		<div class="space-y-4 border p-4">
			<Label class="text-base">Firmware</Label>
			<div class="space-y-2 text-sm">
				{#if updateStatus.currentVersion}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Version</span>
						<button onclick={() => updateStatus.currentVersion !== "dev" && (devDialogOpen = true)}
							>{updateStatus.currentVersion}</button
						>
					</div>
				{/if}
				{#if updateStatus.status}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Status</span>
						<span>{updateStatus.status}</span>
					</div>
				{/if}
				{#if updateStatus.currentSlot}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Slot</span>
						<span>{updateStatus.currentSlot}</span>
					</div>
				{/if}
				{#if updateStatus.availableVersion}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Available</span>
						<span>{updateStatus.availableVersion}</span>
					</div>
				{/if}
				{#if updateStatus.scheduledFor}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Scheduled</span>
						<span
							>{new Date(updateStatus.scheduledFor).toLocaleString(undefined, {
								dateStyle: "short",
								timeStyle: "short"
							})}</span
						>
					</div>
				{/if}
				{#if updateStatus.error}
					<div class="border p-4 text-center text-muted-foreground select-text">
						Error: {updateStatus.error}
					</div>
				{/if}
			</div>
			{#if updateStatus.availableVersion}
				<div class="flex w-full items-center justify-end">
					<Button
						onclick={() => (updateDialogOpen = true)}
						disabled={["downloading", "installing"].includes(updateStatus.status)}
						variant="outline"
					>
						Install update
						<RiDownload2Line class="size-4" />
					</Button>
				</div>
			{/if}
		</div>
	{:else if loading.is("updateStatus")}
		<div class="h-55 animate-shimmer border"></div>
	{:else}
		<div class="border p-8 text-center text-sm text-muted-foreground">No update status available.</div>
	{/if}

	{#if health}
		<div class="space-y-4 border p-4">
			<Label class="text-base">Network</Label>
			<div class="space-y-2 text-sm">
				{#if health.wifi.connectedSSID}
					<div class="flex justify-between">
						<span class="text-muted-foreground">WiFi</span>
						<span>{health.wifi.connectedSSID}</span>
					</div>
				{/if}
				{#if health.relayDomain}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Relay</span>
						<span class="truncate">{health.relayDomain}</span>
					</div>
				{/if}
				{#if health.uptimeSeconds !== undefined}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Uptime</span>
						<span>{Math.floor(health.uptimeSeconds / 3600)}h {Math.floor((health.uptimeSeconds % 3600) / 60)}m</span>
					</div>
				{/if}
			</div>
		</div>

		<div class="space-y-4 border p-4">
			<Label class="text-base">Product</Label>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Model</span>
					<span>{model || "N/A"}</span>
				</div>
				<div class="flex justify-between gap-4">
					<span class="text-muted-foreground">ID</span>
					<span class="text-end select-text text-xs leading-5">{productId || "N/A"}</span>
				</div>
			</div>
		</div>

		{#if health.logs && health.logs.length > 0}
			<div class="space-y-4 border p-4">
				<Label class="text-base">Logs</Label>
				<div class="relative h-60 overflow-hidden border bg-muted text-xs">
					<div
						bind:this={logsContainer}
						class="of-top of-bottom of-length-2 h-full w-full overflow-x-hidden overflow-y-auto p-4 wrap-break-word"
					>
						{#each health.logs as log, i}
							<div class:bg-border={i === highlightedLogIndex} class="select-text">
								<span class="text-muted-foreground select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
								{log.msg}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		{#if health.metrics?.length > 0}
			<div class="space-y-4 border p-4">
				<Label class="text-base">Performance</Label>
				<MetricsChart metrics={health.metrics} bind:hoveredTimestamp />
			</div>
		{/if}
	{:else if loading.is("health")}
		<div class="space-y-6">
			<div class="h-40 animate-shimmer border"></div>
			<div class="h-25 animate-shimmer border"></div>
			<div class="h-75 animate-shimmer border"></div>
			<div class="h-60 animate-shimmer border"></div>
		</div>
	{:else}
		<div class="border p-8 text-center text-sm text-muted-foreground">No health data available.</div>
	{/if}
</div>

<AlertDialog.Root bind:open={devDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Switch to dev version?</AlertDialog.Title>
			<AlertDialog.Description
				>This sets the firmware version to dev and checks for updates. This allows for installing in-dev updates.</AlertDialog.Description
			>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={loading.is("setVersionDev")}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action disabled={loading.is("setVersionDev")} onclick={setVersionDev}>
				{#if loading.is("setVersionDev")}<Spinner />{/if}
				Yes, switch
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={updateDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Install update?</AlertDialog.Title>
			<AlertDialog.Description
				>Do not unplug or otherwise turn off the product until the update is completed.</AlertDialog.Description
			>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={loading.is("update")}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action disabled={loading.is("update")} onclick={startUpdate}>
				{#if loading.is("update")}<Spinner />{/if}
				Update
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
