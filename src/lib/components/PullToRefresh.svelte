<script>
	import { RiArrowUpLine, RiRefreshLine } from "svelte-remixicon";
	import Spinner from "./ui/spinner/spinner.svelte";
	import { vibrate } from "$lib/utils/haptics";
	import { on } from "svelte/events";
	import { Tween } from "svelte/motion";

	let { onRefresh, disabled = false, class: className = "", scrollEl = $bindable(), children } = $props();

	const THRESHOLD = 80;
	const DAMPEN = 0.6;
	const MOMENTUM_GAP = 100;

	let pull = new Tween(0, { duration: 150 });
	let refreshing = $state(false);
	let done = $state(false);
	let pulling = $state(false);
	let blockTopOverscroll = $state(false);

	// Input tracking
	let touchStartY = 0;
	let touchStartX = 0;
	let touchDirectionLocked = false;
	let touchIsHorizontal = false;
	let touchScrollSnapshot = 0;
	let touchReachedTopAt = 0;
	let prevWheelEventAt = 0;
	let releaseTimer;

	const progress = $derived(pull.current / THRESHOLD);

	// Reset done state after retraction tween completes
	$effect(() => {
		if (done && pull.current === 0) done = false;
	});

	function release() {
		clearTimeout(releaseTimer);
		if (pull.current >= THRESHOLD && !refreshing) {
			refreshing = true;
			vibrate.medium();
			const result = onRefresh?.();
			const finish = () => {
				refreshing = false;
				done = true;
				pull.target = 0;
			};
			if (result && typeof result.then === "function") {
				const minDelay = new Promise((r) => setTimeout(r, 500));
				Promise.all([result, minDelay]).finally(finish);
			} else setTimeout(finish, 500);
		} else if (!refreshing) pull.target = 0;
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
				const touchX = e.touches[0].clientX;

				// Lock direction after enough movement to distinguish horizontal vs vertical
				if (!touchDirectionLocked) {
					const dx = Math.abs(touchX - touchStartX);
					const dy = Math.abs(touchY - touchStartY);
					if (dx > 5 || dy > 5) {
						touchDirectionLocked = true;
						touchIsHorizontal = dx > dy;
					}
				}
				if (touchIsHorizontal) return; // Let horizontal swipes pass through (Swipe-back gesture)

				if (pulling && e.cancelable) e.preventDefault();

				// Shrink pull indicator gradually while scrolled
				if (pull.current > 0 && (scrollEl.scrollTop > 0 || window.scrollY > 0)) {
					const scrollDelta = scrollEl.scrollTop - touchScrollSnapshot;
					pull.set(Math.max(0, pull.current - Math.max(0, scrollDelta) * DAMPEN), { duration: 0 });
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
					pull.set(0, { duration: 0 });
					touchStartY = touchY;
					return;
				}
				if (e.cancelable) e.preventDefault();
				pulling = true;
				pull.set(Math.min(THRESHOLD, delta * DAMPEN), { duration: 0 });
			},
			{ passive: false }
		);
	});

	function onTouchStart(e) {
		if (disabled || refreshing || scrollEl?.scrollTop > 0 || window.scrollY > 0) return;
		touchStartY = e.touches[0].clientY;
		touchStartX = e.touches[0].clientX;
		touchDirectionLocked = false;
		touchIsHorizontal = false;
	}

	// Wheel/trackpad handling — incremental deltas
	function onWheel(e) {
		const gap = Date.now() - prevWheelEventAt;
		prevWheelEventAt = Date.now();
		if (shouldSkip(gap < MOMENTUM_GAP)) return;

		if (e.deltaY < 0) {
			e.preventDefault();
			pulling = true;
			pull.set(Math.min(THRESHOLD, pull.current + Math.abs(e.deltaY) * 0.15), { duration: 0 });
			if (pull.current >= THRESHOLD) {
				release();
				return;
			}
		} else if (pull.current > 0) {
			e.preventDefault();
			pull.set(Math.max(0, pull.current - Math.abs(e.deltaY) * 0.15), { duration: 0 });
			if (pull.current <= 0) pulling = false;
		}

		clearTimeout(releaseTimer);
		releaseTimer = setTimeout(release, 150);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-full w-full flex-col overflow-hidden"
	ontouchstart={onTouchStart}
	ontouchend={release}
	ontouchcancel={() => {
		pulling = false;
		pull.set(0, { duration: 0 });
	}}
	onwheel={onWheel}
>
	{#if pull.current > 0}
		<div
			class="flex w-full shrink-0 items-center justify-center overflow-hidden border-b pb-px"
			style="height: {pull.current}px"
		>
			{#if refreshing}
				<Spinner class="size-5" />
			{:else if done}
				<RiArrowUpLine class="size-5 text-accent-foreground" style="opacity: {progress};" />
			{:else}
				<RiRefreshLine
					class="size-5 text-accent-foreground"
					style="opacity: {progress}; transform: rotate({progress * 180}deg);"
				/>
			{/if}
		</div>
	{/if}
	<div class="min-h-0 flex-1 overflow-y-auto {className}" bind:this={scrollEl}>
		{@render children?.()}
	</div>
</div>
