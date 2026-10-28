<script lang="ts">
	import TraceEditor from '$lib/context/TraceEditor/TraceEditor.svelte';
	import { openDraft } from '$lib/state/TraceDraft/open.svelte';
	import type { DraftEntry } from '$lib/state/TraceDraft/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { untrack } from 'svelte';

	let {
		entry,
		tracked,
		onclose
	}: {
		entry: DraftEntry;
		/** The source's activities: a counted record names exactly one of them. */
		tracked: readonly Readonly<{ id: string; name: string }>[];
		onclose: () => void;
	} = $props();
	const id = $props.id();
	const initial = untrack(() => ({ entry, onclose }));
	const draft = openDraft(initial.entry, initial.onclose);
	const open = async (): Promise<void> => onclose();
	const chosen = $derived(
		tracked.filter((item) => draft.selectedScopeIds.includes(item.id)).map((item) => item.id)
	);
	const saveBlock = $derived(
		tracked.length && chosen.length !== 1 ? t('practice.directionRequired') : null
	);
	const choose = (scopeId: string): void => {
		for (const other of chosen) if (other !== scopeId) draft.removeScope(other);
		if (!chosen.includes(scopeId)) draft.addScope(scopeId);
	};
</script>

<section class="practice-editor" aria-label={t('practice.recordEditor')}>
	{#if tracked.length > 1}
		<fieldset class="practice-direction-field" role="radiogroup" aria-required="true">
			<legend
				>{t('practice.direction')}
				<span class="practice-required" aria-hidden="true">*</span></legend
			>
			{#each tracked as item (item.id)}
				<label
					><input
						type="radio"
						name={`${id}-direction`}
						value={item.id}
						checked={chosen.length === 1 && chosen[0] === item.id}
						disabled={draft.phase !== 'editing'}
						onchange={() => choose(item.id)}
					/>{item.name}</label
				>
			{/each}
		</fieldset>
	{/if}
	<TraceEditor {draft} onopen={open} oncancel={onclose} {saveBlock} />
</section>
