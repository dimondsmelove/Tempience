<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { MODE_LABEL_KEYS, MODE_ORDER } from './constants';
	import type { RecordMode } from './types';

	let {
		value,
		disabled = [],
		onchange
	}: {
		value: RecordMode;
		/** Positions the draft refuses right now, with the reason shown as a title. */
		disabled?: readonly { mode: RecordMode; reason: string }[];
		onchange: (next: RecordMode) => void;
	} = $props();
	const reasonFor = (mode: RecordMode): string | undefined =>
		disabled.find((entry) => entry.mode === mode)?.reason;
</script>

<!-- One row, one chosen position: the record's mode reads before any field is touched. -->
<div
	class="mode-tabs flex flex-wrap gap-1"
	role="group"
	aria-label={t('draft.mode')}
	data-testid="draft-mode"
>
	{#each MODE_ORDER as mode (mode)}
		{@const reason = reasonFor(mode)}
		<Button
			size="sm"
			pressed={value === mode}
			disabled={reason !== undefined}
			title={reason}
			data-mode={mode}
			onclick={() => onchange(mode)}>{t(MODE_LABEL_KEYS[mode])}</Button
		>
	{/each}
</div>
