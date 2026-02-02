<script>
	import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...restProps } = $props();
</script>

<RangeCalendarPrimitive.GridBody bind:ref class="grid grid-rows-6" {...restProps} />