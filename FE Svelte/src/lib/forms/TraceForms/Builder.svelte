<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { untrack } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { SECTION_HEADING_CLASS } from '$lib/context/constants';
	import { compileTraceForm, assertFieldEvolution } from '$lib/model/TraceForm/TraceForm';
	import type { TraceFormDraft } from '$lib/model/TraceForm/types';
	import type { BuilderProps, MembershipIntent } from './types';
	import FieldEditor from './FieldEditor.svelte';
	import KindScopes from './KindScopes.svelte';

	let {
		initial,
		published,
		compact = false,
		scopes,
		memberships,
		onsave,
		watch
	}: BuilderProps = $props();
	let draft = $state(
		untrack(() => structuredClone($state.snapshot(initial as unknown) as TraceFormDraft))
	);
	const initialSignature = untrack(() => JSON.stringify(draft));
	// What the user did not touch is not sent: a Kind a Scope deletion left unscoped keeps its restore.
	let intent = $state<MembershipIntent>(
		untrack(() => ({ scopeIds: [...(memberships ?? [])], explicit: false }))
	);
	let busy = $state(false);
	/** The last refusal of the compiler or the save, read in the language of the moment. */
	let failure = $state.raw<unknown>(null);
	/** Input its save has not taken: changed fields or name, or a chosen membership. */
	const dirty = $derived(intent.explicit || JSON.stringify(draft) !== initialSignature);
	// The owner of a nested step reads this as the form's exit rule needs it.
	untrack(() => watch)?.(() => dirty);
	function compile() {
		const definition = compileTraceForm($state.snapshot(draft as unknown) as TraceFormDraft);
		if (published) assertFieldEvolution(published, definition);
		return definition;
	}

	const save = async () => {
		if (busy) return;
		busy = true;
		failure = null;
		try {
			await onsave(draft.name, compile(), $state.snapshot(intent));
		} catch (cause) {
			failure = cause ?? new Error();
		} finally {
			busy = false;
		}
	};
</script>

<!-- Name and fields, then the Kind's Scopes as a part of their own; the preview is gone —
     the save validates the same way (owner, 2026-09-15). -->
<div class={['grid min-w-0 gap-4', compact ? '' : 'max-w-2xl']} data-testid="form-builder">
	<h2 class="text-lg font-semibold">{published ? t('form.editing') : t('form.new')}</h2>
	<fieldset disabled={busy} class="grid min-w-0 gap-4 border-0 p-0">
		<label class="grid gap-1 text-sm"
			>{t('form.kindName')}<input
				class="cg-control cg-field"
				bind:value={draft.name}
				placeholder={t('form.kindNamePlaceholder')}
			/></label
		>
		<FieldEditor bind:fields={draft.fields} />
		{#if scopes}
			<section class="grid gap-2 border-t border-outline pt-3">
				<h3 class={SECTION_HEADING_CLASS}>{t('kind.scopes')}</h3>
				<KindScopes {scopes} value={intent} onchange={(next) => (intent = next)} />
			</section>
		{/if}
		{#if failure !== null}<p class="text-sm text-[color:var(--cg-danger)]" role="alert">
				{errorText(failure)}
			</p>{/if}
		<div class="flex flex-wrap gap-2">
			<Button variant="primary" disabled={busy} onclick={save}
				>{busy ? t('form.saving') : published ? t('kind.saveChanges') : t('form.create')}</Button
			>
		</div>
	</fieldset>
</div>
