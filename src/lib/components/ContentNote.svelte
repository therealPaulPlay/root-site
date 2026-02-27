<script>
	import { RiInformation2Line } from "svelte-remixicon";
	import Label from "./ui/label/label.svelte";

	let { text = "Default text.", class: className } = $props();
</script>

<div class="max-w-lg space-y-2 border p-4 {className}">
	<Label><RiInformation2Line class="size-4" /> Note</Label>
	<p class="text-sm text-muted-foreground">{text}</p>
</div>
