<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon stroke-linejoin="round" {...props}>
	<path d="M18 9V3H4V19H13" />
	<rect x="13" y="9" width="8" height="12" />
</CustomIcon>
