<script module>
	import { cn } from "$lib/utils.js";
	import { vibrate } from "$lib/utils/haptics";
	import { tv } from "tailwind-variants";

	export const buttonVariants = tv({
		base: "focus-visible:border-ring outline-none border select-none uppercase focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-start gap-2 whitespace-nowrap font-medium focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/90 border-transparent",
				destructive:
					"bg-destructive hover:bg-destructive/90 active:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-foreground border-transparent",
				outline: "bg-background hover:bg-accent active:bg-accent hover:text-accent-foreground active:text-accent-foreground",
				secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 accent:bg-secondary/80 border-transparent",
				ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 active:bg-accent active:text-accent-foreground dark:active:bg-accent/50 border-transparent",
				link: "text-primary underline-offset-4 hover:underline active:underline border-0"
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 gap-1.5 rounded-sm px-3",
				lg: "h-10 rounded-md px-6",
				icon: "size-9"
			}
		},
		defaultVariants: {
			variant: "default",
			size: "default"
		}
	});
</script>

<script>
	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		onclick: execFunc,
		children,
		...restProps
	} = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		onclick={() => {
			if (variant == "default" || variant == "destructive") vibrate.light();
			execFunc?.();
		}}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
