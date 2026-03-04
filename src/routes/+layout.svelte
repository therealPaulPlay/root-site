<script>
	import "../app.css";
	import { onDestroy, onMount } from "svelte";
	import { Capacitor } from "@capacitor/core";
	import init from "overfade";
	import Navbar from "$lib/components/Navbar.svelte";
	import Footer from "$lib/components/Footer.svelte";
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import { initializeBackGestureHandler, removeBackGestureHandler } from "$lib/utils/backGesture";
	import { browser } from "$app/environment";

	let { children } = $props();
	let isNative = Capacitor.isNativePlatform();
	let isIframed = browser && window.self !== window.top;
	if (isIframed) document.documentElement.style.setProperty("--safe-area-top", "0px");
	if (isNative && browser) document.documentElement.classList.add("native");

	onMount(init); // Overfade
	onMount(initializeBackGestureHandler); // Back gesture support for going back
	onDestroy(removeBackGestureHandler);
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

{#if isNative && !isIframed}
	<div class="border-b" style="height: var(--safe-area-top)"></div>
{/if}

<Toaster
	position="top-right"
	offset={{ top: "calc(var(--safe-area-top) + 1rem)" }}
	mobileOffset={{ top: "calc(var(--safe-area-top) + 1rem)" }}
/>

<main class="items-start-safe relative container mx-auto flex">
	<Navbar />
	<article class="no-scrollbar safe-min-h-svh relative flex w-full flex-col overflow-x-hidden sm:border-x">
		{@render children?.()}
		<Footer />
	</article>
</main>
