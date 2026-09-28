<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import NoteStatus from './NoteStatus.svelte';
	import type { ContextNoteProps } from './types';

	let { text, editor, labels, testId, textTestId }: ContextNoteProps = $props();
</script>

<!-- A Context's note: the text as written; where it is written in place, its edit, save and
     cancel, and what the last save said. -->
<div class="flex flex-col gap-1" data-testid={testId}>
	{#if editor?.editing && labels}
		<textarea
			class="cg-field min-h-24 w-full text-sm"
			aria-label={labels.note}
			bind:value={editor.draft}
			disabled={editor.busy}></textarea>
		<div class="flex gap-1">
			<Button size="sm" variant="primary" disabled={editor.busy} onclick={() => editor.save()}
				>{labels.save}</Button
			>
			<Button size="sm" variant="quiet" disabled={editor.busy} onclick={() => editor.cancel()}
				>{t('common.cancel')}</Button
			>
		</div>
	{:else}
		<p class="text-sm whitespace-pre-wrap" data-testid={textTestId}>{text}</p>
		{#if editor && labels}<div>
				<Button size="sm" variant="quiet" onclick={() => editor.edit()}>{labels.edit}</Button>
			</div>{/if}
	{/if}
	{#if editor}<NoteStatus {editor} />{/if}
</div>
