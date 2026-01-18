<script>
	let { children } = $props();
</script>

<div class="p-6 lg:p-8 space-y-8 max-w-3xl pb-18!">
	{@render children?.()}
</div>
