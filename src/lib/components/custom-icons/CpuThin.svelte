<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon stroke-linejoin="round" {...props}>
	<rect x="5" y="5" width="14" height="14" />
	<rect x="8" y="8" width="8" height="8" fill="currentColor" stroke="none" />
	<path d="M9 2V5M15 2V5M9 19V22M15 19V22M2 9H5M2 15H5M19 9H22M19 15H22" />
</CustomIcon>
