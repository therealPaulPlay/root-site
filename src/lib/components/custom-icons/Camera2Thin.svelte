<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon stroke-linejoin="round" {...props}>
	<rect x="3" y="4" width="18" height="16" />
	<circle cx="12" cy="12" r="4" />
	<path d="M18 7h0" stroke-linecap="square" />
</CustomIcon>
