import { locale } from '$lib/state/Locale/Locale.svelte';
import { LOAD_TIMING_LOG_TAG } from '$lib/model/LoadTiming/constants';
import { loadTiming } from '$lib/model/LoadTiming/LoadTiming';
import { ensureActiveScenarioSeed } from '$lib/scenarios';
import { tempienceRepository } from '$lib/state/triplit';
import { activeDataSpace, triplit } from '$lib/state/triplit/client';
import { inboundFeed } from '$lib/state/triplit/inbound-sync-instance';
import { versionSummaries } from '$lib/model/TraceForm/summary-fields';
import { displayedTrace } from '$lib/state/Workbench/display';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';

/**
 * The one read path of the Time surface: the repository snapshot of the
 * active data space, after the Belgrade scenario seeded itself if that space
 * is active (the bootstrap skips every other space), and — in a space that
 * syncs — after the server's current rows landed in the local store, so a
 * reload shows what the other devices did (owner, 2026-09-20). Each step is
 * timed (`LoadTiming`) and one summary line is printed when the snapshot is ready.
 */
export const loadWorkbenchSnapshot = async (): Promise<ExplorerSnapshot> => {
	await triplit.ready;
	await loadTiming.span('seed', ensureActiveScenarioSeed);
	// The first load waits for the server, bounded; every later one reads what has arrived.
	await loadTiming.span('inbound', () => inboundFeed.pull());
	const snapshot = await loadTiming.span('snapshot', async () => {
		// The catalogs first: the summary leaves of each version decide how thin its records read.
		const [versions, kinds] = await loadTiming.span('catalogs', () =>
			Promise.all([
				tempienceRepository.listTraceKindVersions(),
				tempienceRepository.listTraceKinds()
			])
		);
		const snapshot = await buildRepositoryExplorerSnapshot(
			tempienceRepository,
			activeDataSpace.id,
			versionSummaries(versions),
			(step, run) => loadTiming.span(step, run)
		);
		const catalog = { kinds, versions };
		const language = locale.current;
		return loadTiming.span('display', async () => ({
			...snapshot,
			catalog,
			traces: snapshot.traces.map((trace) => displayedTrace(trace, catalog, language))
		}));
	});
	console.info(LOAD_TIMING_LOG_TAG, loadTiming.report());
	return snapshot;
};
