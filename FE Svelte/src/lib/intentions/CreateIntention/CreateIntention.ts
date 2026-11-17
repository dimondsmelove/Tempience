import type { TempienceRepository } from '$lib/state/triplit/repository';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { planPlacement } from '../MoveIntention/MoveIntention';
import type { MoveTarget } from '../MoveIntention/types';

export const createIntention = async (
	repository: TempienceRepository,
	options: {
		title: string;
		zone: string;
		now: number;
		scopeIds?: readonly string[];
	} & ({ parentId: string; target?: MoveTarget } | { parentId?: undefined; target: MoveTarget })
) => {
	const title = options.title.trim();
	if (!title) return { ok: false as const, reason: 'empty' as const };
	let memberships: string[] = [];
	if (options.parentId !== undefined) {
		const parent = await repository.getTrace(options.parentId);
		if (!parent) return { ok: false as const, reason: 'parent_not_found' as const };
		if (!isIntentionRelation(parent.relation))
			return { ok: false as const, reason: 'parent_not_intention' as const };
		const [traces, intersections, assessments] = await Promise.all([
			repository.listTraces(true),
			repository.listIntersections(true),
			repository.listIntentionAssessments(true)
		]);
		const result = evaluateIntention(parent.id, assessments, {
			tracesById: new Map(traces.map((trace) => [trace.id, trace])),
			intersectionsById: new Map(intersections.map((link) => [link.id, link]))
		});
		if (!result.open.value) return { ok: false as const, reason: 'parent_closed' as const };
		memberships = intersections
			.filter((link) => !link.isDeleted && link.kind === 'belongs_to' && link.fromId === parent.id)
			.map((link) => link.toId);
	}
	if (options.scopeIds !== undefined) memberships = [...new Set(options.scopeIds)];
	const placement = planPlacement(
		{ aboutTime: null },
		options.target ?? { kind: 'undated' },
		options.zone
	);
	if (!placement.ok) return placement;
	const result = await repository.saveTraceRecord({
		...(options.parentId !== undefined
			? {
					links: { add: [{ kind: 'part_of' as const, wholeId: options.parentId }] }
				}
			: {}),
		memberships: { add: memberships },
		fields: {
			title,
			relation: 'intend',
			capturedAt: new Date(options.now).toISOString(),
			timezone: options.zone,
			...placement.fields
		}
	});
	return { ok: true as const, trace: result.trace };
};
