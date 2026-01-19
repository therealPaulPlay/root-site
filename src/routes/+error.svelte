<script>
	import { page } from "$app/state";
</script>

<svelte:head>
	<title>Error</title>
</svelte:head>

<div class="h-svh text-center content-center">
	<p>{page.status} ({page.error.message}).</p>
	<p>Beep. Bop.</p>
</div>
