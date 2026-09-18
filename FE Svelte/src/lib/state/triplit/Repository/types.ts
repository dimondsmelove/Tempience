import type { ScopeCaptureRepository } from '../scope-capture-repository';
import type { TraceRecordResult, TraceRecordSave } from '../Traces/record';
import type { TraceLifecycleResult } from '../Traces/edit';
import type { TraceHeadsRequest } from '../Traces/heads';
import type { FocusedReads } from './focused';
import type { LinkReads } from './links';
import type { IntersectionLifecycleResult } from '../Intersections/Intersections';
import type { AssessmentCommandResult } from '../IntentionAssessments/IntentionAssessments';
import type { ScopeLifecycleResult } from '../Scopes/Scopes';
import type { Operation } from './transaction';
import type { UndoResult } from '../Undo/Undo';
import type { ScopeHierarchyIntegrityReport } from '../scope-hierarchy-integrity';
import type { TraceDatasetReader } from '../trace-dataset';
import type {
	Assertion,
	AssertionDraft,
	AssertionPatch,
	AssertionRelation,
	AssertionRelationDraft,
	Citation,
	CitationDraft,
	IntentionAssessment,
	IntentionAssessmentPatch,
	IntentionAssessmentValues,
	Intersection,
	IntersectionDraft,
	IntersectionPatch,
	JsonObject,
	Log,
	LogActor,
	Period,
	PeriodDraft,
	PeriodPatch,
	ProvenanceLink,
	ProvenanceLinkDraft,
	Scope,
	ScopeDraft,
	ScopeIntersectionKind,
	ScopePatch,
	ScopeSegment,
	ScopeSegmentBump,
	ScopeSegmentDraft,
	Source,
	SourceDraft,
	SourcePatch,
	Trace,
	TraceDraft,
	TraceIntersectionKind,
	TraceKind,
	TraceKindDraft,
	TraceKindPatch,
	TraceKindSeed,
	TraceKindV,
	TraceKindVDraft,
	TracePatch
} from '../types';

export type Collection =
	| 'scopeCaptureSettings'
	| 'traceKinds'
	| 'traceKindVersions'
	| 'traces'
	| 'periods'
	| 'scopes'
	| 'scopeSegments'
	| 'intersections'
	| 'intentionAssessments'
	| 'sources'
	| 'assertions'
	| 'citations'
	| 'assertionRelations'
	| 'provenanceLinks'
	| 'logs';

export type Entity = Record<string, unknown> & { id: string };

export type Transaction = {
	fetch: (collection: Collection) => Promise<Entity[]>;
	fetchById: (collection: Collection, id: string) => Promise<Entity | null | undefined>;
	insert: (collection: Collection, value: Record<string, unknown>) => Promise<Entity>;
	update: (collection: Collection, id: string, value: Record<string, unknown>) => Promise<void>;
};

export type RepositoryClient = {
	transact: <Output>(callback: (transaction: Transaction) => Promise<Output>) => Promise<Output>;
	fetch: (collection: Collection) => Promise<Entity[]>;
	/** Resolves once the storage runs the current schema; collections added later require it. */
	ready?: () => Promise<void>;
	/**
	 * Pulls the named rows from the server into the local store, so a transaction that follows
	 * reads them; a replica without a connection resolves at once (#37).
	 */
	warm?: (rows: readonly { collection: Collection; id: string }[]) => Promise<void>;
};

export type LedgerIntervalDraft = {
	content: string;
	timezone: string;
	aboutStart: string;
	aboutEnd: string;
	capturedAt?: string;
	scopeId?: string | null;
	data?: JsonObject | null;
};

export type WeeklyBudgetDraft = LedgerIntervalDraft & {
	targetMinutes: number;
	scopeId: string;
};

export type FixedTimeIntentDraft = LedgerIntervalDraft;

export type ActualDraft = LedgerIntervalDraft;

export type TraceRepository = {
	setTraceKindScopes: (
		kindId: string,
		scopeIds: readonly string[],
		actor?: LogActor
	) => Promise<Intersection[]>;
	/** A rename, the direct Scope memberships, or both in one commit; a string is a rename. */
	editTraceKind: (
		id: string,
		patch: string | TraceKindPatch,
		actor?: LogActor
	) => Promise<TraceKind>;
	ensureTraceKind: (
		seed: TraceKindSeed,
		actor?: LogActor
	) => Promise<{ kind: TraceKind; kindV: TraceKindV }>;
	createTraceKind: (
		draft: TraceKindDraft,
		actor?: LogActor
	) => Promise<{ kind: TraceKind; kindV: TraceKindV }>;
	createTraceKindV: (
		kindId: string,
		draft: TraceKindVDraft & { kindName?: string; scopeIds?: readonly string[] },
		actor?: LogActor
	) => Promise<TraceKindV>;
	listTraceKinds: () => Promise<TraceKind[]>;
	listTraceKindVersions: (kindId?: string) => Promise<TraceKindV[]>;
	listTraceKindVersionHeads: (kindId: string) => Promise<TraceKindV[]>;
	createTrace: (draft: TraceDraft, actor?: LogActor) => Promise<Trace>;
	createWeeklyBudget: (draft: WeeklyBudgetDraft, actor?: LogActor) => Promise<Trace>;
	createFixedTimeIntent: (draft: FixedTimeIntentDraft, actor?: LogActor) => Promise<Trace>;
	createActual: (draft: ActualDraft, actor?: LogActor) => Promise<Trace>;
	/** Interactive capture: validates Kind availability and saves every membership atomically. */
	createTraceWithScopes: (
		draft: TraceDraft,
		scopeIds: readonly string[],
		actor?: LogActor
	) => Promise<Trace>;
	createTraceWithScope: (
		draft: TraceDraft,
		scopeId?: string | null,
		actor?: LogActor
	) => Promise<Trace>;
	editTrace: (id: string, patch: TracePatch, actor?: LogActor) => Promise<Trace>;
	/** One form save: the Trace with its explicit memberships, relations and entered assessments. */
	saveTraceRecord: (save: TraceRecordSave, actor?: LogActor) => Promise<TraceRecordResult>;
	/**
	 * Causal inverse of one committed operation through its own records; refuses whole when a
	 * consequence is stale, unavailable, shared or outside the supported families.
	 */
	undoOperation: (operationId: string, actor?: LogActor) => Promise<UndoResult>;
	/**
	 * Deletes or restores one Trace and answers with the operation that did it, so an offer
	 * to undo names the very operation it was made for instead of guessing at the journal.
	 */
	setTraceDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<TraceLifecycleResult>;
	createPeriod: (draft: PeriodDraft, actor?: LogActor) => Promise<Period>;
	editPeriod: (id: string, patch: PeriodPatch, actor?: LogActor) => Promise<Period>;
	setPeriodDeleted: (id: string, isDeleted: boolean, actor?: LogActor) => Promise<Period>;
	listPeriods: (includeDeleted?: boolean) => Promise<Period[]>;
	createScope: (draft: ScopeDraft, actor?: LogActor) => Promise<Scope>;
	editScope: (id: string, patch: ScopePatch, actor?: LogActor) => Promise<Scope>;
	setScopeDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<ScopeLifecycleResult>;
	setScopeParent: (
		childScopeId: string,
		parentScopeId: string | null,
		context?: string | null,
		actor?: LogActor
	) => Promise<Intersection | null>;
	auditScopeHierarchyIntegrity: () => Promise<ScopeHierarchyIntegrityReport>;
	createIntersection: (draft: IntersectionDraft, actor?: LogActor) => Promise<Intersection>;
	editIntersection: (
		id: string,
		patch: IntersectionPatch,
		actor?: LogActor
	) => Promise<Intersection>;
	setIntersectionDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<IntersectionLifecycleResult>;
	linkScopeToScope: (
		childScopeId: string,
		parentScopeId: string,
		kind?: ScopeIntersectionKind,
		context?: string | null,
		actor?: LogActor
	) => Promise<Intersection>;
	linkTraceToTrace: (
		fromTraceId: string,
		toTraceId: string,
		kind?: TraceIntersectionKind,
		context?: string | null,
		actor?: LogActor
	) => Promise<Intersection>;
	migrateLegacyScopeParents: (actor?: LogActor) => Promise<number>;
	createScopeSegment: (
		scopeId: string,
		draft: ScopeSegmentDraft,
		actor?: LogActor
	) => Promise<ScopeSegment>;
	bumpScopeSegment: (
		scopeId: string,
		draft: ScopeSegmentBump,
		actor?: LogActor
	) => Promise<ScopeSegment>;
	listScopeSegments: (scopeId?: string) => Promise<ScopeSegment[]>;
	listTraces: (includeDeleted?: boolean) => Promise<Trace[]>;
	listScopes: (includeDeleted?: boolean) => Promise<Scope[]>;
	listIntersections: (includeDeleted?: boolean) => Promise<Intersection[]>;
	/** First assessment through an active evidence_for link; one logical source per activation. */
	createEvidenceAssessment: (
		evidenceId: string,
		values: IntentionAssessmentValues,
		actor?: LogActor
	) => Promise<IntentionAssessment>;
	/** Independent action from the intention itself; every call is its own source. */
	createDirectAssessment: (
		intentionId: string,
		values: IntentionAssessmentValues,
		actor?: LogActor
	) => Promise<IntentionAssessment>;
	editIntentionAssessment: (
		id: string,
		patch: IntentionAssessmentPatch,
		actor?: LogActor
	) => Promise<AssessmentCommandResult>;
	setIntentionAssessmentDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<AssessmentCommandResult>;
	listIntentionAssessments: (includeDeleted?: boolean) => Promise<IntentionAssessment[]>;
	/** Corrects one current evidence link to another intention together with its own assessment. */
	correctEvidenceTarget: (
		evidenceId: string,
		intentionId: string,
		actor?: LogActor
	) => Promise<{
		link: Intersection;
		assessment: IntentionAssessment | null;
		/** The operation this correction committed, or null when nothing needed moving. */
		operation: Operation | null;
	}>;
	linkTraceToScope: (
		traceId: string,
		scopeId: string,
		kind?: 'belongs_to',
		context?: string | null,
		actor?: LogActor
	) => Promise<Intersection>;
	createSource: (draft: SourceDraft, actor?: LogActor) => Promise<Source>;
	editSource: (id: string, patch: SourcePatch, actor?: LogActor) => Promise<Source>;
	setSourceDeleted: (id: string, isDeleted: boolean, actor?: LogActor) => Promise<Source>;
	listSources: (includeDeleted?: boolean) => Promise<Source[]>;
	createAssertion: (draft: AssertionDraft, actor?: LogActor) => Promise<Assertion>;
	editAssertion: (id: string, patch: AssertionPatch, actor?: LogActor) => Promise<Assertion>;
	reviewAssertion: (
		id: string,
		status: 'accepted' | 'rejected',
		actor?: LogActor
	) => Promise<Assertion>;
	reopenAssertionReview: (id: string, actor?: LogActor) => Promise<Assertion>;
	correctAssertion: (
		correctedAssertionId: string,
		replacementAssertionId: string,
		actor?: LogActor
	) => Promise<{ corrected: Assertion; relation: AssertionRelation }>;
	setAssertionDeleted: (id: string, isDeleted: boolean, actor?: LogActor) => Promise<Assertion>;
	listAssertions: (includeDeleted?: boolean) => Promise<Assertion[]>;
	createCitation: (draft: CitationDraft, actor?: LogActor) => Promise<Citation>;
	editCitationLabel: (id: string, label: string | null, actor?: LogActor) => Promise<Citation>;
	setCitationDeleted: (id: string, isDeleted: boolean, actor?: LogActor) => Promise<Citation>;
	listCitations: (includeDeleted?: boolean) => Promise<Citation[]>;
	createAssertionRelation: (
		draft: AssertionRelationDraft,
		actor?: LogActor
	) => Promise<AssertionRelation>;
	setAssertionRelationDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<AssertionRelation>;
	listAssertionRelations: (includeDeleted?: boolean) => Promise<AssertionRelation[]>;
	linkAssertionToTarget: (draft: ProvenanceLinkDraft, actor?: LogActor) => Promise<ProvenanceLink>;
	setProvenanceLinkDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<ProvenanceLink>;
	listProvenanceLinks: (includeDeleted?: boolean) => Promise<ProvenanceLink[]>;
	listLogs: (entityId?: string) => Promise<Log[]>;
	/**
	 * The journal of the given records only. Opening one record must not read the whole
	 * journal of the space, which is the collection that grows fastest.
	 */
	listLogsFor: (entityIds: readonly string[]) => Promise<Log[]>;
};

type RepositorySubscription<T> = (
	next: (rows: T[]) => void,
	fail: (error: unknown) => void
) => () => void;

export type TempienceRepository = TraceRepository &
	TraceDatasetReader &
	ScopeCaptureRepository &
	FocusedReads &
	LinkReads & {
		subscribeTraceKinds: RepositorySubscription<TraceKind>;
		subscribeTraceKindVersions: RepositorySubscription<TraceKindV>;
		subscribeScopes: RepositorySubscription<Scope>;
		/** The Scopes that were deleted: what the list of them and their return read. */
		subscribeDeletedScopes: RepositorySubscription<Scope>;
		subscribeIntentionAssessments: RepositorySubscription<IntentionAssessment>;
		/** Records and their explicit links, deleted ones included: what a Context reads. */
		subscribeTraces: RepositorySubscription<Trace>;
		/**
		 * A thin read of records: every field a row needs and of the data only the summary
		 * leaves named by the request. What the timeline and every list of records read.
		 */
		listTraceHeads: (request: TraceHeadsRequest) => Promise<Trace[]>;
		subscribeTraceHeads: (
			request: TraceHeadsRequest,
			next: (rows: Trace[]) => void,
			fail: (error: unknown) => void
		) => () => void;
		subscribeIntersections: RepositorySubscription<Intersection>;
		/** The journal of the given records, live; an empty list subscribes to nothing. */
		subscribeLogsFor: (
			entityIds: readonly string[],
			next: (rows: Log[]) => void,
			fail: (error: unknown) => void
		) => () => void;
		getTrace: (id: string) => Promise<Trace | null>;
	};
