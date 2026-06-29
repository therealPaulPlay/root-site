<script>
	import { Drawer as DrawerPrimitive } from "@paulplay/vaul-svelte";

	let { ...restProps } = $props();
</script>

<DrawerPrimitive.Portal {...restProps} />