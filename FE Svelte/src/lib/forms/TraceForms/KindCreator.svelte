<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { untrack } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { newTraceField } from '$lib/model/TraceForm/TraceForm';
	import { NestedSave } from '$lib/state/TraceDraft/nested.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { TraceKindVDraft } from '$lib/state/triplit/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import Builder from './Builder.svelte';
	import type { KindSaveResult } from './kind-save';
	import { saveNestedKind } from './nested-kind';
	import type { MembershipIntent } from './types';

	let { draft, onreturn }: { draft: TraceDraftState; onreturn: () => void | Promise<void> } =
		$props();
	// The new Kind starts with the form's own Scopes shown as its memberships: visible, changeable.
	const memberships = untrack(() => [...draft.selectedScopeIds]);
	/**
	 * The Kind commits with its memberships in one transaction and is latched as the repository
	 * returns it; the form holds this step as pending, so no exit overtakes it. The return only
	 * makes the Kind selectable — it chooses nothing — and can be repeated if it failed.
	 */
	const saving = new NestedSave<KindSaveResult>((run) => void draft.hold(run));
	const save = async (
		name: string,
		definition: TraceKindVDraft,
		intent: MembershipIntent
	): Promise<void> => {
		await saveNestedKind(
			saving,
			repository,
			draft,
			{ name, definition, memberships: intent },
			onreturn
		);
		// A refused write is the Builder's own message; every value stays for the next attempt.
		if (saving.failure?.stage === 'write') throw saving.failure.cause;
	};
</script>

<!-- One heading over the nested step; the Builder carries «Создать» and «Отмена» together. -->
<section class="grid gap-3" data-testid="nested-kind" aria-label={t('draft.kindNew')}>
	<h2 class="text-lg font-semibold">{t('draft.kindNew')}</h2>
	{#if saving.failure?.stage === 'return'}
		<p role="alert" class="text-sm" data-testid="kind-saved-not-returned">
			{t('nested.savedNotReturned', { message: errorText(saving.failure.cause) })}
		</p>
		<div class="flex flex-wrap gap-2">
			<Button variant="primary" data-testid="kind-retry-return" onclick={() => void saving.retry()}
				>{t('nested.retryReturn')}</Button
			>
			<Button variant="quiet" data-testid="nested-cancel" onclick={onreturn}
				>{t('draft.cancel')}</Button
			>
		</div>
	{:else}
		<Builder
			compact
			initial={{ name: '', fields: [newTraceField()] }}
			scopes={draft.scopeList}
			{memberships}
			onsave={save}
			oncancel={onreturn}
			cancelTestId="nested-cancel"
			watch={(dirty) => (draft.nestedInput = dirty)}
			hold={(run) => void draft.hold(run)}
		/>
	{/if}
</section>
