<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
	const id = $props.id();
</script>

<CustomIcon {...props}>
	<clipPath id="{id}-a"><rect y="10" width="24" height="11" /></clipPath>
	<clipPath id="{id}-b"><rect y="8" width="24" height="16" /></clipPath>
	<path d="M9 2V5M2 5H16M13.31 4.954 12.971 6.001C11.541 10.415 7.37 14.914 2.531 16.309" />
	<path clip-path="url(#{id}-b)" d="M5.411 6.899 5.887 8C7.157 10.936 10.714 14.168 12.372 14.947" />
	<path clip-path="url(#{id}-a)" d="M12.778 22 17.5 10.194 22.223 22M14.778 17H20.223" />
</CustomIcon>
