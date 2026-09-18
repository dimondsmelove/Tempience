import { intersectionActivationId } from '../Intersections/read';
import type { LinkHead } from '../Intersections/heads';
import type { Intersection } from '../types';
import { assessmentIdFor, normalizeIntentionAssessment } from './read';
import type { IntentionAssessment } from './types';

/**
 * One current source per evidence link. An ordinary first assessment derives its identity
 * from the link activation and never writes the link, so a delayed first creation on an
 * older activation can neither claim the link nor overwrite a transfer. Only a retarget
 * binds the link to the source it moved (`assessmentId`); a fresh relink clears that binding
 * together with its new activation, an ordinary restore keeps both.
 */
export const linkSourceId = (link: LinkHead): string =>
	link.assessmentId ?? assessmentIdFor(intersectionActivationId(link));

/**
 * The source a link names is its own only while the source's current address still is this
 * link: same fact, same target, same link and same activation. After further moves or a
 * restore of an older link the name may survive while the address moved on; such a link is
 * detached from that source and no command may act on the source through it. Participation
 * (dates, deletion) is a separate question answered by eligibility.
 */
export const sourceAgreesWithLink = (assessment: IntentionAssessment, link: LinkHead): boolean =>
	assessment.source === 'evidence' &&
	assessment.factId === link.fromId &&
	assessment.intentionId === link.toId &&
	assessment.evidenceId === link.id &&
	assessment.activationId === intersectionActivationId(link);

export type LinkSource =
	/** No row named by the link: an ordinary link without an assessment. */
	| { status: 'none'; assessmentId: string }
	/** The bound row is not present on this replica. */
	| { status: 'unavailable'; assessmentId: string }
	/** The named row exists but its current address is another link. */
	| { status: 'detached'; assessment: IntentionAssessment }
	/** The link's own source, explicitly withdrawn. */
	| { status: 'withdrawn'; assessment: IntentionAssessment }
	| { status: 'current'; assessment: IntentionAssessment };

/** Resolves what the named row means for this link; commands refuse everything but own sources. */
export const resolveLinkSource = (
	link: Intersection,
	row: Record<string, unknown> | null | undefined
): LinkSource => {
	const assessmentId = linkSourceId(link);
	if (!row) return { status: link.assessmentId ? 'unavailable' : 'none', assessmentId };
	const assessment = normalizeIntentionAssessment(row);
	if (!sourceAgreesWithLink(assessment, link)) return { status: 'detached', assessment };
	return { status: assessment.isDeleted ? 'withdrawn' : 'current', assessment };
};
