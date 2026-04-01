<script>
	import "../app.css";
	import "$lib/utils/theme.svelte.js";
	import { onDestroy, onMount } from "svelte";
	import { Capacitor } from "@capacitor/core";
	import init from "overfade";
	import Navbar from "$lib/components/Navbar.svelte";
	import Footer from "$lib/components/Footer.svelte";
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import { initializeBackGestureHandler } from "$lib/utils/backGesture";
	import { onNotificationTap } from "$lib/utils/pushNotifications.js";
	import { goto, onNavigate } from "$app/navigation";
	import { browser } from "$app/environment";
	import { page } from "$app/state";
	import { setContext } from "svelte";

	let { children } = $props();
	let isNative = Capacitor.isNativePlatform();

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		// Only apply view transitions within /connect routes
		const from = navigation.from?.url.pathname;
		const to = navigation.to?.url.pathname;
		if (!from?.startsWith("/connect") || !to?.startsWith("/connect")) return;

		// On iOS, the WKWebView swipe gesture already animates popstate navigations
		if (navigation.type === "popstate" && Capacitor.getPlatform() === "ios") return;

		// Calculate depth by counting slashes (e.g. /connect/add is deeper than /connect)
		const fromDepth = (from.match(/\//g) || []).length;
		const toDepth = (to.match(/\//g) || []).length;
		const isBack = toDepth < fromDepth;

		return new Promise((resolve) => {
			document.documentElement.classList.toggle("back-navigation", isBack);
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let articleEl = $state(null);
	setContext("articleEl", () => articleEl);

	let isIframed = browser && window.self !== window.top;
	if (isIframed) document.documentElement.style.setProperty("--safe-area-top", "0px");
	if (isNative && browser) document.documentElement.classList.add("native");

	onMount(init); // Overfade
	onMount(initializeBackGestureHandler); // Back gesture support for going back (Android)

	// Handle notification taps - navigate to /connect with product and event query params
	let removeNotificationTapListener;

	onMount(() => {
		removeNotificationTapListener = onNotificationTap((data) => {
			if (data.productId) {
				const params = `product-id=${data.productId}${data.eventId ? `&event-id=${data.eventId}` : ""}`;
				const target = `/connect?${params}`;
				goto(target, { replaceState: page.url.pathname === "/connect" });
			}
		});
	});
	onDestroy(() => removeNotificationTapListener?.());
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
	<article bind:this={articleEl} class="no-scrollbar safe-min-h-svh relative flex w-full flex-col overflow-x-hidden sm:border-x">
		<div style="view-transition-name: content" class="flex min-h-0 flex-1 flex-col">
			{@render children?.()}
		</div>
		<Footer />
	</article>
</main>
