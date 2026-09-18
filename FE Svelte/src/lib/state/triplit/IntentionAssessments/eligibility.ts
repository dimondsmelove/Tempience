import type { LinkHead } from '../Intersections/heads';
import type { Trace } from '../types';
import { linkSourceId, sourceAgreesWithLink } from './binding';
import type { IntentionAssessment } from './types';

export type AssessmentIneligibility =
	| 'deleted'
	| 'intention_missing'
	| 'intention_deleted'
	| 'intention_role'
	| 'link_missing'
	| 'link_mismatch'
	| 'link_inactive'
	| 'activation_mismatch'
	| 'binding_mismatch'
	| 'fact_missing'
	| 'fact_deleted'
	| 'fact_role'
	| 'fact_undated';

export type AssessmentEligibility =
	{ eligible: true } | { eligible: false; reason: AssessmentIneligibility };

export type AssessmentContext = {
	intention?: Trace | null;
	link?: LinkHead | null;
	fact?: Trace | null;
};

const ineligible = (reason: AssessmentIneligibility): AssessmentEligibility => ({
	eligible: false,
	reason
});

/**
 * Eligibility is implicit: no stored revocation flag. A withdrawn link, a fresh activation
 * of the same endpoints, a deleted or undated fact silence the source without rewriting it,
 * so restoring the link or the fact brings the same base back while a fresh link never does.
 * `activation_mismatch` on an active link is the detached state to show, never to auto-fix.
 */
export const describeAssessmentEligibility = (
	assessment: IntentionAssessment,
	context: AssessmentContext
): AssessmentEligibility => {
	if (assessment.isDeleted) return ineligible('deleted');
	const intention = context.intention ?? null;
	if (!intention) return ineligible('intention_missing');
	if (intention.isDeleted) return ineligible('intention_deleted');
	if (intention.relation !== 'intend') return ineligible('intention_role');
	if (assessment.source === 'direct') return { eligible: true };
	const link = context.link ?? null;
	if (!link) return ineligible('link_missing');
	if (
		link.kind !== 'evidence_for' ||
		link.fromId !== assessment.factId ||
		link.toId !== assessment.intentionId
	) {
		return ineligible('link_mismatch');
	}
	if (link.isDeleted) return ineligible('link_inactive');
	// Endpoints already match, so a disagreement here is the activation the source is bound to.
	if (!sourceAgreesWithLink(assessment, link)) return ineligible('activation_mismatch');
	// A link has exactly one current source: its transfer binding or the activation's own row.
	if (linkSourceId(link) !== assessment.id) return ineligible('binding_mismatch');
	const fact = context.fact ?? null;
	if (!fact) return ineligible('fact_missing');
	if (fact.isDeleted) return ineligible('fact_deleted');
	if (fact.relation === 'intend') return ineligible('fact_role');
	if (fact.aboutTime?.basis !== 'absolute') return ineligible('fact_undated');
	return { eligible: true };
};

/** Collects the context of one assessment from indexed replicas, including deleted rows. */
export const collectAssessmentContext = (
	assessment: IntentionAssessment,
	tracesById: ReadonlyMap<string, Trace>,
	intersectionsById: ReadonlyMap<string, LinkHead>
): AssessmentContext => ({
	intention: tracesById.get(assessment.intentionId) ?? null,
	link: assessment.evidenceId ? (intersectionsById.get(assessment.evidenceId) ?? null) : null,
	fact: assessment.factId ? (tracesById.get(assessment.factId) ?? null) : null
});
