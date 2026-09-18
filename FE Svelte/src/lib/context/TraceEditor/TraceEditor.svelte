<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import DraftDataForm from '$lib/forms/TraceForms/DraftDataForm.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { savedPlacement } from '$lib/state/TraceDraft/placement';
	import type { DraftField, DraftIssue } from '$lib/state/TraceDraft/types';
	import NestedEditors from './NestedEditors.svelte';
	import ResultFields from './ResultFields.svelte';
	import SaveControls from './SaveControls.svelte';
	import ScopeFields from './ScopeFields.svelte';
	import SupplementFields from './SupplementFields.svelte';
	import TimeFields from './TimeFields.svelte';
	import type { RecordMode, TraceEditorProps } from './types';
	import KindFields from './KindFields.svelte';
	import ModeTabs from './ModeTabs.svelte';

	let { draft, onopen, oncancel }: TraceEditorProps = $props();
	const id = $props.id();
	const locked = $derived(draft.phase !== 'editing' || draft.diagnostic !== null);
	const existing = $derived(savedPlacement(draft.saved) ?? undefined);
	const titleIssue = $derived(draft.issueFor('title'));
	const preset = $derived(draft.entry.mode === 'create' ? draft.entry.preset : undefined);
	const supplement = $derived(preset?.kind === 'supplement' || draft.supplement !== null);
	const repairRelation = $derived(draft.supplement?.status === 'intention');
	const supplementOriginal = $derived(preset?.kind === 'supplement' ? preset.originalId : null);
	const parentId = $derived(preset?.kind === 'part' ? preset.wholeId : null);
	const parentTitle = $derived(
		parentId ? (draft.results.rowOf(parentId)?.summary.title ?? t('draft.presetParent')) : ''
	);

	/**
	 * The third position of the switch is interface only: a fact the user states as the result
	 * of an intention. In the data it stays a fact plus evidence_for links (TRACE_FORMS «режим записи»).
	 * A form that already names intentions (an entry from one, a saved fact with results) starts there.
	 */
	let evidence = $state(false);
	const mode: RecordMode = $derived(
		draft.relation === 'intend'
			? 'intend'
			: evidence || draft.results.targets.length > 0
				? 'evidence'
				: 'actual'
	);
	const modeSwitch = $derived(!supplement || repairRelation);
	const modeDisabled = $derived.by(() => {
		const out: { mode: RecordMode; reason: string }[] = [];
		const blocked = draft.blockedRelation;
		if (blocked?.relation === 'intend')
			out.push({
				mode: 'intend',
				reason: t('draft.relationBlockedIntend', { title: blocked.role.otherTitle })
			});
		if (blocked?.relation === 'actual') {
			const reason = t('draft.relationBlockedActual', { title: blocked.role.otherTitle });
			out.push({ mode: 'actual', reason }, { mode: 'evidence', reason });
		}
		if (draft.typed) out.push({ mode: 'intend', reason: t('draft.modeTypedFact') });
		return out;
	});
	const chooseMode = (next: RecordMode): void => {
		if (next === 'intend') {
			evidence = false;
			draft.setRelation('intend');
			return;
		}
		if (draft.relation !== 'actual') draft.setRelation('actual');
		evidence = next === 'evidence';
		// Leaving the evidence position withdraws the choice: a plain fact names no intention.
		if (next === 'actual')
			for (const target of draft.results.targets) draft.results.remove(target.otherId);
	};
	/**
	 * A message that appeared while the pointer is down would move the control under it, and the
	 * click would land elsewhere: leaving a field by clicking waits for the release to say anything
	 * new. What was already shown when the pointer went down stays exactly where it was.
	 */
	let heldSince = $state.raw<ReadonlySet<DraftField> | null>(null);
	const ISSUE_FIELDS: readonly DraftField[] = ['title', 'data', 'time'];
	const holdMessages = (): void => {
		heldSince = new Set(ISSUE_FIELDS.filter((field) => draft.issueFor(field) !== null));
	};
	const releaseMessages = (): void => {
		heldSince = null;
	};
	const shown = (entry: DraftIssue): boolean => heldSince === null || heldSince.has(entry.field);
	/**
	 * The first field takes focus once the panel that holds it is laid out, not before; a field of
	 * this form that was reached in the meantime keeps it.
	 */
	const focus = (node: HTMLElement) => {
		const frame = requestAnimationFrame(() => {
			const form = node.closest('[data-testid="trace-editor"]');
			if (!form?.contains(document.activeElement)) node.focus();
		});
		return () => cancelAnimationFrame(frame);
	};
</script>

<!-- A message takes room only while it exists and never moves the field: the title's sits in
     its label row, a field without a label row gets a one-line addition beneath (TRACE_FORMS,
     owner decision 2026-09-15). Nothing is reserved in advance. -->
<svelte:window onpointerup={releaseMessages} onpointercancel={releaseMessages} />

{#snippet issue(entry: DraftIssue | null, where: 'label' | 'below')}
	{#if entry && shown(entry)}
		<span class={['issue', where === 'below' && 'block']} role="alert">{t(entry.key)}</span>
	{/if}
{/snippet}

{#snippet required()}<span class="text-[color:var(--cg-danger)]" aria-hidden="true">*</span
	>{/snippet}

<div
	class={[
		'trace-editor grid min-w-0 gap-3',
		draft.timeEditing && 'time-editing',
		draft.nested && 'nested-editing'
	]}
	data-testid="trace-editor"
	data-nested={draft.nested ?? undefined}
	onpointerdowncapture={holdMessages}
>
	{#if draft.nested}<NestedEditors {draft} />{/if}
	{#if draft.phase === 'loading'}<p class="text-sm text-muted">{t('draft.loading')}</p>{/if}
	{#if draft.diagnostic}
		<p role="alert" class="text-sm" data-testid="draft-diagnostic">
			{t(draft.diagnostic, { message: draft.failure ? errorText(draft.failure.cause) : '' })}
		</p>
	{/if}
	<fieldset disabled={locked} class="grid min-w-0 gap-3 border-0 p-0">
		{#if supplement}
			<SupplementFields {draft} originalId={supplementOriginal} />
		{:else if parentId}
			<p class="text-sm text-muted" data-testid="draft-preset">
				{t('draft.presetPart', { title: parentTitle })}
			</p>
		{/if}
		{#if !draft.typed}
			<div class="grid gap-1 text-sm">
				<div class="flex flex-wrap items-baseline gap-x-2">
					<span><label for={`${id}-title`}>{t('draft.title')}</label> {@render required()}</span>
					{@render issue(titleIssue, 'label')}
				</div>
				<input
					id={`${id}-title`}
					class="cg-control cg-field"
					type="text"
					required
					data-testid="draft-title"
					aria-invalid={titleIssue ? 'true' : undefined}
					bind:value={draft.title}
					onblur={() => draft.touch('title')}
					{@attach focus}
				/>
			</div>
		{:else if draft.version}
			{#key draft.versionId}
				<DraftDataForm
					{draft}
					version={draft.version}
					label={t('draft.typedFields')}
					disabled={locked}
				/>
			{/key}
			{@render issue(draft.issueFor('data'), 'below')}
		{:else if draft.phase !== 'loading'}
			<p class="text-sm text-muted">{t('draft.versionRequired')}</p>
		{/if}
		<label class="grid gap-1 text-sm"
			>{t('draft.description')}
			<textarea
				class="cg-control cg-field min-h-20"
				data-testid="draft-description"
				aria-label={t('draft.description')}
				bind:value={draft.description}
				onblur={() => draft.touch('description')}></textarea>
		</label>
		<ScopeFields {draft} />
		<KindFields {draft} />
		{#if modeSwitch}
			<ModeTabs value={mode} disabled={modeDisabled} onchange={chooseMode} />
		{/if}
		{#if mode === 'evidence' && !supplement}<ResultFields {draft} />{/if}
		{#if !supplement}
			<TimeFields
				bind:draft={
					() => draft.time,
					(next) => {
						draft.time = next;
						draft.touch('time');
					}
				}
				bind:open={draft.timeEditing}
				{existing}
			/>
			{@render issue(draft.issueFor('time'), 'below')}
		{/if}
	</fieldset>
	<SaveControls
		{draft}
		onsave={() => void draft.save(onopen)}
		oncancel={() => draftGuard.exit(oncancel)}
	/>
</div>

<style>
	.issue {
		font-size: 0.75rem;
		line-height: 1.2;
		color: var(--cg-danger);
	}
	.time-editing,
	.time-editing > fieldset {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		gap: 0;
	}
	.time-editing > :global(:not(fieldset)),
	.time-editing > fieldset > :global(:not(.time-fields)) {
		display: none;
	}
	.nested-editing > :global(:not(.nested-editors)) {
		display: none;
	}
</style>
