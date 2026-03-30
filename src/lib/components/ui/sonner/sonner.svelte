<script>
	import { Toaster as Sonner } from "svelte-sonner";
	import {
		RiAlertLine,
		RiCheckboxCircleLine,
		RiErrorWarningLine,
		RiInformationLine,
		RiLoader4Line
	} from "svelte-remixicon";
	import { theme } from "$lib/utils/theme.svelte.js";

	let { ...restProps } = $props();
</script>

<Sonner
	theme={theme.current}
	class="toaster group pointer-events-auto [&_*]:select-text [&_*]:rounded-none!"
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
