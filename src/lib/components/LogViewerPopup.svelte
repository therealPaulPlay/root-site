<script>
	import * as Dialog from "$lib/components/ui/dialog";
	import { collectedLogs } from "$lib/state/logs.svelte";
	import { buttonVariants } from "./ui/button";
</script>

<Dialog.Root>
	<Dialog.Trigger
		class={buttonVariants({
			variant: "outline"
		})}
	>
		View logs
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>App logs</Dialog.Title>
		</Dialog.Header>
		<div class="relative h-60 overflow-hidden border bg-muted text-xs">
			<div
				class="of-top of-bottom of-length-2 h-full w-full space-y-2 overflow-x-hidden overflow-y-auto p-4 wrap-break-word"
			>
				{#if collectedLogs.length}
					{#each collectedLogs as log}
						<p class="select-text">{log}</p>
					{/each}
				{:else}
					<p>No logs collected in this session.</p>
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
