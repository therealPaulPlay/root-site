<script>
	import { Drawer as DrawerPrimitive } from "@paulplay/vaul-svelte";

	let { ref = $bindable(null), ...restProps } = $props();
</script>

<DrawerPrimitive.Close bind:ref data-slot="drawer-close" {...restProps} />