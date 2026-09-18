import type { MessageKey } from '$lib/state/Locale/types';
import type { AssessmentIneligibility } from '$lib/state/triplit/IntentionAssessments/eligibility';

/** Why a statement addressed to this intention takes no part in its current result. */
export const INELIGIBLE_KEYS: Record<AssessmentIneligibility, MessageKey> = {
	deleted: 'source.deleted',
	intention_missing: 'source.intentionMissing',
	intention_deleted: 'source.intentionDeleted',
	intention_role: 'source.intentionRole',
	link_missing: 'source.linkMissing',
	link_mismatch: 'source.linkMismatch',
	link_inactive: 'source.linkInactive',
	activation_mismatch: 'source.activationMismatch',
	binding_mismatch: 'source.bindingMismatch',
	fact_missing: 'source.factMissing',
	fact_deleted: 'source.factDeleted',
	fact_role: 'source.factRole',
	fact_undated: 'source.factUndated'
};
