<script lang="ts">
	import { tick } from 'svelte';
	import ScopeEditor from '$lib/context/ScopeEditor/ScopeEditor.svelte';
	import KindCreator from '$lib/forms/TraceForms/KindCreator.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';

	let { draft }: { draft: TraceDraftState } = $props();
	/** Back to the form: the nested step closes, focus lands on the control that opened it. */
	const back = async (): Promise<void> => {
		const opener = draft.nested === 'scope' ? 'draft-scope-new' : 'draft-kind-new';
		draft.nested = null;
		draft.nestedInput = null;
		await tick();
		document.querySelector<HTMLElement>(`[data-testid="${opener}"]`)?.focus();
	};
</script>

<!-- A nested step of the same open form (TRACE_FORMS «создание и подбор Scope/Kind внутри
     формы»): the form's blocks are hidden, not unmounted, so every value, including text the
     browser has not parsed, waits underneath. Save selects the Scope; a Kind only becomes
     selectable. Cancel returns with nothing changed. -->
<div class="nested-editors grid gap-3" data-testid="nested-editor">
	{#if draft.nested === 'scope'}
		<ScopeEditor
			parentId={null}
			hold={(run) => void draft.hold(run)}
			watch={(dirty) => (draft.nestedInput = dirty)}
			oncancel={back}
			onsaved={(id) => {
				draft.addScope(id);
				return back();
			}}
		/>
	{:else if draft.nested === 'kind'}
		<KindCreator {draft} onreturn={back} />
	{/if}
</div>
