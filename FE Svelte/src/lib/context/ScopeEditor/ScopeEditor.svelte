<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { onMount, untrack } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { NestedSave } from '$lib/state/TraceDraft/nested.svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { Scope } from '$lib/state/triplit/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import { ScopePicker, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { browser } from '$app/environment';
	import type { ScopeColour } from '$lib/theme/scope-colour';
	import ColorBlossomPicker from './ColorBlossomPicker/ColorBlossomPicker.svelte';
	import ColorHuePicker from './ColorHuePicker/ColorHuePicker.svelte';
	import type { ScopeEditorProps } from './types';
	import { ROOT_SCOPE_KEY } from './constants';
	let { scope, parentId = null, onsaved, oncancel, hold, watch }: ScopeEditorProps = $props();
	let name = $state(untrack(() => scope?.name ?? ''));
	let note = $state(untrack(() => scope?.note ?? ''));
	let parent = $state(untrack(() => parentId));
	let colorHue = $state<number | null>(untrack(() => scope?.colorHue ?? null));
	let colorChroma = $state<number | null>(untrack(() => scope?.colorChroma ?? null));
	let colorDepth = $state<number | null>(untrack(() => scope?.colorDepth ?? null));
	let scopes = $state.raw<Scope[]>([]);
	/** The parents offered: every other Scope, in the tree the timeline knows. */
	const options = $derived(
		scopeOptionsOf(
			scopes.filter((entry) => entry.id !== scope?.id),
			workbench.view.intersections
		)
	);
	let failure = $state.raw<unknown>(null);
	// The write commits once; the committed id is latched before whoever opened this is told.
	const saving = new NestedSave<string>((run) => hold?.(run));
	const dirty = $derived(
		name.trim() !== (scope?.name ?? '') ||
			note.trim() !== (scope?.note ?? '') ||
			parent !== (parentId ?? null) ||
			colorHue !== (scope?.colorHue ?? null) ||
			colorChroma !== (scope?.colorChroma ?? null) ||
			colorDepth !== (scope?.colorDepth ?? null)
	);
	// The owner of a nested step reads this as the form's exit rule needs it.
	untrack(() => watch)?.(() => dirty);
	const pickColour = (colour: ScopeColour | null): void => {
		colorHue = colour?.hue ?? null;
		colorChroma = colour?.chroma ?? null;
		colorDepth = colour?.depth ?? null;
	};
	onMount(() =>
		repository.subscribeScopes(
			(rows) => {
				scopes = rows;
			},
			(cause) => {
				failure = cause ?? new Error();
			}
		)
	);
	const save = () =>
		saving.run(
			async () => {
				const patch = {
					name: name.trim(),
					note: note.trim() || null,
					parentScopeId: parent,
					colorHue,
					colorChroma,
					colorDepth
				};
				const result = scope
					? await repository.editScope(scope.id, patch)
					: await repository.createScope(patch);
				return result.id;
			},
			(id) => onsaved(id)
		);
</script>

{#snippet plainPicker()}
	<ColorHuePicker
		hue={colorHue}
		chroma={colorChroma}
		depth={colorDepth}
		label={t('scope.colour')}
		testId="scope-colour"
		onpick={pickColour}
	/>
{/snippet}

<section
	class="grid gap-3"
	data-testid="scope-editor"
	aria-label={scope ? t('scope.edit') : t('scope.new')}
>
	<h2 class="text-lg font-semibold">{scope ? t('scope.edit') : t('scope.new')}</h2>
	<fieldset disabled={saving.busy} class="grid min-w-0 gap-3 border-0 p-0">
		<label class="grid gap-1 text-sm"
			>{t('scope.name')}<input class="cg-control cg-field" bind:value={name} /></label
		>
		<label class="grid gap-1 text-sm"
			>{t('scope.note')}<textarea class="cg-control cg-field" bind:value={note}></textarea></label
		>
		<!-- The colour: the Blossom flower (owner 2026-09-19); the plain bars stand in where the
		     flower cannot mount — off the browser, or should the library fail. -->
		<svelte:boundary>
			{#if browser}
				<ColorBlossomPicker
					hue={colorHue}
					chroma={colorChroma}
					depth={colorDepth}
					label={t('scope.colour')}
					testId="scope-colour"
					onpick={pickColour}
				/>
			{:else}
				{@render plainPicker()}
			{/if}
			{#snippet failed()}{@render plainPicker()}{/snippet}
		</svelte:boundary>
		<div class="grid gap-1 text-sm">
			<span id="scope-parent-label">{t('scope.parent')}</span>
			<ScopePicker
				scopes={options}
				value={parent}
				none={t(ROOT_SCOPE_KEY)}
				label={t('scope.parent')}
				testId="scope-parent"
				onpick={(id) => (parent = id)}
			/>
		</div>
		{#if failure !== null}<p role="alert" class="text-sm">{errorText(failure)}</p>{/if}
		{#if saving.failure?.stage === 'write'}<p role="alert" class="text-sm">
				{errorText(saving.failure.cause)}
			</p>{/if}
		{#if saving.failure?.stage === 'return'}
			<p role="alert" class="text-sm" data-testid="scope-saved-not-returned">
				{t('nested.savedNotReturned', { message: errorText(saving.failure.cause) })}
			</p>
		{/if}
		<div class="flex flex-wrap gap-2">
			{#if saving.committed !== null}
				<Button variant="primary" data-testid="scope-retry-return" onclick={save}
					>{t('nested.retryReturn')}</Button
				>
			{:else}
				<Button variant="primary" disabled={!name.trim() || saving.busy} onclick={save}
					>{t('scope.save')}</Button
				>
			{/if}
			<Button onclick={oncancel}>{t('common.cancel')}</Button>
		</div>
	</fieldset>
</section>
