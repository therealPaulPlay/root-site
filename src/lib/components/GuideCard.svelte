<script>
	import * as Card from "$lib/components/ui/card/index.js";
	import { RiArrowRightLine } from "svelte-remixicon";
	import Button from "./ui/button/button.svelte";
	let { title = "Default title", subtitle = "This is the default subtitle text.", href = "/" } = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<Card.Description>{subtitle}</Card.Description>
	</Card.Header>
	<!-- <Card.Content>
		<p>Card Content</p>
	</Card.Content> -->
	<Card.Footer>
        <Button variant="outline" {href}>Read <RiArrowRightLine /></Button>
	</Card.Footer>
</Card.Root>
