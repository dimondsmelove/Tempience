import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { planDeleteIntention } from './plan';

/** Build the confirmation plan from the active board snapshot only. */
export const planFromSnapshot = (snapshot: ExplorerSnapshot, id: string) =>
	planDeleteIntention(
		id,
		'all',
		snapshot.traces.map((trace) => ({
			id: trace.id,
			isIntention: isIntentionRelation(trace.relation)
		})),
		snapshot.intersections
			.filter((link) => link.kind === 'part_of')
			.map(({ fromId, toId }) => ({ fromId, toId }))
	);
