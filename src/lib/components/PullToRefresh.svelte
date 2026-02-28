<script>
	import { RiRefreshLine } from "svelte-remixicon";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { vibrate } from "$lib/utils/haptics";
	import { on } from "svelte/events";
	import { slide } from "svelte/transition";

	let { onRefresh, disabled = false, class: className = "", children } = $props();

	const THRESHOLD = 80;
	const DAMPEN = 0.6;
	const MOMENTUM_GAP = 100;

	let pull = $state(0);
	let refreshing = $state(false);
	let scrollEl = $state();
	let pulling = $state(false);
	let blockTopOverscroll = $state(false);

	// Input tracking
	let touchStartY = 0;
	let touchScrollSnapshot = 0;
	let touchReachedTopAt = 0;
	let prevWheelEventAt = 0;
	let releaseTimer;

	const progress = $derived(pull / THRESHOLD);

	function updateOverscrollBlock() {
		if (!scrollEl) return;
		const overflows = scrollEl.scrollHeight > scrollEl.clientHeight;
		blockTopOverscroll = overflows && scrollEl.scrollTop <= 0 && window.scrollY <= 0;
	}

	function release() {
		clearTimeout(releaseTimer);
		if (pull >= THRESHOLD && !refreshing) {
			refreshing = true;
			vibrate.medium();
			onRefresh?.();
			setTimeout(() => {
				refreshing = false;
				pull = 0;
			}, 500);
		} else if (!refreshing) pull = 0;
		pulling = false;
	}

	// Returns true if pulling should be skipped (shared guard for touch + wheel)
	function shouldSkip(isMomentum) {
		if (disabled || refreshing) return true;
		if (scrollEl.scrollTop > 0 || window.scrollY > 0) {
			pulling = false;
			return true;
		}
		return !pulling && isMomentum;
	}

	// Touch handling — needs non-passive listener for preventDefault
	$effect(() => {
		if (!scrollEl) return;
		return on(
			scrollEl,
			"touchmove",
			(e) => {
				const touchY = e.touches[0].clientY;

				if (pulling && e.cancelable) e.preventDefault();

				// Shrink pull indicator gradually while scrolled
				if (pull > 0 && (scrollEl.scrollTop > 0 || window.scrollY > 0)) {
					const scrollDelta = scrollEl.scrollTop - touchScrollSnapshot;
					pull = Math.max(0, pull - Math.max(0, scrollDelta) * DAMPEN);
				}

				const wasScrolled = scrollEl.scrollTop > 0 || window.scrollY > 0;
				if (wasScrolled) touchReachedTopAt = Date.now();
				touchScrollSnapshot = scrollEl.scrollTop;
				if (shouldSkip(Date.now() - touchReachedTopAt < MOMENTUM_GAP)) {
					touchStartY = touchY;
					return;
				}

				const delta = touchY - touchStartY;
				if (delta <= 0) {
					pull = 0;
					touchStartY = touchY;
					return;
				}
				if (e.cancelable) e.preventDefault();
				pulling = true;
				pull = Math.min(THRESHOLD, delta * DAMPEN);
			},
			{ passive: false }
		);
	});

	function onTouchStart(e) {
		if (disabled || refreshing || scrollEl?.scrollTop > 0 || window.scrollY > 0) return;
		touchStartY = e.touches[0].clientY;
		updateOverscrollBlock();
	}

	// Wheel/trackpad handling — incremental deltas
	function onWheel(e) {
		const gap = Date.now() - prevWheelEventAt;
		prevWheelEventAt = Date.now();
		if (shouldSkip(gap < MOMENTUM_GAP)) return;

		if (e.deltaY < 0) {
			e.preventDefault();
			pulling = true;
			pull = Math.min(THRESHOLD, pull + Math.abs(e.deltaY) * 0.15);
			if (pull >= THRESHOLD) {
				release();
				return;
			}
		} else if (pull > 0) {
			e.preventDefault();
			pull = Math.max(0, pull - Math.abs(e.deltaY) * 0.15);
			if (pull <= 0) pulling = false;
		}

		clearTimeout(releaseTimer);
		releaseTimer = setTimeout(release, 150);
	}

	// Re-evaluate overscroll block when element or content resizes
	$effect(() => {
		if (!scrollEl) return;
		const observer = new ResizeObserver(() => updateOverscrollBlock());
		observer.observe(scrollEl);
		for (const child of scrollEl.children) observer.observe(child);
		return () => observer.disconnect();
	});
</script>

<div
	class="flex h-full w-full flex-col overflow-hidden"
	ontouchstart={onTouchStart}
	ontouchend={release}
	ontouchcancel={() => {
		pulling = false;
		pull = 0;
	}}
	onwheel={onWheel}
>
	{#if pull > 0}
		<div
			class="flex w-full shrink-0 items-center justify-center overflow-hidden border-b pb-px"
			style="height: {pull}px"
			out:slide={{ duration: 300 }}
		>
			{#if refreshing}
				<Spinner class="size-5" />
			{:else}
				<RiRefreshLine
					class="size-5 text-accent-foreground"
					style="opacity: {progress}; transform: rotate({progress * 180}deg);"
				/>
			{/if}
		</div>
	{/if}
	<div
		class="min-h-0 flex-1 overflow-y-auto {className}"
		bind:this={scrollEl}
		style="overscroll-behavior-y: {blockTopOverscroll ? 'none' : 'auto'}"
		onscroll={updateOverscrollBlock}
	>
		{@render children?.()}
	</div>
</div>
