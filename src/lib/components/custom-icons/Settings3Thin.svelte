<script>
	import CustomIcon from "./CustomIcon.svelte";

	let props = $props();
</script>

<CustomIcon {...props}>
	<path
		d="M20.455 8.914A4 4 0 0 0 20.455 15.086A9 9 0 0 1 18.899 17.779A4 4 0 0 0 13.555 20.865A9 9 0 0 1 10.445 20.865A4 4 0 0 0 5.101 17.779A9 9 0 0 1 3.545 15.086A4 4 0 0 0 3.545 8.914A9 9 0 0 1 5.101 6.221A4 4 0 0 0 10.445 3.135A9 9 0 0 1 13.555 3.135A4 4 0 0 0 18.899 6.221A9 9 0 0 1 20.455 8.914Z"
	/>
	<circle cx="12" cy="12" r="2" />
</CustomIcon>
