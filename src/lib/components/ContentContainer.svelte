<script>
	let { children } = $props();
</script>

<div class="mx-auto w-3xl max-w-full space-y-8 p-6 pb-18! lg:p-8 [&_p]:text-pretty lg:[&_p]:text-justify">
	{@render children?.()}
</div>
