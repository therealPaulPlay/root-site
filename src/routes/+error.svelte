<script>
	import { page } from "$app/state";
</script>

<svelte:head>
	<title>Error</title>
</svelte:head>

<div class="flex h-full w-full flex-col items-center justify-center">
	<h1>{page.status} ({page.error.message}).</h1>
	<p>Beep. Bop.</p>
</div>
