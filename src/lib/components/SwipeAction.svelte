<script module>
	import { SvelteSet } from "svelte/reactivity";
	const openInstances = new SvelteSet();
</script>

<script>
	import { onDestroy } from "svelte";

	let { icon: Icon, onclick, children, actionWidth = 80, threshold = 40, class: className = "", ariaLabel = "Info" } = $props();

	let offset = $state(0);
	let startX = null;
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
		startOffset = offset;
		dragging = true;
		didMove = false;
		e.currentTarget.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e) {
		if (!dragging || startX == null) return;
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 5) {
			if (!didMove) closeOthers();
			didMove = true;
		}
		offset = Math.max(-actionWidth, Math.min(0, startOffset + dx));
	}

	function onPointerEnd() {
		if (!dragging) return;
		offset = offset < -threshold ? -actionWidth : 0;
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
	<button
		class="absolute inset-y-0 right-0 flex items-center justify-center hover:bg-accent active:bg-accent"
		style:width="{actionWidth}px"
		aria-label={ariaLabel}
		onclick={() => {
			onclick?.();
			offset = 0;
			openInstances.delete(self);
		}}
	>
		<Icon class="size-4" />
	</button>
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