<script lang="ts">
	import ScopeEditor from './ScopeEditor.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

	let { workbench, parentId }: { workbench: WorkbenchState; parentId: string | null } = $props();
	let isDirty: (() => boolean) | null = null;
	const close = (): void => {
		workbench.forms.newScope = null;
	};
	// The editor's input is under the app's one exit rule: leaving it with changes asks the
	// same question as leaving a record's form (ANSWERS Q8).
	$effect(() => draftGuard.watchInput({ dirty: () => isDirty?.() ?? false, discard: close }));
</script>

<!-- A Scope of its own (ANSWERS, INVENTORY): from the rail as a root, from a Scope as its child.
     The saved Scope opens at once, records or not. -->
<ScopeEditor
	{parentId}
	watch={(dirty) => (isDirty = dirty)}
	oncancel={close}
	onsaved={async (id) => {
		close();
		await workbench.load(loadWorkbenchSnapshot);
		workbench.selectScope(id, 'context');
	}}
/>
