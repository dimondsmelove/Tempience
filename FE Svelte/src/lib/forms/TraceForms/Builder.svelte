<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { tick, untrack } from 'svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { templateDraft, workoutSetupOf, type TemplateId } from '$lib/model/TraceForm/templates';
	import TemplatePicker from './Templates/TemplatePicker.svelte';
	import WorkoutSetup from './Templates/WorkoutSetup.svelte';
	import ScopeEditor from '$lib/context/ScopeEditor/ScopeEditor.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { compileTraceForm, assertFieldEvolution } from '$lib/model/TraceForm/TraceForm';
	import type { TraceFormDraft } from '$lib/model/TraceForm/types';
	import type { BuilderProps, MembershipIntent } from './types';
	import FieldList from './FieldList/FieldList.svelte';
	import LivePreview from './FieldList/LivePreview.svelte';
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
	/** The one field whose settings are open. */
	let open = $state<string | null>(null);
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

	/**
	 * A new Kind starts from what it records (owner, 2026-09-29): a template, the workout's own
	 * short setup, or the builder from scratch; a Kind being edited opens in the builder.
	 */
	let stage = $state<'pick' | 'workout' | 'build'>(
		untrack(() =>
			!published && !initial.fields.length && !initial.name
				? 'pick'
				: workoutSetupOf(initial)
					? 'workout'
					: 'build'
		)
	);
	/** A workout opens as its template screen; the builder is a switch away, both ways. */
	const setup = $derived(workoutSetupOf(draft));
	const pickTemplate = (id: TemplateId | 'scratch'): void => {
		if (id === 'workout') {
			stage = 'workout';
			return;
		}
		if (id !== 'scratch') draft.fields = templateDraft(id, locale.current).fields;
		open = draft.fields[0]?.id ?? null;
		stage = 'build';
	};
	const takeWorkout = (made: TraceFormDraft): void => {
		draft.name = made.name;
		draft.fields = made.fields;
		draft.template = made.template;
		stage = 'build';
	};

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
	class={[
		'grid min-w-0 gap-6',
		compact ? '' : 'builder-wide max-w-6xl',
		newScope && 'nested-editing'
	]}
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
	{#if stage === 'pick'}
		<div class="grid min-w-0 content-start gap-4">
			<TemplatePicker onpick={pickTemplate} />
			{#if oncancel}<Button class="justify-self-start" data-testid={cancelTestId} onclick={oncancel}
					>{t('common.cancel')}</Button
				>{/if}
		</div>
	{:else if stage === 'workout'}
		<div class="grid min-w-0 content-start gap-4">
			<WorkoutSetup
				{busy}
				editing={setup ? ($state.snapshot(draft as unknown) as TraceFormDraft) : undefined}
				setup={setup ?? undefined}
				oncreate={async (made) => {
					takeWorkout(made);
					await save();
				}}
				onbuild={takeWorkout}
				onback={published ? undefined : () => (stage = 'pick')}
			/>
			{#if failure !== null}<p class="text-sm text-[color:var(--cg-danger)]" role="alert">
					{errorText(failure)}
				</p>{/if}
		</div>
	{:else}
		<fieldset disabled={busy} class="grid min-w-0 content-start gap-4 border-0 p-0">
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
			<div class="grid min-w-0 gap-2">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class="text-sm">{t('form.fields')}</span>
					{#if setup}<Button size="sm" onclick={() => (stage = 'workout')}
							>{t('template.toTemplate')}</Button
						>{/if}
				</div>
				{#if !draft.fields.length}<p class="text-sm text-muted">{t('form.emptyKind')}</p>{/if}
				<FieldList bind:fields={draft.fields} bind:open />
			</div>
			{#if compact}
				<details class="min-w-0">
					<summary class="cursor-pointer text-sm text-muted">{t('form.previewLive')}</summary>
					<div class="mt-2"><LivePreview {draft} /></div>
				</details>
			{/if}
			{#if failure !== null}<p class="text-sm text-[color:var(--cg-danger)]" role="alert">
					{errorText(failure)}
				</p>{/if}
			<div class="flex flex-wrap items-center gap-2">
				<Button variant="primary" disabled={busy || !draft.fields.length} onclick={save}
					>{busy ? t('form.saving') : published ? t('kind.saveChanges') : t('form.create')}</Button
				>
				{#if oncancel}
					<Button disabled={busy} data-testid={cancelTestId} onclick={oncancel}
						>{t('common.cancel')}</Button
					>
				{/if}
			</div>
		</fieldset>
		{#if !compact && !newScope}
			<aside class="builder-preview min-w-0"><LivePreview {draft} /></aside>
		{/if}
	{/if}
</div>

<style>
	/* The builder and the record it makes side by side where there is room for both. */
	@media (min-width: 64rem) {
		.builder-wide {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem);
			align-items: start;
		}
		.builder-preview {
			position: sticky;
			top: 1rem;
		}
	}
	/* The nested step alone is laid out; the Kind's blocks keep their DOM and their values. */
	.nested-editing > :global(:not(.nested-editor)) {
		display: none;
	}
</style>
