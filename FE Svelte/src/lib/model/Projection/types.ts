import type { Locale } from '$lib/state/Locale/types';
import type { ProposalDecision } from '$lib/model/Proposals/types';
import type {
	IntersectionKind,
	TemporalCertainty,
	TemporalPrecision
} from '$lib/state/triplit/types';

/** Silhouette of a record on the ribbon (DESIGN.md §5). Intent is a modifier, not a kind. */
export type MarkKind = 'moment' | 'interval' | 'fuzzy';

/** Legend items; every one is a filter (DESIGN.md §7). `proposal` marks a manifest candidate before Apply. */
export type LegendKey = MarkKind | 'intent' | 'proposal' | 'scopeRange' | 'rollup';

export type TimeRange = Readonly<{ start: number; end: number }>;

/** Where and how a record sits on the axis, independent of rows. */
export type MarkTime = Readonly<{
	kind: MarkKind;
	intent: boolean;
	/** Epoch ms; moments carry the same value in both fields. */
	start: number;
	end: number;
	precision: TemporalPrecision;
	certainty: TemporalCertainty;
}>;

export type Mark = Readonly<
	MarkTime & {
		/** `${traceId}@${rowId}`: one record can project into several rows. */
		id: string;
		traceId: string;
		rowId: string;
		/** A subtree record shown through a collapsed group at 0.25 (DP8). */
		rollup: boolean;
		/** A manifest candidate before Apply, drawn hollow and dashed in amber (DP15). */
		proposal?: boolean;
		/** An intention that is closed now, drawn muted with its outcome glyph in the caption. */
		closed?: boolean;
		label: string;
		timeLabel: string;
	}
>;

export type RowKind = 'scope' | 'unscoped' | MarkKind;
export type RowGrouping = 'scope' | 'kind';

export type ProjectedRow = Readonly<{
	id: string;
	kind: RowKind;
	scopeId: string | null;
	name: string;
	depth: number;
	hasChildren: boolean;
	expanded: boolean;
	/** `n · Σ m`: direct records and the whole subtree, deduplicated by traceId. */
	directCount: number;
	subtreeCount: number;
	/** First to last record of the set that draws in the row, before legend filters. */
	range: TimeRange | null;
	marks: readonly Mark[];
}>;

export type ParkedReason = 'relative' | 'unknown' | 'trace_ref';

export type ParkedTrace = Readonly<{
	traceId: string;
	label: string;
	/** An intention that is closed now. */
	closed?: boolean;
	reason: ParkedReason;
	scopeIds: readonly string[];
}>;

/** An explicit record-to-record link, drawn as an arc while one end is selected. */
export type TraceLink = Readonly<{
	fromTraceId: string;
	toTraceId: string;
	kind: IntersectionKind;
}>;

export type ProjectionState = Readonly<{
	/** Group rows whose children are shown; collapsed groups roll their subtree up. */
	expanded: ReadonlySet<string>;
	/** Scopes hidden with the eye; their subtree leaves the ribbon and the roll-ups. */
	hiddenScopes: ReadonlySet<string>;
	/** «Только эти Scope»: keeps these, their ancestors and descendants. */
	onlyScopes: ReadonlySet<string> | null;
	hiddenLegend: ReadonlySet<LegendKey>;
	/** Trace Kinds whose records the ribbon shows; typed records stay off the rows and the parked list until their Kind is chosen here (ANSWERS 2026-09-15). */
	shownKindIds?: ReadonlySet<string>;
	/** Scope-name filter; ancestor rows keep the path, not unrelated direct records. */
	scopeQuery: string;
	grouping: RowGrouping;
	/** The language the projection names its own rows in; Russian when unsaid. */
	language?: Locale;
	/** Decisions of the proposed records on the ribbon, by their preview id. */
	proposals?: ReadonlyMap<string, ProposalDecision>;
}>;

export type ProjectionCounts = Readonly<{
	rows: number;
	/** Distinct records with an absolute time anywhere in the snapshot. */
	onAxis: number;
	intents: number;
	proposals: number;
	parked: number;
}>;

export type Projection = Readonly<{
	rows: readonly ProjectedRow[];
	parked: readonly ParkedTrace[];
	counts: ProjectionCounts;
	/** Whole data range on the axis, for the overview strip. */
	extent: TimeRange | null;
	/** Every projection of a record across the visible rows (copies). */
	marksByTraceId: ReadonlyMap<string, readonly Mark[]>;
	timeByTraceId: ReadonlyMap<string, MarkTime>;
	links: readonly TraceLink[];
}>;
