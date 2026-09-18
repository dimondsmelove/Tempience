<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { untrack } from 'svelte';
	import TraceEditor from '$lib/context/TraceEditor/TraceEditor.svelte';
	import { openDraft } from '$lib/state/TraceDraft/open.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { openCapturedTrace } from '$lib/state/Workbench/open';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

	let { workbench }: { workbench: WorkbenchState } = $props();
	// The entry context of this opening: read once, a later change is a new opening (Context keys it).
	const preset = untrack(() => workbench.forms.capturePreset);
	const initialScopeId = untrack(
		() =>
			// Only an entry that names a Scope — «Записать сюда», a Kind's history — starts with one;
			// neither an open Scope nor a selected record lends theirs (TRACE_FORMS, 2026-09-15).
			preset?.scopeId ?? ''
	);
	// A Context action's start takes the parent's direct Scopes; the draft reads them itself.
	const draft = openDraft(
		{
			mode: 'create',
			...(preset?.start ? {} : { scopeIds: initialScopeId ? [initialScopeId] : [] }),
			kindId: preset?.kindId,
			versionId: preset?.versionId,
			preset: preset?.start
		},
		() => (workbench.capture = false)
	);
	/** The saved record becomes the Context through the real reload; a failed read is a failed opening. */
	const open = (id: string): Promise<void> =>
		openCapturedTrace(workbench, id, loadWorkbenchSnapshot);
</script>

<section class="grid gap-3" data-testid="context-capture" aria-label={t('context.capture')}>
	<!-- A nested step carries its own heading; two headings over one form read as two forms. -->
	{#if !draft.nested}<h2 class="text-lg font-semibold">{t('context.capture')}</h2>{/if}
	<TraceEditor {draft} onopen={open} oncancel={() => workbench.cancelCapture()} />
</section>
