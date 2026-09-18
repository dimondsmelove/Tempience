import { onDestroy } from 'svelte';
import { schemaDefaults } from '$lib/forms/TraceForms/runtime';
import { tempienceRepository } from '$lib/state/triplit';
import { draftGuard } from './guard.svelte';
import { TraceDraftState } from './TraceDraft.svelte';
import type { DraftEntry } from './types';

/**
 * A fresh form for the lifetime of the component that opens it: loaded from the app
 * repository, known to the exit guard, disposed with the component. Every entry point
 * opens its draft this way, so no two owners of one input exist. When the input ends
 * elsewhere — an exit confirmed on a route change, a Context close — `ended` closes the
 * entry point's own state too, so the form never lingers or reopens by itself.
 */
export const openDraft = (entry: DraftEntry, ended?: () => void): TraceDraftState => {
	const draft = new TraceDraftState(entry, {
		repository: tempienceRepository,
		defaults: schemaDefaults
	});
	if (ended) draft.onEnd(ended);
	const unregister = draftGuard.register(draft);
	void draft.load();
	onDestroy(() => {
		unregister();
		draft.dispose();
	});
	return draft;
};
