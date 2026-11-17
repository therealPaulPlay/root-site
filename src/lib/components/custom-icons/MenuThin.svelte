<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon {...props}>
	<path d="M3 5H21M3 12H21M3 19H21" />
</CustomIcon>
