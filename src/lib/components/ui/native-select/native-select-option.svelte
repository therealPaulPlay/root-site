<script>
	let { ref = $bindable(null), children, ...restProps } = $props();
</script>

<option bind:this={ref} data-slot="native-select-option" {...restProps}>
	{@render children?.()}
</option>
