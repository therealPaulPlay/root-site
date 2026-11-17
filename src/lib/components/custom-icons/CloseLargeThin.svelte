<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon {...props}>
	<path d="M3.5 3.5 20.5 20.5M20.5 3.5 3.5 20.5" />
</CustomIcon>
