<script>
	import { page } from "$app/state";
</script>

<svelte:head>
	<title>Error</title>
</svelte:head>

<div class="flex h-screen w-full flex-col items-center justify-center">
	<p>{page.status} ({page.error.message}).</p>
	<p>Beep. Bop.</p>
</div>
