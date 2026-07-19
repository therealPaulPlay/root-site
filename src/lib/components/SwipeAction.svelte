<script module>
	import { SvelteSet } from "svelte/reactivity";
	const openInstances = new SvelteSet();
</script>

<script>
	import { onDestroy } from "svelte";

	let { actions, children, threshold = 40, class: className = "" } = $props();

	let actionsWidth = $state(0);
	let offset = $state(0);
	let startX = null;
	let startY = null;
	let startOffset = 0;
	let dragging = $state(false);
	let didMove = false;

	const self = { close: () => (offset = 0) };
	onDestroy(() => openInstances.delete(self));

	function closeOthers() {
		for (const instance of openInstances) {
			if (instance !== self) instance.close();
		}
		openInstances.clear();
		openInstances.add(self);
	}

	function onPointerDown(e) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		startX = e.clientX;
		startY = e.clientY;
		startOffset = offset;
		dragging = true;
		didMove = false;
	}

	function onPointerMove(e) {
		if (!dragging || startX == null) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!didMove) {
			if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
			if (Math.abs(dx) <= Math.abs(dy)) {
				dragging = false;
				return;
			}
			didMove = true;
			startX = e.clientX;
			closeOthers();
			e.currentTarget.setPointerCapture(e.pointerId);
			return;
		}
		offset = Math.max(-actionsWidth, Math.min(0, startOffset + dx));
	}

	function onPointerEnd() {
		if (!dragging) return;
		offset = offset < -threshold ? -actionsWidth : 0;
		if (offset < 0) openInstances.add(self);
		else openInstances.delete(self);
		dragging = false;
		startX = null;
	}

	function captureClicks(node) {
		function handler(e) {
			if (didMove) {
				e.stopPropagation();
				e.preventDefault();
				didMove = false;
			}
		}
		node.addEventListener("click", handler, true);
		return () => node.removeEventListener("click", handler, true);
	}
</script>

<div class="relative overflow-hidden {className}">
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="absolute inset-y-0 right-0 flex"
		bind:offsetWidth={actionsWidth}
		onclick={() => {
			offset = 0;
			openInstances.delete(self);
		}}
	>
		{@render actions()}
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative touch-pan-y bg-background"
		class:border-r={offset < 0}
		style:transform="translateX({offset}px)"
		style:transition={dragging ? "none" : "transform 150ms ease-out"}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerEnd}
		onpointercancel={onPointerEnd}
		{@attach captureClicks}
	>
		{@render children()}
	</div>
</div>