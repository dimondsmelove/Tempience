<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { ScopePicker, scopeAncestors } from '$lib/ui/ScopePicker';
	import { moveBefore } from './order';
	import type { ScopeFieldProps } from './types';

	let {
		label,
		options,
		ids,
		exclude = ids,
		scopeOf,
		pickerLabel,
		placeholder,
		removeLabel,
		listLabel,
		groups = null,
		onadd,
		onremove,
		onreorder,
		after,
		testId
	}: ScopeFieldProps = $props();
	const labelId = $props.id();
	const nameOf = (id: string): string => scopeOf(id)?.name ?? t('draft.scopeUnavailable');

	/** The chip being dragged, and the one it would land before (null: the end). */
	let dragging = $state<string | null>(null);
	let over = $state<string | null | undefined>(undefined);
	const aim = (event: DragEvent, before: string | null): void => {
		if (!dragging) return;
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		over = before;
	};
	const drop = (event: DragEvent, before: string | null): void => {
		event.preventDefault();
		event.stopPropagation();
		if (dragging && onreorder) onreorder(moveBefore(ids, dragging, before));
		dragging = null;
		over = undefined;
	};
</script>

<!-- A standard Scope field (the record form's): the picker, then the chosen Scopes as chips
     with ×. Where the order means something, a chip is dragged to its place inside the field. -->
<div class="grid gap-1 text-sm" data-testid={testId}>
	<span id={labelId}>{label}</span>
	<div class="flex items-center gap-1">
		<ScopePicker
			scopes={options}
			{groups}
			{exclude}
			label={pickerLabel}
			{placeholder}
			class="min-w-0 flex-1"
			onpick={(id) => {
				if (id) onadd(id);
			}}
		/>
		{@render after?.()}
	</div>
</div>
{#if ids.length}
	<ul
		class={['flex min-w-0 flex-wrap gap-1', onreorder && 'reorderable']}
		aria-label={listLabel}
		data-over={over === null || undefined}
		ondragover={(event) => aim(event, null)}
		ondrop={(event) => drop(event, null)}
	>
		{#each ids as id (id)}
			{@const name = nameOf(id)}
			{@const scope = scopeOf(id)}
			<li
				class="max-w-full min-w-0"
				draggable={onreorder ? 'true' : undefined}
				data-scope-id={id}
				data-dragging={dragging === id || undefined}
				data-over={over === id || undefined}
				ondragstart={(event) => {
					if (!onreorder) return;
					dragging = id;
					event.dataTransfer?.setData('text/plain', id);
					if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
				}}
				ondragend={() => {
					dragging = null;
					over = undefined;
				}}
				ondragover={(event) => aim(event, id)}
				ondrop={(event) => drop(event, id)}
			>
				<ScopeChip
					{id}
					{name}
					colorHue={scope?.colorHue ?? null}
					colorChroma={scope?.colorChroma ?? null}
					colorDepth={scope?.colorDepth ?? null}
					path={scopeAncestors(options, id)}
					removeLabel={removeLabel(name)}
					onremove={() => onremove(id)}
				/>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.reorderable li {
		cursor: grab;
	}
	li[data-dragging] {
		opacity: 0.4;
	}
	li[data-over] {
		box-shadow: -2px 0 0 var(--cg-accent);
	}
	ul[data-over] {
		box-shadow: inset -2px 0 0 var(--cg-accent);
	}
</style>
