<script lang="ts">
	import type {
		ExplorerIntersection,
		ExplorerScope,
		ExplorerTrace
	} from '$lib/model/Snapshot/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { positionPopover } from '$lib/ui/Popover/position';
	import type { MoveTarget } from '../MoveIntention/types';
	import CreateForm from './CreateForm.svelte';
	let {
		target,
		weekStart,
		today,
		scopes,
		links,
		traces,
		add,
		primary = false
	}: {
		target: MoveTarget;
		weekStart: number;
		today: string;
		scopes: readonly ExplorerScope[];
		links: readonly ExplorerIntersection[];
		traces: readonly ExplorerTrace[];
		add: (
			title: string,
			target: MoveTarget,
			scopeIds?: readonly string[],
			parentId?: string
		) => Promise<string | null>;
		primary?: boolean;
	} = $props();
	const uid = $props.id();
	let open = $state(false);
	let panel: HTMLDivElement;
</script>

<!-- One add form for the whole board: every "+" opens it beside itself with its own target. -->
<Button
	variant={primary ? 'primary' : 'quiet'}
	size={primary ? 'md' : 'sm'}
	popovertarget="{uid}-create"
	aria-label={t('intentions.add')}
	>{primary ? `+ ${t('intentions.add')}` : t('intentions.addShort')}</Button
>

<div
	id="{uid}-create"
	class="popover"
	popover="auto"
	role="dialog"
	aria-label={t('intentions.add')}
	bind:this={panel}
	{@attach positionPopover}
	ontoggle={(event) => (open = event.newState === 'open')}
>
	{#if open}<CreateForm
			initialTarget={target}
			{weekStart}
			{today}
			{scopes}
			{links}
			{traces}
			{add}
			onclose={() => panel.hidePopover()}
		/>{/if}
</div>

<style>
	.popover {
		position: fixed;
		inset: auto;
		margin: 0;
		width: 400px;
		max-width: calc(100vw - 16px);
		border: 1px solid var(--cg-border-default);
		border-radius: 6px;
		background: var(--cg-bg-surface);
		color: var(--cg-text-primary);
	}
	@media (max-width: 800px) {
		.popover {
			width: calc(100vw - 16px);
		}
	}
</style>
