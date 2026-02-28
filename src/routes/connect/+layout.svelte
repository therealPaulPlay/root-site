<script>
	import { ModeWatcher } from "mode-watcher";
	import { onDestroy } from "svelte";
	import { browser } from "$app/environment";

	let { children } = $props();

	// Force light mode visually when leaving /connect, without overwriting the user's preference
	onDestroy(() => {
		if (browser) {
			document.documentElement.classList.remove("dark");
			document.documentElement.style.colorScheme = "light";
		}
	});
</script>

<ModeWatcher defaultMode="system" />

{@render children?.()}
