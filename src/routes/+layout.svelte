<script>
	import Navbar from "$lib/components/navbar.svelte";
	import init from "overfade";
	import "../app.css";
	import { onMount } from "svelte";
	let { children } = $props();

	onMount(init);
</script>

<svelte:head>
	<link rel="icon" href="/images/favicon.svg" />
</svelte:head>

<main class="relative container mx-auto flex h-screen overflow-hidden">
	<Navbar />
	<article class="w-full ml-15 border-x overflow-auto no-scrollbar">
		{@render children?.()}
	</article>
</main>
