<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon {...props}>
	<circle cx="12" cy="12" r="9" />
	<path d="M12 7V13H17" />
</CustomIcon>
