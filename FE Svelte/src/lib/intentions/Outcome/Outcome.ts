import { compareAssessmentInstants } from '$lib/state/triplit/IntentionAssessments/read';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type {
	AssessedOutcome,
	IntentionAssessmentValues
} from '$lib/state/triplit/IntentionAssessments/types';
import type {
	OutcomeFailure,
	OutcomeOptions,
	OutcomeRefusal,
	OutcomeResult,
	ResultOutcome
} from './types';

const refuse = (reason: OutcomeFailure): OutcomeRefusal => ({ ok: false, reason });

/** The intention with what its sources say now, read the way every other reader assembles it. */
const stateOf = async (repository: TempienceRepository, intentionId: string) => {
	const [traces, intersections, assessments] = await Promise.all([
		repository.listTraces(true),
		repository.listIntersections(true),
		repository.listIntentionAssessments(true)
	]);
	const trace = traces.find((item) => item.id === intentionId);
	if (!trace || trace.isDeleted) return refuse('not_found');
	if (!isIntentionRelation(trace.relation)) return refuse('not_intention');
	const result = evaluateIntention(intentionId, assessments, {
		tracesById: new Map(traces.map((item) => [item.id, item])),
		intersectionsById: new Map(intersections.map((item) => [item.id, item]))
	});
	return { ok: true as const, trace, intersections, result };
};

/** A statement made later than `instant` would silently outrank the one about to be written. */
const hasLaterStatement = (
	result: ReturnType<typeof evaluateIntention>,
	instant: string
): boolean =>
	result.sources.some(
		(source) =>
			source.assessment.source === 'evidence' &&
			source.eligibility.eligible &&
			source.orderedAt !== null &&
			compareAssessmentInstants(source.orderedAt, instant) > 0
	);

const assess = async (
	repository: TempienceRepository,
	intentionId: string,
	values: IntentionAssessmentValues
): Promise<OutcomeResult> => {
	const assessment = await repository.createDirectAssessment(intentionId, values, 'user');
	const operationId = assessment.outcomeRevision ?? assessment.openRevision;
	if (!operationId) throw new Error('Missing assessment operation');
	return { ok: true, operationId, factId: null };
};

/**
 * What was done, as a fact on the timeline addressed to the intention: «partial» leaves the
 * task as open as it was, «alternative» closes it. The text is the statement; without it
 * there is nothing to record.
 */
export const recordResult = async (
	repository: TempienceRepository,
	intentionId: string,
	text: string,
	outcome: ResultOutcome,
	{ now, zone }: OutcomeOptions
): Promise<OutcomeResult> => {
	const title = text.trim();
	if (!title) return refuse('text_required');
	const state = await stateOf(repository, intentionId);
	if (!state.ok) return state;
	const instant = new Date(now).toISOString();
	if (hasLaterStatement(state.result, instant)) return refuse('later_result_exists');
	const scopeIds = state.intersections
		.filter((link) => !link.isDeleted && link.kind === 'belongs_to' && link.fromId === intentionId)
		.map((link) => link.toId);
	const saved = await repository.saveTraceRecord({
		fields: {
			title,
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
					intentionId,
					assessment: outcome === 'alternative' ? { outcome, open: false } : { outcome }
				}
			]
		}
	});
	return { ok: true, operationId: saved.operation.id, factId: saved.trace.id };
};

/**
 * An outcome stated without a fact: «no outcome» or «not completed». `close` also closes the
 * task, which is what the presets «Не выполнено» and «Отменить» do; the status menu changes
 * the outcome alone.
 */
export const setOutcome = (
	repository: TempienceRepository,
	intentionId: string,
	outcome: Extract<AssessedOutcome, 'none' | 'not_completed'>,
	{ close = false }: { close?: boolean } = {}
): Promise<OutcomeResult> =>
	assess(repository, intentionId, close ? { outcome, open: false } : { outcome });

/**
 * Opens or closes the task without touching the outcome, except that «completed» cannot stay
 * on an open task: opening a completed task gives the outcome back to what stood before the
 * completion, or to «no outcome». The completion fact stays on the timeline as it happened.
 */
export const setOpen = async (
	repository: TempienceRepository,
	intentionId: string,
	open: boolean,
	{ now }: { now: number }
): Promise<OutcomeResult> => {
	const state = await stateOf(repository, intentionId);
	if (!state.ok) return state;
	const { result } = state;
	if (result.open.value === open) return refuse('unchanged');
	if (!open || result.outcome.value !== 'completed')
		return assess(repository, intentionId, { open });
	if (hasLaterStatement(result, new Date(now).toISOString())) return refuse('later_result_exists');
	const before = result.sources
		.filter(
			(source) =>
				source.eligibility.eligible &&
				source.orderedAt !== null &&
				source.assessment.outcome !== null &&
				source.assessment.outcome !== 'completed'
		)
		.at(-1)?.assessment.outcome;
	return assess(repository, intentionId, { open: true, outcome: before ?? 'none' });
};
