import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { RecordsReader } from '$lib/state/Records/Records.svelte';
import { reloadForSaved } from '$lib/state/Workbench/open';
import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

/**
 * Reading what a Context command changed: the timeline of the workbench and the record's own
 * rows. Both owners answer a refused read by keeping it in their own state rather than by
 * rejecting — the workbench with `status === 'error'`, the reader with its `error` — so this
 * turns either into the one refusal a caller can act on. Without it a command would look as
 * if it had failed, or as if it had shown its result when it had not.
 */
export const readContext = async (
	workbench: WorkbenchState,
	records: RecordsReader,
	loader: () => Promise<ExplorerSnapshot>
): Promise<void> => {
	await reloadForSaved(workbench, loader);
	await records.reload();
	if (records.failure !== null) throw records.failure;
};
