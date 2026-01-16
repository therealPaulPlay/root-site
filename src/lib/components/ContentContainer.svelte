<script>
	let { children } = $props();
</script>

<div class="p-6 lg:p-8 space-y-4">
	{@render children?.()}
</div>
