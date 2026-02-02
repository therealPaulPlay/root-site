<script>
	import Button, { buttonVariants } from "./ui/button/button.svelte";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import { RiCheckLine, RiCloseLine, RiFileShredLine, RiRefreshLine, RiRestartLine } from "svelte-remixicon";

	let {
		buttonsLoading = $bindable({}),
		toggleMicrophone = () => {},
		toggleRecordingSound = () => {},
		toggleEventDetection = () => {},
		updateEventDetectionTypes = () => {},
		loadDevices = () => {},
		removeDevice = () => {},
		restartProduct = () => {},
		resetProduct = () => {},
		micEnabled,
		recordingSoundEnabled,
		eventDetectionEnabled,
		eventDetectionTypes = $bindable([]),
		devices = []
	} = $props();

	let restartDialogOpen = $state(false);
	let resetDialogOpen = $state(false);
	let removeDeviceDialogOpen = $state({});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-4 border p-4">
		<div>
			<Label class="text-base">Microphone</Label>
			<p class="text-sm text-muted-foreground">Record audio together with video.</p>
		</div>
		<Button onclick={toggleMicrophone} variant="outline" disabled={buttonsLoading.mic}>
			{#if buttonsLoading.mic}
				<Spinner class="size-4" />
			{:else}
				{micEnabled ? "Enabled" : "Disabled"}
			{/if}
		</Button>
	</div>
	<div class="flex items-center justify-between gap-4 border p-4">
		<div>
			<Label class="text-base">Recording sound</Label>
			<p class="text-sm text-muted-foreground">Play sound when recording or streaming.</p>
		</div>
		<Button onclick={toggleRecordingSound} variant="outline" disabled={buttonsLoading.sound}>
			{#if buttonsLoading.sound}
				<Spinner class="size-4" />
			{:else}
				{recordingSoundEnabled ? "Enabled" : "Disabled"}
			{/if}
		</Button>
	</div>

	<div class="space-y-4 border p-4">
		<div class="flex items-center justify-between gap-4">
			<div>
				<Label class="text-base">Event detection</Label>
				<p class="text-sm text-muted-foreground">Detect and record events automatically.</p>
			</div>
			<Button onclick={toggleEventDetection} variant="outline" disabled={buttonsLoading.eventDetection}>
				{#if buttonsLoading.eventDetection}
					<Spinner class="size-4" />
				{:else}
					{eventDetectionEnabled ? "Enabled" : "Disabled"}
				{/if}
			</Button>
		</div>
		<div class:opacity-50={!eventDetectionEnabled} class:pointer-events-none={!eventDetectionEnabled}>
			<ToggleGroup.Root
				type="multiple"
				bind:value={eventDetectionTypes}
				onValueChange={() => updateEventDetectionTypes()}
				variant="outline"
				spacing={2}
				size="sm"
				class="overflow-x-auto max-w-full of-left of-right no-scrollbar"
			>
				<ToggleGroup.Item value="person" class="gap-1">
					Person
					{#if eventDetectionTypes.includes("person")}<RiCheckLine class="size-4 text-muted-foreground" />{/if}
				</ToggleGroup.Item>
				<ToggleGroup.Item value="pet" class="gap-2">
					Pet
					{#if eventDetectionTypes.includes("pet")}<RiCheckLine class="size-4 text-muted-foreground" />{/if}
				</ToggleGroup.Item>
				<ToggleGroup.Item value="car" class="gap-2">
					Car
					{#if eventDetectionTypes.includes("car")}<RiCheckLine class="size-4 text-muted-foreground" />{/if}
				</ToggleGroup.Item>
				<ToggleGroup.Item value="motion" class="gap-2">
					Other motion
					{#if eventDetectionTypes.includes("motion")}<RiCheckLine class="size-4 text-muted-foreground" />{/if}
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</div>
	</div>

	<div class="border p-4">
		<div class="mb-4 flex items-center justify-between gap-4">
			<Label class="text-base">Paired devices</Label>
			<Button onclick={loadDevices} variant="outline" size="sm" disabled={buttonsLoading.devices}>
				Refresh
				{#if buttonsLoading.devices}
					<Spinner class="size-4" />
				{:else}
					<RiRefreshLine class="size-4" />
				{/if}
			</Button>
		</div>
		{#if devices.length === 0}
			<p class="text-sm text-muted-foreground">No devices paired.</p>
		{:else}
			<div class="space-y-4">
				{#each devices as device}
					<div
						class="flex items-center justify-between gap-4 border p-4 {device.id === localStorage.getItem('deviceId')
							? 'bg-muted'
							: ''}"
					>
						<div class="flex-1 truncate">
							<p class="text-sm font-medium">{device.name || "N/A"}</p>
							<p class="truncate text-xs text-muted-foreground">ID: {device.id}</p>
						</div>
						<!-- Removing the user's currently used device is done via the /connect page -->
						{#if device.id !== localStorage.getItem("deviceId")}
							<AlertDialog.Root
								open={removeDeviceDialogOpen[device.id]}
								onOpenChange={(open) => {
									removeDeviceDialogOpen[device.id] = open;
								}}
							>
								<AlertDialog.Trigger
									class={buttonVariants({ variant: "outline", size: "sm" })}
									disabled={buttonsLoading[`remove-${device.id}`]}
								>
									{#if buttonsLoading[`remove-${device.id}`]}
										<Spinner class="size-4" />
									{:else}
										<RiCloseLine class="size-4" />
									{/if}
								</AlertDialog.Trigger>
								<AlertDialog.Content>
									<AlertDialog.Header>
										<AlertDialog.Title>Remove device?</AlertDialog.Title>
										<AlertDialog.Description>
											This will unpair "{device.name || "N/A"}" from this product. The device will no longer
											be able to access this product.
										</AlertDialog.Description>
									</AlertDialog.Header>
									<AlertDialog.Footer>
										<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
										<AlertDialog.Action
											onclick={() => {
												delete removeDeviceDialogOpen[device.id];
												removeDevice(device.id);
											}}>Remove</AlertDialog.Action
										>
									</AlertDialog.Footer>
								</AlertDialog.Content>
							</AlertDialog.Root>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<AlertDialog.Root bind:open={restartDialogOpen}>
		<AlertDialog.Trigger
			class="{buttonVariants({ variant: 'outline' })} w-full gap-2"
			disabled={buttonsLoading.restart}
		>
			{#if buttonsLoading.restart}
				<Spinner class="size-4" />
			{:else}
				<RiRestartLine class="size-4" />
			{/if}
			Restart
		</AlertDialog.Trigger>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Restart?</AlertDialog.Title>
				<AlertDialog.Description>
					This will restart the product. The connection will be lost temporarily.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					onclick={() => {
						restartDialogOpen = false;
						restartProduct();
					}}>Restart</AlertDialog.Action
				>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<AlertDialog.Root bind:open={resetDialogOpen}>
		<AlertDialog.Trigger class="{buttonVariants({ variant: 'outline' })} w-full gap-2" disabled={buttonsLoading.reset}>
			{#if buttonsLoading.reset}
				<Spinner class="size-4" />
			{:else}
				<RiFileShredLine class="size-4" />
			{/if}
			Factory reset
		</AlertDialog.Trigger>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Factory reset?</AlertDialog.Title>
				<AlertDialog.Description>
					This will erase all data of this product and unpair all devices. This action cannot be undone.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					onclick={() => {
						resetDialogOpen = false;
						resetProduct();
					}}>Reset</AlertDialog.Action
				>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
