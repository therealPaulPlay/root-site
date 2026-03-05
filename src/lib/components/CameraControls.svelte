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
		RiRestartLine
	} from "svelte-remixicon";
	import Switch from "./ui/switch/switch.svelte";
	import { toast } from "svelte-sonner";
	import { vibrate } from "$lib/utils/haptics";

	let {
		loading,
		restartDialogOpen = $bindable(false),
		resetDialogOpen = $bindable(false),
		removeDeviceDialogOpen = $bindable({}),
		toggleMicrophone = () => {},
		toggleRecordingSound = () => {},
		toggleEventDetection = () => {},
		updateEventDetectionTypes = () => {},
		loadDevices = () => {},
		removeDevice = () => {},
		restartProduct = () => {},
		resetProduct = () => {},
		micEnabled = $bindable(),
		recordingSoundEnabled = $bindable(),
		eventDetectionEnabled = $bindable(),
		eventDetectionTypes = $bindable([]),
		devices = []
	} = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-4 border p-4">
		<div class="pr-6">
			<Label class="text-base">Microphone</Label>
			<p class="text-sm text-muted-foreground">Record audio together with video.</p>
		</div>
		<Switch onCheckedChange={toggleMicrophone} disabled={loading.is("mic")} bind:checked={micEnabled} />
	</div>
	<div class="flex items-center justify-between gap-4 border p-4">
		<div class="pr-6">
			<Label class="text-base">Recording sound</Label>
			<p class="text-sm text-muted-foreground">Play sound when recording or streaming.</p>
		</div>
		<Switch
			onCheckedChange={toggleRecordingSound}
			disabled={loading.is("sound")}
			bind:checked={recordingSoundEnabled}
		/>
	</div>

	<div class="space-y-4 border p-4">
		<div class="flex items-center justify-between gap-4">
			<div class="pr-6">
				<Label class="text-base">Event detection</Label>
				<p class="text-sm text-muted-foreground">Detect and record events automatically.</p>
			</div>
			<Switch
				onCheckedChange={toggleEventDetection}
				disabled={loading.is("eventDetection")}
				bind:checked={eventDetectionEnabled}
			/>
		</div>
		<div class:opacity-50={!eventDetectionEnabled} class:pointer-events-none={!eventDetectionEnabled}>
			<ToggleGroup.Root
				type="multiple"
				bind:value={eventDetectionTypes}
				onValueChange={() => {
					vibrate.light();
					updateEventDetectionTypes();
				}}
				variant="outline"
				spacing={2}
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
		<div class="mb-4">
			<Label class="text-base">Paired devices</Label>
		</div>
		{#if devices.length === 0}
			<div class="border p-4 text-center text-sm text-muted-foreground">
				{loading.is("devices") ? "Devices loading..." : "No paired devices available."}
			</div>
		{:else}
			<div class="space-y-4">
				{#each devices as device}
					<div
						class="flex items-center justify-between gap-2 border p-3 py-2 {device.id ===
						localStorage.getItem('deviceId')
							? 'bg-muted'
							: ''}"
					>
						<div class="flex flex-1 items-center gap-1 truncate">
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<button
								class="text-sm font-medium hover:underline active:underline"
								onclick={() =>
									toast.info(
										"Device ID: " + device.id + ", paired on " + new Date(device.pairedAt)?.toLocaleDateString()
									)}
							>
								{device.name || "N/A"}
								</button>
						</div>
						<!-- Removing the user's currently used device is done via the /connect page -->
						{#if device.id !== localStorage.getItem("deviceId")}
							<AlertDialog.Root
								open={removeDeviceDialogOpen[device.id]}
								onOpenChange={(open) => {
									removeDeviceDialogOpen[device.id] = open;
								}}
							>
								<AlertDialog.Trigger class="{buttonVariants({ variant: 'ghost', size: 'xs' })} -mr-1">
									<RiCloseLine class="size-4" />
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
										<AlertDialog.Cancel disabled={loading.is(`remove-${device.id}`)}>Cancel</AlertDialog.Cancel>
										<AlertDialog.Action
											disabled={loading.is(`remove-${device.id}`)}
											onclick={() => removeDevice(device.id)}
										>
											{#if loading.is(`remove-${device.id}`)}<Spinner />{/if}
											Remove
										</AlertDialog.Action>
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
		<AlertDialog.Trigger class="{buttonVariants({ variant: 'outline' })} w-full gap-2">
			<RiRestartLine class="size-4" />
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
				<AlertDialog.Cancel disabled={loading.is("restart")}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action disabled={loading.is("restart")} onclick={restartProduct}>
					{#if loading.is("restart")}<Spinner />{/if}
					Restart
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<AlertDialog.Root bind:open={resetDialogOpen}>
		<AlertDialog.Trigger class="{buttonVariants({ variant: 'outline' })} w-full gap-2">
			<RiFileShredLine class="size-4" />
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
				<AlertDialog.Cancel disabled={loading.is("reset")}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action disabled={loading.is("reset")} onclick={resetProduct}>
					{#if loading.is("reset")}<Spinner />{/if}
					Reset
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
