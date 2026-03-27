<script>
	import { page } from "$app/state";
</script>

<svelte:head>
	<title>Error</title>
</svelte:head>

<div class="safe-h-svh content-center text-center">
	<p>{page.status} ({page.error.message}).</p>
	<p>Beep. Bop.</p>
</div>
