<script>
	import { RiRefreshLine } from "svelte-remixicon";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { vibrate } from "$lib/utils/haptics";
	import { on } from "svelte/events";
	import { slide } from "svelte/transition";

	let { onRefresh, disabled = false, class: className = "", children } = $props();

	const THRESHOLD = 80;
	
	let pull = $state(0);
	let refreshing = $state(false);
	let scrollEl = $state();
	let pulling = false;
	let touchStartY = 0;
	let releaseTimer;
	let lastWheelTime = 0;

	function release() {
		clearTimeout(releaseTimer);
		if (pull >= THRESHOLD && !refreshing) {
			refreshing = true;
			vibrate.medium();
			onRefresh?.();
			setTimeout(() => { refreshing = false; pull = 0; }, 500);
		} else if (!refreshing) pull = 0;
		pulling = false;
	}

	$effect(() => {
		if (!scrollEl) return;
		return on(scrollEl, "touchmove", (e) => {
			if (disabled || refreshing) return;
			if (pulling) e.preventDefault();
			if (scrollEl.scrollTop > 0 || window.scrollY > 0) { pull = 0; pulling = false; return; }
			const delta = e.touches[0].clientY - touchStartY;
			if (delta <= 0) { pull = 0; return; }
			e.preventDefault();
			pulling = true;
			pull = Math.min(THRESHOLD, delta * 0.4);
		}, { passive: false });
	});

	const progress = $derived(pull / THRESHOLD);
</script>

<div class="flex h-full w-full flex-col overflow-hidden"
	ontouchstart={(e) => {
		if (disabled || refreshing || scrollEl?.scrollTop > 0 || window.scrollY > 0) return;
		touchStartY = e.touches[0].clientY;
	}}
	ontouchend={release}
	ontouchcancel={() => { pulling = false; pull = 0; }}
	onwheel={(e) => {
		const now = Date.now();
		const gap = now - lastWheelTime;
		lastWheelTime = now;

		if (disabled || refreshing) return;
		if (scrollEl?.scrollTop > 0 || window.scrollY > 0) { pull = 0; pulling = false; return; }

		// Only start pulling after a 100ms gap in wheel events (filters out momentum)
		if (!pulling && gap < 100) return;

		if (e.deltaY < 0) {
			e.preventDefault();
			pulling = true;
			pull = Math.min(THRESHOLD, pull + Math.abs(e.deltaY) * 0.15);
			if (pull >= THRESHOLD) { release(); return; }
		} else if (pull > 0) {
			e.preventDefault();
			pull = Math.max(0, pull - Math.abs(e.deltaY) * 0.15);
			if (pull <= 0) pulling = false;
		}

		clearTimeout(releaseTimer);
		releaseTimer = setTimeout(release, 150);
	}}
>
	{#if pull > 0}
		<div class="flex w-full shrink-0 items-center justify-center border-b pb-px bg-accent overflow-hidden"
			style="height: {pull}px" out:slide={{ duration: 300 }}>
			{#if refreshing}
				<Spinner class="size-5" />
			{:else}
				<RiRefreshLine class="size-5 text-accent-foreground"
					style="opacity: {progress}; transform: rotate({progress * 180}deg);" />
			{/if}
		</div>
	{/if}
	<div class="min-h-0 flex-1 overflow-y-auto {className}" bind:this={scrollEl}>
		{@render children?.()}
	</div>
</div>
