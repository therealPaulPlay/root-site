<script>
	import Navbar from "$lib/components/navbar.svelte";
	import init from "overfade";
	import "../app.css";
	import { onMount } from "svelte";
	import Footer from "$lib/components/Footer.svelte";
	let { children } = $props();

	onMount(init);
</script>

<svelte:head>
	<link rel="icon" href="/images/favicon.svg" />
</svelte:head>

<main class="relative container mx-auto flex h-screen overflow-hidden">
	<Navbar />
	<article class="no-scrollbar ml-15 w-full overflow-auto border-x">
		{@render children?.()}
		<Footer />
	</article>
</main>
