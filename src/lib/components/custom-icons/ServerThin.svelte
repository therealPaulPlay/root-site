<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon stroke-linejoin="round" {...props}>
	<rect x="4" y="4" width="16" height="16" />
	<path d="M4 12H20M7 8H10M7 16H10" />
</CustomIcon>
