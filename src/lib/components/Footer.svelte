<script>
	import { RiTwitterXLine, RiYoutubeFill } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
</script>

<section class="relative mt-auto w-full overflow-hidden border-t bg-foreground">
	<div class="flex flex-wrap gap-4 p-8 px-4 2xl:px-16 xl:px-12 lg:px-8">
		<Button class="text-background" href="https://www.youtube.com/@PaulPlay" target="_blank" variant="link"
			>YouTube <RiYoutubeFill /></Button
		>
		<Button class="text-background" href="https://x.com/PaulPlayStudio" target="_blank" variant="link"
			>Twitter <RiTwitterXLine /></Button
		>
		<Button variant="link" class="text-background" href="/privacy">Privacy Policy</Button>
		<Button variant="link" class="text-background" href="https://paulplay.studio/imprint" target="_blank"
			>Imprint</Button
		>
		<p class="h-9 px-4 leading-9 text-muted-foreground uppercase">
			© Root {new Date().getFullYear()}
		</p>
	</div>
	<div class="pointer-events-none relative w-full lg:h-55 xl:h-72 2xl:h-90 md:h-38 h-30">
		<div class="logo-layer"></div>
		<div class="logo-layer logo-fill"></div>
	</div>
</section>

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
