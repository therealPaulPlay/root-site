<script>
	let { size = "1em", color = "currentColor", label = "", strokeWidth = 1.5, children, ...rest } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	{color}
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-miterlimit="10"
	aria-label={label || undefined}
	aria-hidden={label ? undefined : "true"}
	role={label ? "img" : undefined}
	{...rest}
>
	{@render children()}
</svg>
