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
}>;

export type ExplorerScope = ExplorerRecord<{
	id: string;
	name: string;
	note: string | null;
	startedAt: string | null;
	endedAt: string | null;
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
