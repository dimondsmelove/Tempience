export type EntityType =
	| 'trace'
	| 'traceKind'
	| 'traceKindV'
	| 'period'
	| 'scope'
	| 'intersection'
	| 'scopeSegment'
	| 'source'
	| 'assertion'
	| 'citation'
	| 'assertionRelation'
	| 'provenanceLink'
	| 'intentionAssessment';

export type {
	IntentionAssessment,
	IntentionAssessmentPatch,
	IntentionAssessmentSource,
	IntentionAssessmentValues,
	IntentionOutcome,
	StoredIntentionAssessment
} from './IntentionAssessments/types';

export type LogAction = 'created' | 'updated' | 'deleted' | 'restored' | 'linked' | 'unlinked';

export type LogActor = 'user' | 'ai' | 'system';
export type LogCause = 'normal' | 'undo' | 'restore' | 'import';

export type TraceAboutKind = 'instant' | 'interval' | 'trace_ref';
export type TraceDuration = { amount: number; unit: 'minute' | 'day' };

export type TemporalPrecision = 'minute' | 'day' | 'month' | 'season' | 'year';
export type TemporalCertainty = 'exact' | 'approximate';
export type TraceRelativeTimeRelation = 'before' | 'after' | 'during' | 'around';

export type TraceAboutTime =
	| {
			basis: 'absolute';
			precision: TemporalPrecision;
			certainty: TemporalCertainty;
			start: string;
			end: string | null;
	  }
	| {
			basis: 'relative';
			precision: TemporalPrecision | 'unknown';
			anchorTraceId: string;
			relation: TraceRelativeTimeRelation;
	  }
	| {
			basis: 'unknown';
	  };

export type CanonicalTraceRelation = 'intend' | 'actual';

/** Legacy relations remain readable while new writes converge on the canonical model. */
export type LegacyTraceRelation = 'observe' | 'remember' | 'revisit';

export type TraceRelation = CanonicalTraceRelation | LegacyTraceRelation;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type TraceKind = {
	id: string;
	name: string;
	currentKindVId: string;
	createdAt: string;
	updatedAt: string;
};

export type TraceKindV = {
	id: string;
	kindId: string;
	generation: number;
	parentKindVIds: string[];
	dataSchema: JsonObject;
	uiSchema?: JsonObject;
	fieldMeta?: TraceFieldMetadata;
	createdAt: string;
	createdByDeviceId: string;
};

export type TraceFieldMetadata = Record<string, { unit?: { id: string; label: string } }>;

export type TraceKindVDraft = {
	dataSchema: JsonObject;
	uiSchema?: JsonObject;
	fieldMeta?: TraceFieldMetadata;
	parentKindVIds?: string[];
};

export type TraceKindDraft = {
	name: string;
	initialKindV: TraceKindVDraft;
	/** Direct Scope memberships created in the same commit; absent means none are set. */
	scopeIds?: readonly string[];
};

/** What an edit of a Kind's own metadata may change: its name and its direct memberships. */
export type TraceKindPatch = {
	name?: string;
	/** Present only when the user chose memberships; an empty set is the explicit «Без Scope». */
	scopeIds?: readonly string[];
};

export type TraceKindSeed = {
	id: string;
	name: string;
	initialKindV: {
		id: string;
		dataSchema: JsonObject;
		uiSchema?: JsonObject;
		fieldMeta?: TraceFieldMetadata;
	};
};

export type Trace = {
	id: string;
	capturedAt: string;
	timezone: string;
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime | null;
	statedDuration?: TraceDuration | null;
	/** Exact timestamp projection retained for indexed and legacy consumers. */
	aboutAt: string | null;
	/** Exact timestamp projection retained for indexed and legacy consumers. */
	aboutStart: string | null;
	/** Exact timestamp projection retained for indexed and legacy consumers. */
	aboutEnd: string | null;
	aboutTraceId: string | null;
	/** Plain: the required title. Typed: the optional description (may be blank). */
	content: string;
	/** Plain: the optional description. Typed and legacy rows: null. */
	description: string | null;
	relation: TraceRelation | null;
	kindId: string | null;
	kindVId: string | null;
	data: JsonObject | null;
	isDeleted: boolean;
	/**
	 * The operation of the record's last deletion or return — its lifecycle revision, as the
	 * inverse guards read it — or null for a record no such operation has touched, including
	 * rows written by older builds. Two deletions of one record are two different ones.
	 */
	lifecycleId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type TraceDraft = {
	content: string;
	description?: string | null;
	capturedAt: string;
	timezone: string;
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime | null;
	statedDuration?: TraceDuration | null;
	aboutTraceId?: string | null;
	relation?: TraceRelation | null;
	kindId?: string | null;
	kindVId?: string | null;
	data?: JsonObject | null;
};

export type TracePatch = Partial<
	Pick<
		Trace,
		| 'content'
		| 'description'
		| 'capturedAt'
		| 'timezone'
		| 'aboutKind'
		| 'aboutTime'
		| 'statedDuration'
		| 'aboutTraceId'
		| 'relation'
		| 'data'
	>
>;

export type PeriodTime = {
	precision: TemporalPrecision;
	start: string;
	end: string;
};

export type Period = {
	id: string;
	name: string;
	time: PeriodTime;
	timezone: string;
	note: string | null;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
};

export type PeriodDraft = Pick<Period, 'name' | 'time' | 'timezone'> & {
	note?: string | null;
};

export type PeriodPatch = Partial<PeriodDraft>;

export type Scope = {
	id: string;
	name: string;
	note: string | null;
	/** @deprecated Read-only migration compatibility; hierarchy lives in child_of Intersections. */
	parentScopeId: string | null;
	startedAt: string | null;
	endedAt: string | null;
	isDeleted: boolean;
	deletionOperationId?: string | null;
	createdAt: string;
	updatedAt: string;
};

export type ScopeDraft = {
	name: string;
	note?: string | null;
	parentScopeId?: string | null;
	startedAt?: string | null;
	endedAt?: string | null;
};

export type ScopePatch = Partial<
	Pick<Scope, 'name' | 'note' | 'parentScopeId' | 'startedAt' | 'endedAt'>
>;

export type ScopeSegment = {
	id: string;
	scopeId: string;
	startAt: string | null;
	endAt: string | null;
	label: string | null;
	position: number;
	createdAt: string;
	updatedAt: string;
};

export type ScopeSegmentDraft = {
	startAt?: string | null;
	endAt?: string | null;
	label?: string | null;
	position?: number;
};

export type ScopeSegmentBump = {
	at: string;
	label?: string | null;
};

export type IntersectionKind =
	| 'belongs_to'
	/** @deprecated Use child_of and query the inverse when needed. */
	| 'contains'
	| 'child_of'
	/** Directed Trace composition: part Trace -> whole Trace. */
	| 'part_of'
	| 'evidence_for'
	| 'revisits'
	/** Undirected relation; repository canonicalizes endpoint order. */
	| 'related_to';

export type ScopeIntersectionKind = 'child_of' | 'related_to';
export type TraceIntersectionKind = 'part_of' | 'evidence_for' | 'revisits' | 'related_to';

export type Intersection = {
	id: string;
	fromId: string;
	toId: string;
	kind: IntersectionKind;
	context: string | null;
	/** Present on Kind memberships; legacy Trace/Scope links omit the discriminator. */
	fromEntityType?: 'traceKind' | null;
	activationId?: string;
	lifecycleId?: string;
	scopeDeletionOperationId?: string | null;
	/** Evidence only: the source a retarget transferred onto this link; absent for origin sources. */
	assessmentId?: string | null;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
};

export type IntersectionDraft = Pick<Intersection, 'fromId' | 'toId' | 'kind'> & {
	context?: string | null;
};

export type IntersectionPatch = Pick<Intersection, 'context'>;

export type SourceKind = 'voice_recollection' | 'note' | 'calendar' | 'message' | 'other';

export type Source = {
	id: string;
	title: string;
	kind: SourceKind;
	content: string;
	capturedAt: string | null;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
};

export type SourceDraft = Pick<Source, 'title' | 'kind' | 'content'> & {
	capturedAt?: string | null;
};

export type SourcePatch = Partial<Pick<Source, 'title' | 'kind' | 'capturedAt'>>;

export type AssertionEpistemicLayer = 'source_record' | 'recollection' | 'interpretation';
export type AssertionConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type AssertionReviewStatus = 'unreviewed' | 'accepted' | 'corrected' | 'rejected';

export type Assertion = {
	id: string;
	statement: string;
	epistemicLayer: AssertionEpistemicLayer;
	confidence: AssertionConfidence;
	reviewStatus: AssertionReviewStatus;
	reviewedAt: string | null;
	note: string | null;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
};

export type AssertionDraft = Pick<Assertion, 'statement' | 'epistemicLayer' | 'confidence'> & {
	note?: string | null;
};

export type AssertionPatch = Partial<
	Pick<Assertion, 'statement' | 'epistemicLayer' | 'confidence' | 'note'>
>;

export type Citation = {
	id: string;
	assertionId: string;
	sourceId: string;
	startOffset: number;
	endOffset: number;
	label: string | null;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
};

export type CitationDraft = Pick<
	Citation,
	'assertionId' | 'sourceId' | 'startOffset' | 'endOffset'
> & {
	label?: string | null;
};

export type AssertionRelationKind = 'corrects' | 'conflicts_with';

export type AssertionRelation = {
	id: string;
	fromAssertionId: string;
	toAssertionId: string;
	kind: AssertionRelationKind;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
};

export type AssertionRelationDraft = Pick<
	AssertionRelation,
	'fromAssertionId' | 'toAssertionId' | 'kind'
>;

export type ProvenanceTargetType = 'trace' | 'scope' | 'scopeSegment' | 'period' | 'intersection';

export type ProvenanceLink = {
	id: string;
	assertionId: string;
	targetType: ProvenanceTargetType;
	targetId: string;
	targetPath: string | null;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ProvenanceLinkDraft = Pick<
	ProvenanceLink,
	'assertionId' | 'targetType' | 'targetId'
> & {
	targetPath?: string | null;
};

export type Log = {
	id: string;
	operationId: string;
	entityType: EntityType;
	entityId: string;
	action: LogAction;
	patch: Record<string, { before: unknown; after: unknown }>;
	occurredAt: string;
	deviceId: string;
	actor: LogActor;
	cause: LogCause;
};
