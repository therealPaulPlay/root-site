<script>
	import { RiDownload2Line, RiRefreshLine } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";

	let {
		health,
		healthLoading,
		updateStatus,
		updateStatusLoading,
		activeTab,
		healthTab = "",
		buttonsLoading = $bindable(),
		loadHealth = () => {},
		loadUpdateStatus = () => {},
		startUpdate = () => {}
	} = $props();

	let logsContainer = $state();

	$effect(() => {
		if (logsContainer && health?.logs?.length && activeTab === healthTab) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});
</script>

<div class="flex items-center justify-end">
	<Button
		onclick={() => {
			loadHealth();
			loadUpdateStatus();
		}}
		variant="outline"
		size="sm"
		disabled={healthLoading || updateStatusLoading}
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
					<span class="text-muted-foreground">Version</span>
					<span>{updateStatus.currentVersion}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Update status</span>
					<span>{updateStatus.status}</span>
				</div>
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
					<Button onclick={startUpdate} disabled={buttonsLoading.update} variant="outline">
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
		<div class="border p-8 text-center text-muted-foreground">No update status available.</div>
	{/if}

	{#if health}
		<div class="space-y-4 border p-4">
			<Label class="text-base">Network</Label>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">WiFi status</span>
					<span>{health.wifi.connected ? "Connected" : "Disconnected"}</span>
				</div>
				{#if health.wifi.ssid}
					<div class="flex justify-between">
						<span class="text-muted-foreground">SSID</span>
						<span>{health.wifi.ssid}</span>
					</div>
				{/if}
				<div class="flex justify-between">
					<span class="text-muted-foreground">Relay</span>
					<span class="truncate">{health.relayDomain}</span>
				</div>
			</div>
		</div>

		<div class="space-y-4 border p-4">
			<Label class="text-base">Performance</Label>
			<div class="space-y-2 text-sm">
				{#if health.performance.cpuUsagePercent !== undefined}
					<div class="flex justify-between">
						<span class="text-muted-foreground">CPU usage</span>
						<span>{health.performance.cpuUsagePercent.toFixed(1)}%</span>
					</div>
				{/if}
				{#if health.performance.cpuTempCelsius !== undefined}
					<div class="flex justify-between">
						<span class="text-muted-foreground">CPU temperature</span>
						<span>{health.performance.cpuTempCelsius.toFixed(1)}°C</span>
					</div>
				{/if}
				{#if health.performance.memoryUsagePercent !== undefined}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Memory usage</span>
						<span>{health.performance.memoryUsagePercent.toFixed(1)}%</span>
					</div>
				{/if}
				{#if health.performance.diskUsagePercent !== undefined}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Disk usage</span>
						<span>{health.performance.diskUsagePercent.toFixed(1)}%</span>
					</div>
				{/if}
				{#if health.performance.uptimeSeconds !== undefined}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Uptime</span>
						<span
							>{Math.floor(health.performance.uptimeSeconds / 3600)}h {Math.floor(
								(health.performance.uptimeSeconds % 3600) / 60
							)}m</span
						>
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
						{#each health.logs as log}
							<div><span class="text-muted-foreground">[{log.time}]</span> {log.msg}</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="border p-8 text-center text-muted-foreground">No health data available.</div>
	{/if}
</div>
