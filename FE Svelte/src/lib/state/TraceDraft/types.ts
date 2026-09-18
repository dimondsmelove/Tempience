import type { MessageKey } from '$lib/state/Locale/types';
import type {
	IntentionAssessmentValues,
	IntentionOutcome
} from '$lib/state/triplit/IntentionAssessments/types';
import type { Operation } from '$lib/state/triplit/Repository/transaction';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type {
	JsonObject,
	TraceAboutKind,
	TraceAboutTime,
	TraceDuration,
	TraceKindV,
	TraceRelation
} from '$lib/state/triplit/types';

export type TraceDraftRepository = Pick<
	TempienceRepository,
	| 'subscribeTraceKinds'
	| 'subscribeTraceKindVersions'
	| 'subscribeScopes'
	| 'listLinkHeads'
	| 'listKindMemberships'
	| 'listIntersectionsTouching'
	| 'listTraceHeads'
	| 'listIntentionAssessments'
	| 'getTrace'
	| 'saveTraceRecord'
>;

export type TraceDraftOptions = {
	repository: TraceDraftRepository;
	/** Kind data defaults for a fresh typed input (the SJSF merger in the forms runtime). */
	defaults: (version: TraceKindV) => JsonObject;
	now?: () => Date;
	timezone?: () => string;
};

/** The semantic placement of a record: what the time controls edit and the repository stores. */
export type TemporalPlacement = {
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime | null;
	statedDuration?: TraceDuration | null;
	aboutTraceId: string | null;
};

/** Either the record's saved placement, untouched, or a placement chosen in this input. */
export type TimeDraft = { mode: 'keep' } | { mode: 'chosen'; chosen: TemporalPlacement };

/**
 * What a Context action starts a new input with (TRACE_FORMS «входы»): a fact for an
 * intention, a part of a record, a supplement of a record. The relation to the parent is
 * fixed by the preset; everything else is ordinary input.
 */
export type DraftPreset =
	| { kind: 'result'; intentionId: string }
	| { kind: 'part'; wholeId: string }
	| { kind: 'supplement'; originalId: string };

/** What an entry point hands over: never fields, checks or saving of its own. */
export type DraftEntry =
	| {
			mode: 'create';
			/** Initial memberships; without them a preset takes the parent's direct Scopes. */
			scopeIds?: readonly string[];
			kindId?: string;
			versionId?: string;
			preset?: DraftPreset;
	  }
	| { mode: 'edit'; traceId: string };

/**
 * Scope selection as intent: what the entry gave, what the user added, what the chosen Kind
 * brings and what the user explicitly removed. The selected set is derived, so a Kind change
 * replaces only the Kind's contribution and never re-adds an excluded Scope.
 */
export type ScopeIntent = Readonly<{
	initial: readonly string[];
	manual: readonly string[];
	kind: readonly string[];
	excluded: readonly string[];
}>;

/**
 * One «Результат для» target of a fact, or one result of an intention: the other end of an
 * evidence link and the user's own assessment input for it. An absent feature is untouched
 * and writes nothing; null removes the own value; a restated value is written as stated.
 */
export type ResultTarget = Readonly<{
	/** The intention a fact is a result for; the fact that is a result of an intention. */
	otherId: string;
	/** The saved evidence link this target stands for, or null until the save creates it. */
	linkId: string | null;
	input: IntentionAssessmentValues;
}>;

/** The final values of the input, the shape the dirty comparison and the save read. */
export type DraftValues = Readonly<{
	title: string;
	description: string | null;
	relation: TraceRelation | null;
	placement: TemporalPlacement;
	kindId: string | null;
	versionId: string | null;
	data: JsonObject | null;
	scopeIds: readonly string[];
	targets: readonly ResultTarget[];
}>;

/** What the evidence link's own assessment source is, as the binding rules read it. */
export type LinkSourceStatus = 'none' | 'current' | 'withdrawn' | 'detached' | 'unavailable';

/** An active evidence link of the edited record, with the role it fixes. */
export type EvidenceRole = Readonly<{
	linkId: string;
	/** `outgoing`: the record is the fact; `incoming`: the record is the intention. */
	direction: 'outgoing' | 'incoming';
	otherId: string;
	otherTitle: string;
	source: LinkSourceStatus;
	/** The link's own current values, when its source is current. */
	own: Readonly<{ outcome: IntentionOutcome | null; open: boolean | null }> | null;
}>;

export type DraftField = 'title' | 'description' | 'time' | 'data' | 'version' | 'targets';

/** The nested authoring step open inside a form: a missing Scope or a missing Kind. */
export type NestedEditor = 'scope' | 'kind';

export type DraftIssue = Readonly<{ field: DraftField; key: MessageKey; detail?: string }>;

export type DraftPhase =
	'loading' | 'editing' | 'saving' | 'saved' | 'opening' | 'openFailed' | 'closed';

/** What a save or an opening failed with: the code when coded, the message for a log, the cause for the words. */
export type DraftFailure = Readonly<{ code: string | null; message: string; cause: unknown }>;

export type DraftCommit = Readonly<{ id: string; operation: Operation }>;

export type OpenSaved = (id: string) => Promise<void>;

/** What a command that ends the open form passes first; without changes it runs at once. */
export type ExitGuard = { exit: (then: () => void) => void };
