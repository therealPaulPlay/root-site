<script>
	import { RiTwitterXLine, RiYoutubeFill } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
</script>

<section class="relative mt-auto w-full overflow-hidden border-t bg-foreground">
	<div class="pointer-events-none absolute inset-0 -top-50">
		<div class="logo-layer"></div>
		<div class="logo-layer logo-fill"></div>
	</div>
	<div class="flex flex-col gap-4 p-8">
		<Button variant="link" class="text-background w-fit" href="https://paulplay.studio/imprint" target="_blank"
			>Imprint</Button
		>
		<Button variant="link" class="text-background w-fit" href="/privacy">Privacy Policy</Button>
		<div class="flex gap-4 px-4 pt-2">
			<Button class="text-background" href="https://www.youtube.com/@PaulPlay" target="_blank"><RiYoutubeFill /></Button
			>
			<Button class="text-background" href="https://x.com/PaulPlayStudio" target="_blank"><RiTwitterXLine /></Button>
		</div>
	</div>
</section>

<style>
	.logo-layer {
		position: absolute;
		left: 60%;
		height: 1000px;
		width: 1000px;
		background-image: url("/images/logo-stroke.svg");
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		filter: invert(1);
		top: -40%;
		filter: invert();
		transform: translateX(-50%);
	}

	.logo-fill {
		background-image: url("/images/logo.svg");
		animation: laser ease-in-out 3s infinite;
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
