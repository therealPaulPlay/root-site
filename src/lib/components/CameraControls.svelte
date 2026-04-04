<script>
	import { buttonVariants } from "./ui/button/button.svelte";
	import Label from "./ui/label/label.svelte";
	import Spinner from "./ui/spinner/spinner.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import * as Slider from "$lib/components/ui/slider";
	import { RiCheckLine, RiCloseLine, RiFileShredLine, RiRestartLine } from "svelte-remixicon";
	import Switch from "./ui/switch/switch.svelte";
	import { vibrate } from "$lib/utils/haptics";

	let deviceInfoDevice = $state(null);
	let deviceInfoOpen = $state(false);

	const COOLDOWN_STEPS = [0, 1, 5, 10, 30];
	let cooldownSliderValue = $derived([Math.max(0, COOLDOWN_STEPS.indexOf(notificationCooldown))]);

	let {
		loading,
		eventTypes = [],
		restartDialogOpen = $bindable(false),
		resetDialogOpen = $bindable(false),
		removeDeviceDialogOpen = $bindable({}),
		toggleMicrophone = () => {},
		toggleRecordingSound = () => {},
		toggleNotifications = () => {},
		updateNotificationCooldown = () => {},
		toggleEventDetection = () => {},
		updateEventDetectionTypes = () => {},
		removeDevice = () => {},
		restartProduct = () => {},
		resetProduct = () => {},
		micEnabled = $bindable(),
		recordingSoundEnabled = $bindable(),
		eventDetectionEnabled = $bindable(),
		eventDetectionTypes = $bindable([]),
		notificationsEnabled = $bindable(),
		notificationCooldown = $bindable(0),
		devices = []
	} = $props();
</script>

<div class="space-y-6">
	<div class="space-y-4 border p-4">
		<div class="flex items-center justify-between gap-4">
			<div class="pr-6">
				<Label class="text-base">Push notifications</Label>
				<p class="text-sm text-muted-foreground">Get notified when events are detected.</p>
			</div>
			<Switch
				onCheckedChange={toggleNotifications}
				disabled={loading.is("notifications")}
				bind:checked={notificationsEnabled}
			/>
		</div>
		<div class="space-y-4" class:opacity-50={!notificationsEnabled} class:pointer-events-none={!notificationsEnabled}>
			<Label class="text-sm">Cooldown</Label>
			<div class="px-2.5">
				<Slider.Root
					min={0}
					max={COOLDOWN_STEPS.length - 1}
					step={1}
					thumbPositioning="exact"
					bind:value={cooldownSliderValue}
					onValueChange={() => vibrate.light()}
					onValueCommit={(value) => {
						const newValue = COOLDOWN_STEPS[value[0]];
						if (newValue !== notificationCooldown) {
							notificationCooldown = newValue;
							updateNotificationCooldown();
						}
					}}
				/>
			</div>
			<div class="relative h-4">
				{#each COOLDOWN_STEPS as step, i}
					<span
						class="absolute text-xs text-muted-foreground text-nowrap {i === 0
							? ''
							: i === COOLDOWN_STEPS.length - 1
								? '-translate-x-full'
								: '-translate-x-1/2'}"
						style="left: {i === 0 || i === COOLDOWN_STEPS.length - 1
							? `${(i / (COOLDOWN_STEPS.length - 1)) * 100}%`
							: `calc(0.625rem + ${(i / (COOLDOWN_STEPS.length - 1)) * 100}% - ${(i / (COOLDOWN_STEPS.length - 1)) * 1.25}rem)`}"
					>
						{step === 0 ? "Off" : step + " min"}
					</span>
				{/each}
			</div>
		</div>
	</div>

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
				{#each eventTypes as type}
					<ToggleGroup.Item value={type.value} class="gap-2">
						{type.label}
						{#if eventDetectionTypes.includes(type.value)}<RiCheckLine class="size-4" />{/if}
					</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
			{#if eventTypes.length === 0}
				<div class="border p-4 text-center text-sm text-muted-foreground">
					{loading.is("eventDetection") ? "Event types loading..." : "No event types available."}
				</div>
			{/if}
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
							<button
								class="text-sm font-medium hover:underline active:underline"
								onclick={() => { deviceInfoDevice = device; deviceInfoOpen = true; }}
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

<Dialog.Root bind:open={deviceInfoOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Device info</Dialog.Title>
		</Dialog.Header>
		{#if deviceInfoDevice}
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Name</span>
					<span>{deviceInfoDevice.name || "N/A"}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Paired on</span>
					<span>{new Date(deviceInfoDevice.pairedAt)?.toLocaleDateString()}</span>
				</div>
				<div class="flex justify-between gap-4">
					<span class="text-muted-foreground">ID</span>
					<span class="text-end select-text text-xs leading-5">{deviceInfoDevice.id}</span>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
