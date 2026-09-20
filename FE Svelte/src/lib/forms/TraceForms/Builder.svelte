<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { tick, untrack } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import ScopeEditor from '$lib/context/ScopeEditor/ScopeEditor.svelte';
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
		watch,
		hold
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
	/** A Scope being made inside this form (pack 4, C); the Kind's own input stays as it is. */
	let newScope = $state(false);
	/** How the open Scope editor answers whether it holds input a save has not taken yet. */
	let nestedInput = $state.raw<(() => boolean) | null>(null);
	/** Input its save has not taken: changed fields or name, a chosen membership, or the nested step's own. */
	const dirty = $derived(
		intent.explicit || JSON.stringify(draft) !== initialSignature || (nestedInput?.() ?? false)
	);
	/** Back from the nested step: focus lands on the «+» that opened it. */
	const back = async (): Promise<void> => {
		newScope = false;
		nestedInput = null;
		await tick();
		document.querySelector<HTMLElement>('[data-testid="kind-scope-new"]')?.focus();
	};
	/** The Scope made in the nested step is chosen for the Kind as it returns. */
	const scopeMade = (id: string): Promise<void> => {
		if (!intent.scopeIds.includes(id))
			intent = { scopeIds: [...intent.scopeIds, id], explicit: true };
		return back();
	};
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
     the same way (owner, 2026-09-15). The page owns the heading when the form is compact.
     A Scope made from the «+» is a nested step of this same form (TRACE_FORMS «создание и
     подбор Scope/Kind внутри формы»): the Kind's blocks are hidden, not unmounted, so every
     value waits underneath; the saved Scope is chosen on return, a cancel changes nothing. -->
<div
	class={['grid min-w-0 gap-4', compact ? '' : 'max-w-2xl', newScope && 'nested-editing']}
	data-testid="form-builder"
	data-nested={newScope ? 'scope' : undefined}
>
	{#if newScope}
		<div class="nested-editor grid gap-3" data-testid="kind-nested-scope">
			<ScopeEditor
				parentId={null}
				{hold}
				watch={(reader) => (nestedInput = reader)}
				oncancel={back}
				onsaved={scopeMade}
			/>
		</div>
	{/if}
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
					<KindScopes
						{scopes}
						value={intent}
						onchange={(next) => (intent = next)}
						onnew={() => (newScope = true)}
					/>
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

<style>
	/* The nested step alone is laid out; the Kind's blocks keep their DOM and their values. */
	.nested-editing > :global(:not(.nested-editor)) {
		display: none;
	}
</style>
