<script>
	import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
	import InfoIcon from "@lucide/svelte/icons/info";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

	import { Toaster as Sonner } from "svelte-sonner";
	import { mode } from "mode-watcher";
	import { RiAlertLine, RiCheckboxCircleLine, RiErrorWarningLine, RiInformationLine, RiLoader4Line } from "svelte-remixicon";

	let { ...restProps } = $props();
</script>

<Sonner
	theme={mode.current}
	class="toaster group [&_*]:rounded-none!"
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	{...restProps}
	>{#snippet loadingIcon()}
		<RiLoader4Line class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<RiCheckboxCircleLine class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<RiErrorWarningLine class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<RiInformationLine class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<RiAlertLine class="size-4" />
	{/snippet}
</Sonner>
