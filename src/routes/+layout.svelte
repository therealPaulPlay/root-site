<script>
	import "../app.css";
	import { onMount } from "svelte";
	import init from "overfade";
	import Navbar from "$lib/components/navbar.svelte";
	import Footer from "$lib/components/Footer.svelte";

	let { children } = $props();

	onMount(init);
</script>

<svelte:head>
	<link rel="icon" href="/images/favicon.svg" />
</svelte:head>

<main class="relative container mx-auto flex min-h-screen">
	<Navbar />
	<article class="no-scrollbar w-full overflow-x-hidden sm:border-x">
		{@render children?.()}
		<Footer />
	</article>
</main>
