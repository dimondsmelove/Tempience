<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import BottomSheet from '$lib/ui/BottomSheet/BottomSheet.svelte';

	let { label, onclose, children }: { label: string; onclose: () => void; children: Snippet } =
		$props();
	const show: Attachment<HTMLElement> = (element) => {
		element.showPopover();
		return () => element.hidePopover();
	};
</script>

<div popover="manual" class="sheet-layer" {@attach show}>
	<BottomSheet {label} modal heading={false} bottomOffset={0} fit {onclose}>
		{@render children()}
	</BottomSheet>
</div>

<style>
	.sheet-layer:popover-open {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: visible;
	}
</style>
