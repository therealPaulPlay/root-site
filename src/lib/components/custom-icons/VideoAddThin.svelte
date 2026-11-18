<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon strokeWidth={1.45} stroke-linejoin="round" {...props}>
	<rect x="2" y="5" width="14" height="14" />
	<path d="M16 11.121 22 6.921V17.079L16 12.879" />
	<path d="M9 8V16M5 12H13" />
</CustomIcon>
