export type IntentionOutcome = 'completed' | 'partial' | 'not_completed' | 'alternative';

export type IntentionAssessmentSource = 'evidence' | 'direct';

/** Explicit feature input: an absent key leaves the feature untouched, null removes the own value. */
export type IntentionAssessmentValues = {
	outcome?: IntentionOutcome | null;
	open?: boolean | null;
};

export type IntentionAssessmentPatch = IntentionAssessmentValues;

export type IntentionAssessment = {
	id: string;
	source: IntentionAssessmentSource;
	/** Current addressee; differs from originIntentionId only after a retarget. */
	intentionId: string;
	originIntentionId: string;
	factId: string | null;
	evidenceId: string | null;
	activationId: string | null;
	/** operationId of the retarget that moved the source; null while it sits at its origin. */
	placementRevision: string | null;
	outcome: IntentionOutcome | null;
	open: boolean | null;
	/** operationId of the write that determined each own value, including an explicit clearing. */
	outcomeRevision: string | null;
	openRevision: string | null;
	/**
	 * Earliest first assessment through this source as a canonical UTC instant; edits and
	 * concurrent first creations keep it.
	 */
	firstAssessedAt: string;
	isDeleted: boolean;
	lifecycleId: string;
	createdAt: string;
	updatedAt: string;
};

/**
 * One first creation of the logical source: its time and only the explicitly entered values.
 * `withdrawn` names the inverse that took this creation back; the candidate then counts for
 * nothing while any other, also later arriving, first creation keeps the source alive.
 */
export type StoredAssessmentCandidate = {
	at: string;
	outcome?: IntentionOutcome | null;
	open?: boolean | null;
	withdrawn?: string;
};

/**
 * One correction slot per feature. `statement` names whose statement the slot expresses:
 * the writing operation itself (a genuine correction), an earlier correction an inverse
 * re-expressed (which still stands), or `null` when an inverse returned the feature to its
 * first creations — the slot then only carries the revision and neither gives a value nor
 * keeps the source alive. Merged maps keep keys, so every writer sets it; rows written
 * before it existed read as genuine.
 */
export type StoredAssessmentOverride<Value> = {
	value: Value | null;
	operationId: string;
	statement?: string | null;
};

export type StoredAssessmentPlacement = {
	intentionId: string;
	evidenceId: string;
	activationId: string;
	/** Present only on a transferred placement: the operation that moved the source. */
	operationId?: string;
};

export type StoredAssessmentOrigin =
	{ intentionId: string } | (StoredAssessmentPlacement & { factId: string });

/**
 * Physical row. `initial` is keyed by operationId so concurrent first creations of the same
 * activation merge instead of replacing each other; `values` holds later corrections per
 * feature with their revision; `placement` overrides the immutable `origin` after a retarget.
 */
export type StoredIntentionAssessment = {
	id: string;
	source: IntentionAssessmentSource;
	origin: StoredAssessmentOrigin;
	initial: Record<string, StoredAssessmentCandidate>;
	values?: {
		outcome?: StoredAssessmentOverride<IntentionOutcome>;
		open?: StoredAssessmentOverride<boolean>;
	} | null;
	placement?: StoredAssessmentPlacement | null;
	isDeleted?: boolean | null;
	lifecycleId?: string | null;
	updatedAt: string;
};
