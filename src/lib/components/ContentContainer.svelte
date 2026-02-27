<script>
	let { children } = $props();
</script>

<div class="p-6 lg:p-8 space-y-8 w-3xl mx-auto pb-18! [&_p]:text-pretty lg:[&_p]:text-justify max-w-full">
	{@render children?.()}
</div>
