<script>
	import { RiDownload2Line, RiRefreshLine } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";
	import * as AlertDialog from "./ui/alert-dialog";
	import MetricsChart from "./MetricsChart.svelte";

	let {
		health,
		healthLoading,
		metrics = [],
		metricsLoading = false,
		model,
		updateStatus,
		updateStatusLoading,
		activeTab,
		healthTab = "",
		buttonsLoading = $bindable(),
		loadHealth = () => {},
		loadMetrics = () => {},
		loadUpdateStatus = () => {},
		startUpdate = () => {},
		setVersionDev = () => {}
	} = $props();

	let logsContainer = $state();
	let devDialogOpen = $state(false);
	let updateDialogOpen = $state(false);
	let hoveredTimestamp = $state(null);
	let initialScrollDone = $state(false);

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

	// Scroll to bottom on initial load
	$effect(() => {
		if (logsContainer && health?.logs?.length && activeTab === healthTab && !initialScrollDone) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
			initialScrollDone = true;
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
</script>

<div class="flex items-center justify-end">
	<Button
		onclick={() => {
			loadHealth();
			loadMetrics();
			loadUpdateStatus();
		}}
		variant="outline"
		size="sm"
		disabled={healthLoading || metricsLoading || updateStatusLoading}
	>
		Refresh
		{#if !healthLoading && !updateStatusLoading}
			<RiRefreshLine class="size-4" />
		{:else}
			<Spinner class="size-4" />
		{/if}
	</Button>
</div>

<div class="space-y-6">
	{#if updateStatus}
		<div class="space-y-4 border p-4">
			<Label class="text-base">Firmware</Label>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Model</span>
					<span>{model || "unknown"}</span>
				</div>
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
				{#if updateStatus.availableVersion}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Available</span>
						<span>{updateStatus.availableVersion}</span>
					</div>
				{/if}
				{#if updateStatus.error}
					<div class="border p-4 text-center text-muted-foreground">
						Error: {updateStatus.error}
					</div>
				{/if}
			</div>
			{#if updateStatus.availableVersion}
				<div class="flex w-full items-center justify-end">
					<Button
						onclick={() => (updateDialogOpen = true)}
						disabled={buttonsLoading.update || ["downloading", "installing"].includes(updateStatus.status)}
						variant="outline"
					>
						{#if buttonsLoading.update}
							<Spinner class="size-4" />
						{:else}
							Install update
							<RiDownload2Line class="size-4" />
						{/if}
					</Button>
				</div>
			{/if}
		</div>
	{:else}
		<div class="border p-8 text-center text-sm text-muted-foreground">No update status available.</div>
	{/if}

	{#if health}
		<div class="space-y-4 border p-4">
			<Label class="text-base">Network</Label>
			<div class="space-y-2 text-sm">
				{#if health.wifi.connected !== undefined}
					<div class="flex justify-between">
						<span class="text-muted-foreground">WiFi status</span>
						<span>{health.wifi.connected ? "connected" : "disconnected"}</span>
					</div>
				{/if}
				{#if health.wifi.ssid}
					<div class="flex justify-between">
						<span class="text-muted-foreground">SSID</span>
						<span>{health.wifi.ssid}</span>
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

		{#if health.logs && health.logs.length > 0}
			<div class="space-y-4 border p-4">
				<Label class="text-base">Logs</Label>
				<div class="relative h-60 overflow-hidden border bg-muted text-xs">
					<div
						bind:this={logsContainer}
						class="of-top of-bottom of-length-2 h-full w-full overflow-x-hidden overflow-y-auto p-4 break-all"
					>
						{#each health.logs as log, i}
							<div class:bg-border={i === highlightedLogIndex}>
								<span class="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
								{log.msg}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="border p-8 text-center text-sm text-muted-foreground">No health data available.</div>
	{/if}

	<div class="space-y-4 border p-4">
		<Label class="text-base">Performance</Label>
		{#if metrics.length > 0}
			<MetricsChart {metrics} bind:hoveredTimestamp />
		{:else}
			<div class="border p-8 text-center text-sm text-muted-foreground">No metrics available.</div>
		{/if}
	</div>
</div>

<AlertDialog.Root bind:open={devDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Switch to dev version?</AlertDialog.Title>
			<AlertDialog.Description
				>This sets the firmware version to dev and checks for updates. Currently, this does not install a different
				firmware, it just allows for re-installing the same firmware.</AlertDialog.Description
			>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={() => {
					devDialogOpen = false;
					setVersionDev();
				}}>Yes, switch</AlertDialog.Action
			>
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
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={() => {
					updateDialogOpen = false;
					startUpdate();
				}}>Update</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
