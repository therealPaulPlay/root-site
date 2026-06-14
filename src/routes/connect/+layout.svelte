<script>
	import LogCollector from "$lib/components/LogCollector.svelte";

	let { children } = $props();
</script>

{@render children?.()}

<LogCollector />
