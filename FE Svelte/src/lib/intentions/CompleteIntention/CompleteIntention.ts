import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import { compareAssessmentInstants } from '$lib/state/triplit/IntentionAssessments/read';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type { CompleteOptions, CompleteResult, RevertCompletionResult } from './types';

/** Record the completed intention and its assessment as one journalled action. */
export const completeIntention = async (
	repository: TempienceRepository,
	traceId: string,
	{ now, zone }: CompleteOptions
): Promise<CompleteResult> => {
	const snapshot = await buildRepositoryExplorerSnapshot(repository, 'intentions');
	const trace = snapshot.traces.find((item) => item.id === traceId);
	if (!trace) return { ok: false, reason: 'not_found' };
	if (!isIntentionRelation(trace.relation)) return { ok: false, reason: 'not_intention' };
	// Only a task that is already completed refuses: one closed any other way can still be completed.
	if (trace.intentOpen === false && trace.intentOutcome === 'completed')
		return { ok: false, reason: 'closed' };
	if (trace.kindId !== null) return { ok: false, reason: 'typed_unsupported' };

	const [traces, intersections, assessments] = await Promise.all([
		repository.listTraces(true),
		repository.listIntersections(true),
		repository.listIntentionAssessments(true)
	]);
	const instant = new Date(now).toISOString();
	const { sources } = evaluateIntention(traceId, assessments, {
		tracesById: new Map(traces.map((item) => [item.id, item])),
		intersectionsById: new Map(intersections.map((item) => [item.id, item]))
	});
	if (
		sources.some(
			(source) =>
				source.assessment.source === 'evidence' &&
				source.eligibility.eligible &&
				source.orderedAt !== null &&
				compareAssessmentInstants(source.orderedAt, instant) > 0
		)
	)
		return { ok: false, reason: 'later_result_exists' };

	const scopeIds = intersections
		.filter((link) => !link.isDeleted && link.kind === 'belongs_to' && link.fromId === traceId)
		.map((link) => link.toId);
	const result = await repository.saveTraceRecord({
		fields: {
			title: trace.content,
			relation: 'actual',
			capturedAt: instant,
			timezone: zone,
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: instant,
				end: null
			}
		},
		memberships: { add: scopeIds },
		links: {
			add: [
				{
					kind: 'evidence_for',
					intentionId: traceId,
					assessment: { outcome: 'completed', open: false }
				}
			]
		}
	});
	return { ok: true, factId: result.trace.id, operationId: result.operation.id };
};

/** Remove the fact; its links and assessments remain available for restoration. */
export const revertCompletion = async (
	repository: TempienceRepository,
	factId: string
): Promise<RevertCompletionResult> => {
	const fact = await repository.getTrace(factId);
	if (!fact || fact.isDeleted) return { ok: false, reason: 'not_found' };
	if (fact.relation !== 'actual') return { ok: false, reason: 'not_a_completion' };
	const links = await repository.listIntersections();
	const intentions = await repository.listTraces();
	if (
		!links.some(
			(link) =>
				link.kind === 'evidence_for' &&
				link.fromId === factId &&
				intentions.some((item) => item.id === link.toId && isIntentionRelation(item.relation))
		)
	)
		return { ok: false, reason: 'not_a_completion' };
	await repository.setTraceDeleted(factId, true);
	return { ok: true };
};
