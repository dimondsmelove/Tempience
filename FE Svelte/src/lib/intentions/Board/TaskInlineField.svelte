<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { untrack } from 'svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { tempienceRepository } from '$lib/state/triplit';
	import ContextTitle from '$lib/context/ContextTitle/ContextTitle.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { TaskFieldEditing } from './TaskFieldEditing.svelte';
	let {
		id,
		value,
		field,
		onrefresh
	}: { id: string; value: string; field: 'title' | 'description'; onrefresh: () => void } =
		$props();
	const editor = new TaskFieldEditing(
		untrack(() => field),
		async (fields) => {
			await tempienceRepository.saveTraceRecord({ id, fields });
			onrefresh();
		}
	);
	const edit = () => editor.edit(value);
	const cancel = () => editor.cancel();
	const save = () => editor.save();
	const keydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancel();
		} else if (event.key === 'Enter' && event.ctrlKey) {
			event.preventDefault();
			void save();
		}
	};
</script>

{#if editor.editing}
	<div
		class="grid gap-1"
		role="group"
		aria-label={t(field === 'title' ? 'intentions.inlineTitle' : 'intentions.inlineDescription')}
	>
		<textarea
			class="cg-field w-full text-sm"
			rows={field === 'title' ? 2 : 5}
			aria-label={t(field === 'title' ? 'intentions.inlineTitle' : 'intentions.inlineDescription')}
			aria-invalid={editor.invalid || undefined}
			onkeydown={keydown}
			bind:value={editor.text}
			disabled={editor.busy}></textarea>
		{#if editor.invalid}<span role="alert" class="text-sm text-[color:var(--cg-danger)]"
				>{t('intentions.titleRequired')}</span
			>{/if}
		{#if editor.failure}<span role="alert" class="text-sm text-[color:var(--cg-danger)]"
				>{errorText(editor.failure)}</span
			>{/if}
		<div class="flex items-center gap-1">
			<Button size="sm" variant="primary" disabled={editor.busy} onclick={() => void save()}
				>{t('intentions.inlineSave')}</Button
			><Button size="sm" variant="quiet" disabled={editor.busy} onclick={cancel}
				>{t('common.cancel')}</Button
			><span class="font-mono text-xs text-muted">Ctrl+Enter · Esc</span>
		</div>
	</div>
{:else if field === 'title'}
	<div class="task-title">
		<ContextTitle title={value} onclick={edit} actionLabel={t('intentions.inlineTitle')} />
	</div>
{:else if value}
	<button type="button" class="description text-left text-sm whitespace-pre-wrap" onclick={edit}
		>{value}</button
	>
{:else}
	<div class="add-description">
		<Button size="sm" variant="quiet" onclick={edit}>{t('intentions.addDescription')}</Button>
	</div>
{/if}

<style>
	.task-title :global(button) {
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.add-description :global(button) {
		margin-left: calc(-1 * var(--cg-control-padding-x) * 0.833333);
	}
	.description {
		overflow-wrap: anywhere;
		cursor: pointer;
	}
</style>
