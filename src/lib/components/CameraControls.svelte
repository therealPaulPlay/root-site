<script>
	import Button, { buttonVariants } from "./ui/button/button.svelte";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import {
		RiCheckLine,
		RiCloseLine,
		RiFileShredLine,
		RiInformationLine,
		RiRefreshLine,
		RiRestartLine
	} from "svelte-remixicon";
	import Switch from "./ui/switch/switch.svelte";
	import { toast } from "svelte-sonner";

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
		<div class="pr-6">
			<Label class="text-base">Microphone</Label>
			<p class="text-sm text-muted-foreground">Record audio together with video.</p>
		</div>
		<Switch onCheckedChange={toggleMicrophone} disabled={buttonsLoading.mic} checked={micEnabled} />
	</div>
	<div class="flex items-center justify-between gap-4 border p-4">
		<div class="pr-6">
			<Label class="text-base">Recording sound</Label>
			<p class="text-sm text-muted-foreground">Play sound when recording or streaming.</p>
		</div>
		<Switch onCheckedChange={toggleRecordingSound} disabled={buttonsLoading.sound} checked={recordingSoundEnabled} />
	</div>

	<div class="space-y-4 border p-4">
		<div class="flex items-center justify-between gap-4">
			<div class="pr-6">
				<Label class="text-base">Event detection</Label>
				<p class="text-sm text-muted-foreground">Detect and record events automatically.</p>
			</div>
			<Switch
				onCheckedChange={toggleEventDetection}
				disabled={buttonsLoading.eventDetection}
				checked={eventDetectionEnabled}
			/>
		</div>
		<div class:opacity-50={!eventDetectionEnabled} class:pointer-events-none={!eventDetectionEnabled}>
			<ToggleGroup.Root
				type="multiple"
				bind:value={eventDetectionTypes}
				onValueChange={() => updateEventDetectionTypes()}
				variant="outline"
				spacing={2}
				size="sm"
				class="of-left of-right no-scrollbar max-w-full overflow-x-auto"
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
			<p class="text-sm text-muted-foreground">No paired devices available.</p>
		{:else}
			<div class="space-y-4">
				{#each devices as device}
					<div
						class="flex items-center justify-between gap-2 border p-3 py-2 {device.id ===
						localStorage.getItem('deviceId')
							? 'bg-muted'
							: ''}"
					>
						<div class="flex flex-1 gap-1 truncate items-center">
							<p class="text-sm font-medium">{device.name || "N/A"}</p>
							<Button
								onclick={() =>
									toast.info(
										"Device ID: " + device.id + ", paired on " + new Date(device.pairedAt)?.toLocaleDateString()
									)}
								size="xs"
								variant="ghost"
								class="text-muted-foreground"><RiInformationLine class="size-4" /></Button
							>
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
									class="{buttonVariants({ variant: "ghost", size: "xs" })} -mr-1"
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
											This will unpair "{device.name || "N/A"}" from this product. The device will no longer be able to
											access this product.
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
