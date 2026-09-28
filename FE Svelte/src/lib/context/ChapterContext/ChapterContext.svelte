<script lang="ts">
	import ChapterEditor from '$lib/context/ChapterEditor/ChapterEditor.svelte';
	import ChapterView from '$lib/context/ChapterView/ChapterView.svelte';
	import StageForm from '$lib/context/StageForm/StageForm.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	let { workbench }: { workbench: WorkbenchState } = $props();
	const store = $derived(workbench.chapters);
	const pick = $derived(store.pick);
	const chapter = $derived(store.chapter(pick?.chapterId));
	/** The chapter form while nothing else was chosen since it opened. */
	const editing = $derived(store.formOpen ? store.editing : null);
	const edited = $derived(
		editing && editing.mode !== 'new' ? store.chapter(editing.chapterId) : null
	);
</script>

<!-- The Context of a chapter: one from the history, one of its stages, or the chapter form. -->
{#if editing?.mode === 'new'}
	{#key editing}<ChapterEditor
			{workbench}
			start={editing.start}
			from={store.chapter(editing.fromChapterId)}
		/>{/key}
{:else if editing?.mode === 'edit' && edited}
	{#key edited.id}<ChapterEditor {workbench} chapter={edited} />{/key}
{:else if editing?.mode === 'stage' && edited}
	{#key `${edited.id}:${editing.stageId}`}<StageForm
			{workbench}
			chapter={edited}
			stage={edited.stages.find((stage) => stage.id === editing.stageId) ?? null}
		/>{/key}
{:else if chapter && pick}
	<ChapterView {workbench} {chapter} pick={pick.stage} />
{:else}
	<div class="flex flex-col items-start gap-2 text-sm text-muted">
		<p>{t('chapter.notFound')}</p>
		<Button size="sm" onclick={() => workbench.rest()}>{t('context.rest')}</Button>
	</div>
{/if}
