<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { untrack } from 'svelte';
	import TraceEditor from '$lib/context/TraceEditor/TraceEditor.svelte';
	import { openDraft } from '$lib/state/TraceDraft/open.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { reloadForSaved } from '$lib/state/Workbench/open';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';

	let {
		workbench,
		trace,
		onclose
	}: { workbench: WorkbenchState; trace: ExplorerTrace; onclose: () => void } = $props();
	// The draft loads the full repository record by id, not the projection the ribbon shows.
	const draft = openDraft({ mode: 'edit', traceId: untrack(() => trace.id) }, () => onclose());
	/** The edited record stays selected; the real reload shows it in place of the form. */
	const open = async (): Promise<void> => {
		await reloadForSaved(workbench, loadWorkbenchSnapshot);
		onclose();
	};
</script>

<section data-testid="edit-trace-form" aria-label={t('context.editForm')}>
	<TraceEditor {draft} onopen={open} oncancel={onclose} />
</section>
