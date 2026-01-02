<script>
	import { page } from "$app/state";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Tabs from "$lib/components/ui/tabs";
	import { RiArrowLeftLine } from "svelte-remixicon";

	const productId = page.params.productId;
</script>

<div class="absolute top-0 left-0 flex text-xl">
	<Button class="h-20! border-t-0 border-l-0 border-b-0 p-6!" variant="outline" href="/connect">
		<RiArrowLeftLine class="shape-crisp h-8! w-8!" />
	</Button>
</div>

<div class="flex min-h-svh w-full flex-col divide-y pt-20">
	<div class="w-full aspect-16/9 border-t bg-black">
		<!-- todo show live video feed here with video player (fullscreen option) -->
	</div>
	<div class="w-full basis-full">
		<Tabs.Root value="events">
			<div class="w-full">
				<Tabs.List class="w-full">
					<Tabs.Trigger value="events">Events</Tabs.Trigger>
					<Tabs.Trigger value="controls">Controls</Tabs.Trigger>
					<Tabs.Trigger value="health">Health</Tabs.Trigger>
				</Tabs.List>
			</div>
			<Tabs.Content value="events">
                <!-- scrollable event log list with thumbnails towards the side -->
            </Tabs.Content>
			<Tabs.Content value="controls">
                <!-- configuration stuff like enabling or disabling the mic, setting the recording sound, restarting the device etc. -->
            </Tabs.Content>
			<Tabs.Content value="health">
                <!-- Health data, perf data, logs, update status + update button if available -->
            </Tabs.Content>
		</Tabs.Root>
	</div>
</div>
