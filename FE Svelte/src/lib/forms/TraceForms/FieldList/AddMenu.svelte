<script lang="ts">
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { FIELD_KINDS } from '$lib/model/TraceForm/constants';
	import type { MessageKey } from '$lib/state/Locale/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { positionPopover } from '$lib/ui/Popover/position';
	import type { AddKind } from './types';

	let {
		label,
		allowList,
		between = false,
		onpick
	}: {
		/** What the control says: «+ поле», «+ поле в «Упражнения»». */
		label: string;
		/** A list is offered while lists nest less than two deep (Q2). */
		allowList: boolean;
		/** The thin «+» between two fields rather than the one at the end of a level. */
		between?: boolean;
		onpick: (kind: AddKind) => void;
	} = $props();
	/** The ready blocks, and whether a block brings a list (not offered past two levels). */
	const BLOCKS = [
		{ id: 'reps', list: true },
		{ id: 'weightReps', list: true },
		{ id: 'time', list: false },
		{ id: 'timeDistance', list: false }
	] as const;
	const id = $props.id();
	let query = $state('');
	let panel = $state<HTMLDivElement | null>(null);
	let search = $state<HTMLInputElement | null>(null);
	const kinds = $derived([
		...FIELD_KINDS.map((kind) => ({
			value: kind.value as AddKind,
			label: t(kind.label),
			hint: '',
			block: false
		})),
		...(allowList
			? [
					{
						value: 'repeating' as AddKind,
						label: t('fieldKind.repeating'),
						hint: t('form.listHint'),
						block: false
					},
					{
						value: 'variants' as AddKind,
						label: t('fieldKind.variants'),
						hint: t('form.variantsHint'),
						block: false
					}
				]
			: []),
		// Ready blocks (owner, 2026-09-29): «Подходы: вес × повторы» is one pick, not five.
		...BLOCKS.filter((block) => allowList || !block.list).map((block) => ({
			value: `block:${block.id}` as AddKind,
			label: t(`template.block.${block.id}` as MessageKey),
			hint: '',
			block: true
		}))
	]);
	const shown = $derived(
		kinds.filter((kind) =>
			kind.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
		)
	);
	const pick = (kind: AddKind): void => {
		panel?.hidePopover();
		onpick(kind);
	};
	const ontoggle = (event: ToggleEvent): void => {
		if (event.newState !== 'open') return;
		query = '';
		search?.focus();
	};
</script>

<!-- One way to add a field anywhere (research 2026-09-29: «+» with a searchable menu of
     kinds, Tally's «/»): the name is typed in the field itself once it stands in place. -->
<button
	type="button"
	class={['add-trigger', between ? 'between' : 'end']}
	popovertarget={id}
	aria-label={label}
	title={label}
	data-testid={between ? 'field-insert' : 'field-add'}
	><PlusOutline class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{#if !between}<span>{label}</span
		>{/if}</button
>
<div
	{id}
	popover="auto"
	class="add-panel cg-popover border border-outline bg-surface text-ink"
	bind:this={panel}
	{ontoggle}
	{@attach positionPopover}
>
	<input
		type="search"
		class="cg-control cg-control-sm cg-field"
		placeholder={t('form.typeSearch')}
		aria-label={t('form.typeSearch')}
		bind:this={search}
		bind:value={query}
		onkeydown={(event) => {
			if (event.key === 'Enter' && shown[0]) {
				event.preventDefault();
				pick(shown[0].value);
			}
		}}
	/>
	<ul class="grid" role="menu" aria-label={label}>
		{#each shown as kind, n (kind.value)}
			{#if kind.block && !shown[n - 1]?.block}
				<li role="presentation" class="mt-1 border-t border-outline px-2 pt-1 text-xs text-muted">
					{t('template.blocks')}
				</li>
			{/if}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="add-kind"
					aria-label={kind.label}
					title={kind.hint || undefined}
					onclick={() => pick(kind.value)}
					>{kind.label}{#if kind.hint}<span class="block text-xs text-muted">{kind.hint}</span
						>{/if}</button
				>
			</li>
		{:else}
			<li class="px-2 py-1 text-muted">{t('picker.empty')}</li>
		{/each}
	</ul>
</div>

<style>
	.add-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--cg-text-muted);
		cursor: pointer;
		border-radius: var(--cg-radius-control);
	}
	.add-trigger:hover,
	.add-trigger:focus-visible {
		color: var(--cg-text-primary);
	}
	.add-trigger.end {
		justify-self: start;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
		border: 1px dashed var(--cg-border-default);
	}
	/* Between two fields the «+» is a small round mark on the gap, quiet until reached. */
	.add-trigger.between {
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--cg-border-default);
		border-radius: 999px;
		background: var(--cg-bg-surface, var(--cg-bg-raised));
		opacity: 0;
	}
	.add-trigger.between:hover,
	.add-trigger.between:focus-visible {
		opacity: 1;
	}
	/* No hover on touch: the mark stays faintly visible there. */
	@media (hover: none) {
		.add-trigger.between {
			opacity: 0.5;
		}
	}
	.add-panel:popover-open {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.add-panel {
		position: fixed;
		inset: auto;
		margin: 0;
		width: 15rem;
		max-width: calc(100vw - 1rem);
		padding: 0.375rem;
		font-size: var(--cg-text-size-caption);
	}
	.add-kind {
		width: 100%;
		padding: 0.25rem 0.5rem;
		text-align: left;
		border-radius: var(--cg-radius-control);
		cursor: pointer;
	}
	.add-kind:hover,
	.add-kind:focus-visible {
		background: color-mix(in srgb, var(--cg-accent) 12%, transparent);
	}
</style>
