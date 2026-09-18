<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { untrack } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
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
		oncancel,
		cancelTestId = 'builder-cancel',
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

<!-- What the Kind is, then what it holds: name and Scopes first, the fields as cards under
     them, the two buttons on one line at the end. The preview is gone — the save validates
     the same way (owner, 2026-09-15). The page owns the heading when the form is compact. -->
<div class={['grid min-w-0 gap-4', compact ? '' : 'max-w-2xl']} data-testid="form-builder">
	{#if !compact}<h2 class="text-lg font-semibold">
			{published ? t('form.editing') : t('form.new')}
		</h2>{/if}
	<fieldset disabled={busy} class="grid min-w-0 gap-4 border-0 p-0">
		<div class="grid min-w-0 gap-3">
			<label class="grid gap-1 text-sm"
				>{t('form.kindName')}<input
					class="cg-control cg-field"
					bind:value={draft.name}
					placeholder={t('form.kindNamePlaceholder')}
				/></label
			>
			{#if scopes}
				<div class="grid gap-1 text-sm">
					<span>{t('kind.scopes')}</span>
					<KindScopes {scopes} value={intent} onchange={(next) => (intent = next)} />
				</div>
			{/if}
		</div>
		<FieldEditor bind:fields={draft.fields} />
		{#if failure !== null}<p class="text-sm text-[color:var(--cg-danger)]" role="alert">
				{errorText(failure)}
			</p>{/if}
		<div class="flex flex-wrap items-center gap-2">
			<Button variant="primary" disabled={busy} onclick={save}
				>{busy ? t('form.saving') : published ? t('kind.saveChanges') : t('form.create')}</Button
			>
			{#if oncancel}
				<Button disabled={busy} data-testid={cancelTestId} onclick={oncancel}
					>{t('common.cancel')}</Button
				>
			{/if}
		</div>
	</fieldset>
</div>
