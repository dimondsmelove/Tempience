import { locale } from '$lib/state/Locale/Locale.svelte';
import { traceSummary, type KindCatalog, type TraceSummary } from '$lib/model/TraceForm/summary';
import type { AssessmentIneligibility } from '$lib/state/triplit/IntentionAssessments/eligibility';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import type {
	IntentionAssessment,
	IntentionOutcome
} from '$lib/state/triplit/IntentionAssessments/types';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type { Intersection, Trace } from '$lib/state/triplit/types';

/** One statement standing for an intention, as the Context explains it. */
export type IntentionSourceView = Readonly<{
	id: string;
	kind: 'direct' | 'evidence';
	/** The values this statement itself holds; null means it says nothing about that feature. */
	outcome: IntentionOutcome | null;
	open: boolean | null;
	/** Whether this statement takes part in the current result at all. */
	effective: boolean;
	/** Why it does not, when it does not; the source itself is never rewritten. */
	reason: AssessmentIneligibility | null;
	/** The fact a statement was made through, when it was made through one. */
	factId: string | null;
	factSummary: TraceSummary | null;
	/** The evidence link this statement is addressed to, for acting on it. */
	evidenceId: string | null;
	/** When this statement first stood, which corrections keep. */
	firstAssessedAt: string;
}>;

/**
 * What an intention's result is now and what made it so. Outcome and openness are decided
 * separately, each by the last effective statement that supplies it, so a completed intention
 * is not closed by that and a later «partly» replaces an earlier «done» without ranking.
 */
export type IntentionResultView = Readonly<{
	intentionId: string;
	outcome: IntentionOutcome | null;
	open: boolean;
	/** Which statement decided each feature, when one did. */
	outcomeSourceId: string | null;
	openSourceId: string | null;
	sources: readonly IntentionSourceView[];
}>;

export type ResultRows = Readonly<{
	traces: readonly Trace[];
	intersections: readonly Intersection[];
	assessments: readonly IntentionAssessment[];
	catalog: KindCatalog;
}>;

/** The result of one intention with every statement addressed to it, effective or not. */
export const intentionResultView = (
	intentionId: string,
	rows: ResultRows
): IntentionResultView | null => {
	const tracesById = new Map(rows.traces.map((trace) => [trace.id, trace] as const));
	const intention = tracesById.get(intentionId);
	if (!intention || !isIntentionRelation(intention.relation)) return null;
	const intersectionsById = new Map(rows.intersections.map((link) => [link.id, link] as const));
	const result = evaluateIntention(intentionId, rows.assessments, {
		tracesById,
		intersectionsById
	});
	const sources = result.sources.map((source): IntentionSourceView => {
		const fact = source.assessment.factId ? tracesById.get(source.assessment.factId) : undefined;
		return {
			id: source.assessment.id,
			kind: source.assessment.source === 'direct' ? 'direct' : 'evidence',
			outcome: source.assessment.outcome,
			open: source.assessment.open,
			effective: source.eligibility.eligible && source.orderedAt !== null,
			reason: source.eligibility.eligible ? null : source.eligibility.reason,
			factId: source.assessment.factId,
			factSummary: fact ? traceSummary(fact, rows.catalog, locale.current) : null,
			evidenceId: source.assessment.evidenceId,
			firstAssessedAt: source.assessment.firstAssessedAt
		};
	});
	return {
		intentionId,
		outcome: result.outcome.value,
		open: result.open.value,
		outcomeSourceId: result.outcome.sourceId,
		openSourceId: result.open.sourceId,
		sources
	};
};
