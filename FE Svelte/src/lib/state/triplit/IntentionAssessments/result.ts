import type { LinkHead } from '../Intersections/heads';
import { traceEventKey } from '../Traces/event-time';
import type { Trace } from '../types';
import {
	collectAssessmentContext,
	describeAssessmentEligibility,
	type AssessmentEligibility
} from './eligibility';
import { compareAssessmentIdentity, compareAssessmentInstants } from './read';
import type { IntentionAssessment, IntentionOutcome } from './types';

export type IntentionSourceState = {
	assessment: IntentionAssessment;
	eligibility: AssessmentEligibility;
	/**
	 * Primary ordering instant: the fact's event key for evidence, the action time for a direct
	 * source; null when the fact has no absolute placement or is unavailable.
	 */
	orderedAt: string | null;
};

export type IntentionFeature<Value> = {
	value: Value;
	/** The assessment whose explicit value determines the feature; null for the default. */
	sourceId: string | null;
};

export type IntentionResult = {
	intentionId: string;
	outcome: IntentionFeature<IntentionOutcome | null>;
	open: IntentionFeature<boolean>;
	/** Every source addressed to the intention, effective ones first in the order they apply. */
	sources: IntentionSourceState[];
};

export type IntentionContext = {
	tracesById: ReadonlyMap<string, Trace>;
	intersectionsById: ReadonlyMap<string, LinkHead>;
};

/** The E3 key of a fact, shared with every other reader that orders records by event. */
export { traceEventKey };

const orderedAtFor = (
	assessment: IntentionAssessment,
	context: IntentionContext
): string | null => {
	if (assessment.source === 'direct') return assessment.firstAssessedAt;
	const fact = assessment.factId ? context.tracesById.get(assessment.factId) : undefined;
	return fact ? traceEventKey(fact) : null;
};

/** Sources without a key sort after keyed ones; instants never compare as text. */
const compareKeys = (a: string | null, b: string | null): number =>
	a === null || b === null
		? Number(a === null) - Number(b === null)
		: compareAssessmentInstants(a, b);

/** Event key first, then the stable first-assessment time, then a locale-independent identity. */
export const compareIntentionSources = (a: IntentionSourceState, b: IntentionSourceState): number =>
	compareKeys(a.orderedAt, b.orderedAt) ||
	compareAssessmentInstants(a.assessment.firstAssessedAt, b.assessment.firstAssessedAt) ||
	compareAssessmentIdentity(a.assessment.id, b.assessment.id);

/**
 * Derives the current outcome and openness of one intention from its sources. Each feature is
 * decided independently by the last effective source that supplies it; a null own value
 * contributes nothing and an explicit false counts. Without sources the intention is not
 * assessed and open. Nothing is stored: the result follows the rows it was computed from.
 */
export const evaluateIntention = (
	intentionId: string,
	assessments: readonly IntentionAssessment[],
	context: IntentionContext
): IntentionResult => {
	const sources: IntentionSourceState[] = assessments
		.filter((assessment) => assessment.intentionId === intentionId)
		.map((assessment) => {
			const orderedAt = orderedAtFor(assessment, context);
			const eligibility = describeAssessmentEligibility(
				assessment,
				collectAssessmentContext(assessment, context.tracesById, context.intersectionsById)
			);
			return { assessment, eligibility, orderedAt };
		});
	const effective = sources
		.filter((source) => source.eligibility.eligible && source.orderedAt !== null)
		.toSorted(compareIntentionSources);
	const outcome: IntentionFeature<IntentionOutcome | null> = { value: null, sourceId: null };
	const open: IntentionFeature<boolean> = { value: true, sourceId: null };
	for (const { assessment } of effective) {
		if (assessment.outcome !== null) {
			outcome.value = assessment.outcome;
			outcome.sourceId = assessment.id;
		}
		if (assessment.open !== null) {
			open.value = assessment.open;
			open.sourceId = assessment.id;
		}
	}
	const effectiveIds = new Set(effective.map((source) => source.assessment.id));
	return {
		intentionId,
		outcome,
		open,
		sources: [...effective, ...sources.filter((source) => !effectiveIds.has(source.assessment.id))]
	};
};
