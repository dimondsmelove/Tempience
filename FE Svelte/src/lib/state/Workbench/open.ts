import { CodedError } from '$lib/model/Errors/CodedError';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { WorkbenchState } from './Workbench.svelte';

/**
 * The reload every form runs once its record is committed. `WorkbenchState.load` catches
 * its loader and resolves with status 'error'; here that is a failed opening: the form keeps
 * its committed id, says the record is saved but not opened, and offers the same reload again.
 * While a Kind's history or the catalog stands in the centre, the timeline behind it is not
 * read again now — the history follows its own records live, the Context reads the record
 * itself — but marked, and read again when it is shown again.
 */
export const reloadForSaved = async (
	workbench: WorkbenchState,
	loader: () => Promise<ExplorerSnapshot>
): Promise<void> => {
	if (workbench.timelineCovered) {
		workbench.markStale();
		return;
	}
	await workbench.load(loader);
	if (workbench.status === 'error') {
		throw (
			workbench.failure ??
			new CodedError('repository_unreadable', 'the workbench could not read the repository')
		);
	}
};

/**
 * What «Записать» does with its committed record: the ribbon reloads under its current
 * window and scale, the form closes, the record becomes the Context (DP7: no reveal).
 */
export const openCapturedTrace = async (
	workbench: WorkbenchState,
	id: string,
	loader: () => Promise<ExplorerSnapshot>
): Promise<void> => {
	await reloadForSaved(workbench, loader);
	workbench.closeCapture();
	workbench.selection.select({ kind: 'trace', traceId: id }, 'canvas');
};
