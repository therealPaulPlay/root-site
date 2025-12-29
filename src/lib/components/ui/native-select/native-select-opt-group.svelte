<script>
	let { ref = $bindable(null), children, ...restProps } = $props();
</script>

<optgroup bind:this={ref} data-slot="native-select-opt-group" {...restProps}>
	{@render children?.()}
</optgroup>
