<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon stroke-linejoin="round" {...props}>
	<rect x="3" y="4" width="18" height="13" />
	<path d="M12 17V21M7 21H17" stroke-linejoin="miter" />
</CustomIcon>
