<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';

	type Props = Readonly<{
		/** What the row shows: the owner's name, or the auto-name «X +N» (Q1-A). */
		name: string;
		/** The auto-name, for the editor's placeholder; empty input returns to it. */
		autoName: string;
		/** The owner's name if set: what the editor starts from. */
		ownerName: string | null;
		/** The full composition, «Белград · Люди · Место проживания», as the tooltip. */
		composition: string;
		lit: boolean;
		/** The name flashes once after a Context or history navigation (loop 008, C3). */
		pulse?: boolean;
		/** The name is also the drag handle of its row. */
		handle: boolean;
		/** The row is the one shown in the Context (C5). */
		selected?: boolean;
		/** A click or Enter on the name: the row's Context (C5). */
		onselect: () => void;
		onrename: (name: string | null) => void;
	}>;
	let {
		name,
		autoName,
		ownerName,
		composition,
		lit,
		pulse = false,
		handle,
		selected = false,
		onselect,
		onrename
	}: Props = $props();

	let editing = $state(false);
	let value = $state('');
	let button = $state<HTMLButtonElement | null>(null);
	const start = (): void => {
		value = ownerName ?? '';
		editing = true;
	};
	/** Enter saves (an empty name clears to the auto-name), Esc cancels, leaving the field saves too. */
	const finish = (save: boolean, refocus: boolean): void => {
		if (!editing) return;
		editing = false;
		const next = value.trim();
		if (save && next !== (ownerName ?? '')) onrename(next || null);
		if (refocus) void tick().then(() => button?.focus());
	};
</script>

<!-- A click on the name, or Enter on it, opens the row's own Context (C5); a double click, or F2
     on the focused name, renames it (C2, Q1-A). -->
{#if editing}
	<input
		type="text"
		class="cg-field cg-control cg-control-sm my-1 min-w-0 flex-1 px-1 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
		aria-label={t('rail.rename', { name })}
		placeholder={autoName}
		bind:value
		data-testid="rail-rename-input"
		{@attach (input) => {
			input.focus();
			input.select();
		}}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				finish(true, true);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				finish(false, true);
			}
		}}
		onblur={() => finish(true, false)}
	/>
{:else}
	<button
		type="button"
		bind:this={button}
		class={[
			'min-w-0 flex-1 truncate py-2 text-left focus-visible:outline-2 focus-visible:outline-accent',
			handle && 'handle',
			lit ? 'font-semibold' : 'font-medium',
			pulse && 'pulse'
		]}
		aria-label={t('rail.selectRow', { name })}
		aria-pressed={selected}
		title={composition}
		data-handle={handle ? '' : undefined}
		data-testid="rail-lane-name"
		onclick={onselect}
		ondblclick={start}
		onkeydown={(event) => {
			if (event.key !== 'F2') return;
			event.preventDefault();
			start();
		}}>{name}</button
	>
{/if}

<style>
	.handle {
		cursor: grab;
	}
</style>
