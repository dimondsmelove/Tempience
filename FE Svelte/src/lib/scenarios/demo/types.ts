import type { Locale, MessageKey } from '$lib/state/Locale/types';
import type { DataSpace } from '$lib/state/triplit/data-space';
import type { TraceRepository } from '$lib/state/triplit/repository';
import type {
	IntentionAssessmentValues,
	IntentionOutcome
} from '$lib/state/triplit/IntentionAssessments/types';
import type {
	ScenarioImportBatch,
	ScenarioImportRepository
} from '$lib/state/triplit/scenario-import-repository';
import type {
	CanonicalTraceRelation,
	TemporalCertainty,
	TemporalPrecision,
	TraceIntersectionKind,
	TraceKindSeed,
	TraceRelativeTimeRelation
} from '$lib/state/triplit/types';
import type { SEASON_MONTHS } from './constants';

/** A calendar day of the notebook, `YYYY-MM-DD`, in the seed timezone. */
export type StoryDate = string;
/** When Watson wrote a record: a day (at noon) or a local minute `YYYY-MM-DDTHH:MM` of the seed timezone. */
export type StoryCaptured = StoryDate | `${StoryDate}T${string}`;
export type StorySeason = keyof typeof SEASON_MONTHS;

/**
 * How a record sits in time. Every absolute value is a calendar value at its precision; a day
 * and a minute are exact unless said otherwise, a month and a year approximate.
 */
export type StoryTime =
	| Readonly<{ type: 'day'; value: StoryDate; certainty?: TemporalCertainty }>
	/** A calendar month `YYYY-MM`. */
	| Readonly<{ type: 'month'; value: string; certainty?: TemporalCertainty }>
	| Readonly<{ type: 'year'; value: number }>
	/** A season of a year, approximately: a normalized start/end month window. */
	| Readonly<{ type: 'season'; year: number; season: StorySeason }>
	| Readonly<{
			type: 'relative';
			anchor: string;
			precision: TemporalPrecision | 'unknown';
			relation: TraceRelativeTimeRelation;
	  }>
	| Readonly<{ type: 'unknown' }>
	/** An interval, both ends at one precision: days `YYYY-MM-DD`, years `YYYY`, local minutes `YYYY-MM-DDTHH:MM`. */
	| Readonly<{
			type: 'interval';
			precision: 'day' | 'year' | 'minute';
			start: string;
			end: string;
			certainty?: TemporalCertainty;
	  }>
	/** A local wall-clock minute `YYYY-MM-DDTHH:MM` in the seed timezone. */
	| Readonly<{ type: 'minute'; value: string; certainty?: TemporalCertainty }>;

/** A Scope's own colour: a hue on the circle, a saturation 0–100 and a depth 0–2 (`theme/scope-colour`). */
export type StoryColour = Readonly<{ hue: number; chroma?: number; depth?: number }>;

export type StoryScope = Readonly<{
	id: string;
	nameKey: MessageKey;
	noteKey?: MessageKey;
	parentId?: string;
	colour?: StoryColour;
}>;

export type StoryField = Readonly<{
	key: string;
	type: 'integer' | 'number' | 'string';
	titleKey: MessageKey;
	unit?: Readonly<{ id: string; labelKey: MessageKey }>;
}>;

export type StoryKind = Readonly<{
	/** The fixed TraceKind id and its initial version id. */
	id: string;
	kindVId: string;
	nameKey: MessageKey;
	fields: readonly StoryField[];
	/** Direct Kind memberships, set after the Scopes exist. */
	scopeIds: readonly string[];
}>;

/** A typed record's value: a number, or a text written in the seed language. */
export type StoryValue = number | Readonly<{ key: MessageKey }>;

export type StoryPeriod = Readonly<{
	id: string;
	noteKey: MessageKey;
	unit: 'month' | 'year' | 'decade';
	/** A day the calendar unit contains: the year, and the month for a month. */
	year: number;
	month?: number;
}>;

export type StoryTrace = Readonly<{
	id: string;
	relation: CanonicalTraceRelation;
	time: StoryTime;
	/** When Watson wrote the record: its day at noon, or the minute that orders the records of one day. */
	captured: StoryCaptured;
	/** A plain record's title; a typed record's optional description. */
	contentKey?: MessageKey;
	/** A plain record's description; its last line may be a «→ дальше» breadcrumb. */
	descriptionKey?: MessageKey;
	kind?: Readonly<{ id: string; data: Readonly<Record<string, StoryValue>> }>;
	scopeIds: readonly string[];
}>;

export type StoryTraceLink = Readonly<{
	kind: TraceIntersectionKind;
	fromId: string;
	toId: string;
}>;
export type StoryScopeLink = Readonly<{ kind: 'related_to'; fromId: string; toId: string }>;

/**
 * Watson's verdict on one `evidence_for` link: the fact `factId` decides the intention
 * `intentionId`. The seed creates it through the link, so the source is ordered by the fact's
 * own date, not by the day the demo was installed.
 */
export type StoryAssessment = Readonly<{
	factId: string;
	intentionId: string;
	outcome: IntentionOutcome;
	open: boolean;
}>;

export type DemoStory = Readonly<{
	scopes: readonly StoryScope[];
	scopeLinks: readonly StoryScopeLink[];
	kinds: readonly StoryKind[];
	periods: readonly StoryPeriod[];
	traces: readonly StoryTrace[];
	traceLinks: readonly StoryTraceLink[];
	assessments: readonly StoryAssessment[];
}>;

/** An assessment to create once the batch is applied: the link's candidate id resolves through the mapping. */
export type DemoSeedAssessment = Readonly<{
	candidateId: string;
	values: IntentionAssessmentValues;
}>;

export type DemoSeedInput = Readonly<{
	locale: Locale;
	/** The instant of the import, the batch's own timestamp: no date of the notebook derives from it. */
	capturedAt: string;
}>;

export type DemoSeed = Readonly<{
	manifestId: string;
	kinds: readonly TraceKindSeed[];
	/** Direct Kind memberships by TraceKind id, as record ids. */
	kindScopes: Readonly<Record<string, readonly string[]>>;
	batch: ScenarioImportBatch;
	/** Evidence assessments to create after the batch, one per assessed `evidence_for` link. */
	assessments: readonly DemoSeedAssessment[];
}>;

export type DemoSeedRepository = Pick<
	TraceRepository,
	| 'ensureTraceKind'
	| 'setTraceKindScopes'
	| 'createEvidenceAssessment'
	| 'editScope'
	| 'listTraceKinds'
	| 'listTraces'
	| 'listScopes'
	| 'listPeriods'
	| 'listIntersections'
>;

export type DemoSeedStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type DemoSeedBootstrapInput = Readonly<{
	dataSpace: DataSpace;
	repository: DemoSeedRepository;
	importRepository: Pick<ScenarioImportRepository, 'apply'>;
	clock: () => string;
	storage: DemoSeedStorage;
	locale: Locale;
}>;

export type DemoSeedSkipReason = 'not-target' | 'marker' | 'existing-data';

export type DemoSeedCounts = Readonly<{
	kinds: number;
	scopes: number;
	traces: number;
	periods: number;
	intersections: number;
	assessments: number;
}>;

export type DemoSeedBootstrapResult =
	| Readonly<{ status: 'skipped'; reason: DemoSeedSkipReason; manifestId: string }>
	| Readonly<{ status: 'applied'; manifestId: string; counts: DemoSeedCounts }>;
