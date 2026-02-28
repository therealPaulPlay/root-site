<script>
	import { RiBlueskyLine, RiTwitterXLine, RiYoutubeLine } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
	import { Capacitor } from "@capacitor/core";
	import { page } from "$app/state";

	// Hide footer if ?hide-footer=true is included in the URL or if the platform is native
	let hideFooter = $derived(page.url.searchParams.get("hide-footer") === "true" || Capacitor.isNativePlatform());
</script>

{#if !hideFooter}
	<section class="relative mt-auto w-full overflow-hidden border-t bg-foreground">
		<div class="flex flex-wrap gap-4 p-8 px-2 lg:px-8 xl:px-12 2xl:px-16">
			<Button class="text-background" href="https://www.youtube.com/@PaulPlay" target="_blank" variant="link"
				>YouTube <RiYoutubeLine /></Button
			>
			<Button
				class="text-background"
				href="https://bsky.app/profile/paulplay.bsky.social"
				target="_blank"
				variant="link">Bluesky <RiBlueskyLine /></Button
			>
			<Button class="text-background" href="https://x.com/PaulPlayStudio" target="_blank" variant="link"
				>Twitter <RiTwitterXLine /></Button
			>
			<Button variant="link" class="text-background" href="/privacy">Privacy</Button>
			<Button variant="link" class="text-background" href="/terms">Terms</Button>
			<Button variant="link" class="text-background" href="/support">Support</Button>
			<Button variant="link" class="text-background" href="/source-code">Source code</Button>
			<Button variant="link" class="text-background" href="https://paulplay.studio/imprint" target="_blank"
				>Imprint</Button
			>
			<Button variant="link" class="text-muted-foreground" href="/">© ROOT {new Date().getFullYear()}</Button>
		</div>
		<div class="relative h-30 w-full md:h-38 lg:h-55 xl:h-72 2xl:h-90 dark:invert">
			<div class="logo-layer"></div>
			<div class="logo-layer logo-fill"></div>
		</div>
	</section>
{/if}

<style>
	.logo-layer {
		position: absolute;
		width: 100%;
		height: 100%;
		background-image: url("/images/logo-stroke.svg");
		background-size: contain;
		background-repeat: no-repeat;
		left: 0;
		top: 0;
		filter: invert();
	}

	.logo-fill {
		animation: laser ease-in-out 3s infinite;
		background-image: url("/images/logo.svg");
	}

	@keyframes laser {
		0% {
			clip-path: inset(0 0 100% 0); /* Top, right, bottom, left */
		}
		50% {
			clip-path: inset(0 0 0% 0);
		}
		100% {
			clip-path: inset(100% 0 0% 0);
		}
	}
</style>
