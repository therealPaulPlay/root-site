<script>
	import Label from "./ui/label/label.svelte";

	let { metrics = [], hoveredTimestamp = $bindable(null) } = $props();

	const series = [
		{ label: "CPU", key: "cpu", unit: "%", color: "var(--chart-1)", max: 100 },
		{ label: "Mem", key: "mem", unit: "%", color: "var(--chart-2)", max: 100 },
		{ label: "Temp", key: "temp", unit: "°C", color: "var(--chart-5)", max: 100 },
		{ label: "Disk", key: "disk", unit: "%", color: "var(--chart-3)", max: 100 }
	];

	let enabledKeys = $state(new Set(["cpu", "mem", "temp", "disk"]));
	let containerWidth = $state(400);
	let containerEl = $state();

	const chartHeight = 160;
	const padding = { top: 8, bottom: 16, left: 32, right: 8 };
	const plotWidth = $derived(containerWidth - padding.left - padding.right);
	const plotHeight = chartHeight - padding.top - padding.bottom;

	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => (containerWidth = entries[0].contentRect.width));
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	const timeRange = $derived.by(() => {
		if (metrics.length === 0) return { min: 0, max: 1 };
		return { min: new Date(metrics[0].t).getTime(), max: new Date(metrics.at(-1).t).getTime() };
	});

	const hoveredPoint = $derived.by(() => {
		if (!hoveredTimestamp || !metrics.length) return null;
		return metrics.reduce((best, point) => {
			const dist = Math.abs(new Date(point.t).getTime() - hoveredTimestamp);
			return dist < Math.abs(new Date(best.t).getTime() - hoveredTimestamp) ? point : best;
		});
	});

	function xScale(timestamp) {
		const range = timeRange.max - timeRange.min || 1;
		return padding.left + ((timestamp - timeRange.min) / range) * plotWidth;
	}

	function yScale(value, maxVal) {
		return padding.top + plotHeight - (Math.max(0, Math.min(value, maxVal)) / maxVal) * plotHeight;
	}

	function buildPolyline(seriesItem) {
		return metrics
			.map((p) => `${xScale(new Date(p.t).getTime())},${yScale(p[seriesItem.key] || 0, seriesItem.max)}`)
			.join(" ");
	}

	function handlePointerMove(e) {
		if (!metrics.length) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const svgX = ((e.clientX - rect.left) * containerWidth) / rect.width;
		const ratio = Math.max(0, Math.min(1, (svgX - padding.left) / plotWidth));
		hoveredTimestamp = timeRange.min + ratio * (timeRange.max - timeRange.min || 1);
	}

	function handlePointerLeave() {
		hoveredTimestamp = null;
	}

	function toggleSeries(key) {
		if (enabledKeys.has(key)) {
			if (enabledKeys.size > 1) enabledKeys.delete(key);
		} else enabledKeys.add(key);
		enabledKeys = new Set(enabledKeys);
	}

	function formatTime(timestamp) {
		return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
	}
</script>

<div bind:this={containerEl} class="w-full">
	<!-- Labels -->
	<div class="of-left of-right no-scrollbar mb-2 flex gap-x-3 overflow-x-auto text-xs">
		{#each series as s}
			<button
				class="flex shrink-0 items-center gap-1"
				style:opacity={enabledKeys.has(s.key) ? 1 : 0.35}
				onclick={() => toggleSeries(s.key)}
			>
				<span class="inline-block size-2" style="background: {s.color}"></span>
				<Label>{s.label}</Label>
				{#if hoveredPoint && enabledKeys.has(s.key)}
					<Label class="text-muted-foreground tabular-nums">{(hoveredPoint[s.key] || 0).toFixed(1)}{s.unit}</Label>
				{/if}
			</button>
		{/each}
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svg
		width={containerWidth}
		height={chartHeight}
		viewBox="0 0 {containerWidth} {chartHeight}"
		class="touch-pan-y select-none"
		onpointermove={handlePointerMove}
		onpointerleave={handlePointerLeave}
	>
		{#each [25, 50, 75] as gridVal}
			{@const gridY = yScale(gridVal, 100) + 0.5}
			<line
				x1={padding.left}
				y1={gridY}
				x2={containerWidth - padding.right}
				y2={gridY}
				stroke="var(--border)"
				stroke-width="1"
			/>
			<text x={padding.left - 4} y={gridY + 3} text-anchor="end" fill="var(--muted-foreground)" font-size="12"
				>{gridVal}</text
			>
		{/each}

		<line
			x1={padding.left}
			y1={padding.top + plotHeight + 0.5}
			x2={containerWidth - padding.right}
			y2={padding.top + plotHeight + 0.5}
			stroke="var(--border)"
			stroke-width="1"
		/>

		{#if metrics.length > 1}
			{#each series as s}
				{#if enabledKeys.has(s.key)}
					<polyline points={buildPolyline(s)} fill="none" stroke={s.color} stroke-width="1" />
				{/if}
			{/each}
		{/if}

		{#if hoveredTimestamp}
			{@const hoverX = Math.round(xScale(hoveredTimestamp)) + 0.5}
			{#if hoverX >= padding.left && hoverX <= containerWidth - padding.right}
				<line
					x1={hoverX}
					y1={padding.top}
					x2={hoverX}
					y2={padding.top + plotHeight}
					stroke="var(--border)"
					stroke-width="1"
				/>
			{/if}
		{/if}

		{#if metrics.length > 1}
			<text x={padding.left} y={chartHeight - 2} text-anchor="start" fill="var(--muted-foreground)" font-size="12">
				{formatTime(timeRange.min)}
			</text>
			<text
				x={containerWidth - padding.right}
				y={chartHeight - 2}
				text-anchor="end"
				fill="var(--muted-foreground)"
				font-size="12"
			>
				{formatTime(timeRange.max)}
			</text>
		{/if}
	</svg>

	<Label class="mt-1 text-muted-foreground block text-center">
		{hoveredTimestamp ? formatTime(hoveredTimestamp) : "\u00A0"}
	</Label>
</div>
