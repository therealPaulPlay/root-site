<script>
	import { collectedLogs } from "$lib/state/logs.svelte";
	import { onMount } from "svelte";

	onMount(() => {
		try {
			const originals = [console.log, console.error, console.warn, console.info];
			const keyStrings = ["log", "error", "warn", "info"];

			keyStrings.forEach((method, i) => {
				// Hijack the method, patch it to also collect the logs
				console[method] = function (...args) {
					// Call the original function (log it)
					originals[i].apply(console, args);

					// Capture and stringify the message
					const messages = args
						.map((a) => {
							if (a instanceof Error) return a.message;
							if (typeof a === "object" && a !== null)
								try {
									return JSON.stringify(a);
								} catch {}
							return String(a);
						})
						.join(" ");

					// Push log
					collectedLogs.push(`${method.slice(0, 1).toUpperCase() + method.slice(1)}: ${messages}`);

					// Truncate to 250, remove oldest and keep newest
					if (collectedLogs.length > 250) collectedLogs.splice(0, collectedLogs.length - 250);
				};
			});

			// When component unmounts, restore original console methods
			return () => originals.forEach((orig, i) => (console[keyStrings[i]] = orig));
		} catch (error) {
			console.error("Failed to set up console listeners:", error);
		}
	});
</script>
