<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon stroke-linejoin="round" {...props}>
	<rect x="6" y="3" width="12" height="18" />
	<path d="M12 18h0" stroke-linecap="round" />
</CustomIcon>
