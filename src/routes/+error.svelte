<script>
	import { page } from "$app/state";
</script>

<svelte:head>
	<title>Error</title>
</svelte:head>

<div class="w-full h-full flex justify-center items-center flex-col">
	<h1>{page.status} ({page.error.message}).</h1>
	<p>Beep. Bop.</p>
</div>
