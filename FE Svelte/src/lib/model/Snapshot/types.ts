import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
import type { KindCatalog } from '$lib/model/TraceForm/summary';
import type {
	IntersectionKind,
	JsonObject,
	PeriodTime,
	TraceAboutKind,
	TraceAboutTime,
	TraceDuration,
	TraceRelation
} from '$lib/state/triplit/types';

export type ExplorerOriginKind = 'calibration' | 'synthetic-conformance' | 'canonical';

export type ExplorerOrigin = Readonly<{
	kind: ExplorerOriginKind;
	sourceId: string;
}>;

type ExplorerRecord<Value> = Readonly<Value & { origin: ExplorerOrigin }>;

export type ExplorerTrace = ExplorerRecord<{
	id: string;
	content: string;
	/** The plain record's optional description; a typed record keeps its own in `content`. */
	description?: string | null;
	/** The typed record's row title, read through its Kind version in one language. */
	displayTitle?: string;
	displayFields?: readonly { label: string; value: string }[];
	/** The row summary of a typed record; what a thin read of the record carries. */
	conciseFields?: readonly { label: string; value: string }[];
	kindLabel?: string;
	kindGeneration?: number;
	relation: TraceRelation | null;
	timezone: string;
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime | null;
	statedDuration?: TraceDuration | null;
	aboutTraceId: string | null;
	kindId: string | null;
	kindVId: string | null;
	data: JsonObject | null;
	/** An intention's derived result at the time of the snapshot (core/intersections): absent for facts. */
	intentOpen?: boolean;
	intentOutcome?: IntentionOutcome | null;
	/**
	 * When a closed intention was closed (loop 008, C4), as a UTC instant: the closing fact's
	 * time as the ribbon places it for an evidence source, the action instant for a direct one;
	 * `null` when the fact has no absolute placement. Absent on open intentions and on facts.
	 */
	intentClosedAt?: string | null;
	/** A fact that is the effective closing evidence of these intentions (C4): its result follows them. */
	closesIntentionIds?: readonly string[];
}>;

export type ExplorerScope = ExplorerRecord<{
	id: string;
	name: string;
	note: string | null;
	startedAt: string | null;
	endedAt: string | null;
	/** The hue (0–359) the Scope is coloured with, the theme adding only its mode; `null` means ink. */
	colorHue: number | null;
	/** Saturation 0–100 of that hue; `null` is the default (R1). */
	colorChroma: number | null;
	/** Depth 0–2 of that hue (C6); absent or `null` is 0 — a Scope stored before the third ring. */
	colorDepth?: number | null;
}>;

export type ExplorerPeriod = ExplorerRecord<{
	id: string;
	name: string;
	time: PeriodTime;
	timezone: string;
	note: string | null;
}>;

export type ExplorerIntersection = ExplorerRecord<{
	id: string;
	fromId: string;
	toId: string;
	kind: IntersectionKind;
	context: string | null;
}>;

export type ExplorerScopeSegment = ExplorerRecord<{
	id: string;
	scopeId: string;
	startAt: string | null;
	endAt: string | null;
	label: string | null;
	position: number;
}>;

export type ExplorerAnchorRole = 'trace' | 'scope' | 'period' | 'intersection';
export type ExplorerEntityRole = ExplorerAnchorRole | 'scopeSegment';

export type ExplorerAnchorEntity =
	| Readonly<{ role: 'trace'; record: ExplorerTrace }>
	| Readonly<{ role: 'scope'; record: ExplorerScope }>
	| Readonly<{ role: 'period'; record: ExplorerPeriod }>
	| Readonly<{ role: 'intersection'; record: ExplorerIntersection }>;

export type ExplorerEntity =
	ExplorerAnchorEntity | Readonly<{ role: 'scopeSegment'; record: ExplorerScopeSegment }>;

export type ExplorerAnchor = Readonly<{
	role: ExplorerAnchorRole;
	entityId: string;
}>;

export type ExplorerSnapshot = Readonly<{
	/** The catalogs the typed records were displayed through; the display can be redone in another language. */
	catalog?: KindCatalog;
	traces: readonly ExplorerTrace[];
	scopes: readonly ExplorerScope[];
	periods: readonly ExplorerPeriod[];
	intersections: readonly ExplorerIntersection[];
	scopeSegments: readonly ExplorerScopeSegment[];
}>;
