<script>
	import "../app.css";
	import { onMount } from "svelte";
	import init from "overfade";
	import Navbar from "$lib/components/Navbar.svelte";
	import Footer from "$lib/components/Footer.svelte";

	let { children } = $props();

	onMount(init);
</script>

<svelte:head>
	<link rel="icon" href="/images/icons/favicon.svg" />
	<link rel="apple-touch-icon" sizes="180x180" href="/images/icons/apple-touch-icon.png" />
	<link rel="manifest" href="/images/site.webmanifest" />
	<meta
		name="description"
		content="Privacy-first smart home cameras. Root devices use on-device ML models and never transfer unencrypted data."
	/>
</svelte:head>

<main class="relative container mx-auto flex min-h-screen">
	<Navbar />
	<article class="no-scrollbar w-full overflow-x-hidden sm:border-x relative">
		{@render children?.()}
		<Footer />
	</article>
</main>
