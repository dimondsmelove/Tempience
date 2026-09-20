import type { ScopeColour } from '$lib/theme/scope-colour';
import type { Locale } from '$lib/state/Locale/types';
import type { RowArrangement } from '$lib/model/Arrangement/types';
import type { LegendKey } from '$lib/model/Legend/types';
import type { ProposalDecision } from '$lib/model/Proposals/types';
import type {
	IntersectionKind,
	TemporalCertainty,
	TemporalPrecision
} from '$lib/state/triplit/types';

/** Silhouette of a record on the ribbon (DESIGN.md §5). Intent is a modifier, not a kind. */
export type MarkKind = 'moment' | 'interval' | 'fuzzy';

/** The legend vocabulary lives in `model/Legend`; re-exported for the projection's own callers. */
export type { LegendKey };

export type TimeRange = Readonly<{ start: number; end: number }>;

/** Where and how a record sits on the axis, independent of rows. */
export type MarkTime = Readonly<{
	kind: MarkKind;
	intent: boolean;
	/** Epoch ms; moments carry the same value in both fields. */
	start: number;
	end: number;
	/** End of the record's whole window when it is not `end`: a moment's day or slot. «Просроченное» is decided against it (research п. 11). */
	until?: number;
	/** An interval that has started and has no end yet («длится», п. 8): `end` is «сейчас» of the projection, or the start itself while that lies ahead. */
	open?: boolean;
	precision: TemporalPrecision;
	certainty: TemporalCertainty;
}>;

export type Mark = Readonly<
	MarkTime & {
		/** `${traceId}@${rowId}`: one record can project into several rows. */
		id: string;
		traceId: string;
		rowId: string;
		/** A subtree record shown through a collapsed group at 30 % (DP8, research п. 3). */
		rollup: boolean;
		/** A manifest candidate before Apply, drawn as the hollow contour of what it would become (DP15, research п. 13). */
		proposal?: boolean;
		/** An intention that is closed now: a 45 % capsule under its tick, the outcome glyph in the caption (research п. 12). */
		closed?: boolean;
		/**
		 * Epoch ms of the closing (loop 008, C4), on a closed intention whose closing instant is
		 * known: the marker and the hairline while its caption is forced.
		 */
		closedAt?: number;
		/** A fact that is the effective closing evidence of an intention (C4): it follows the intentions under the legend's solo. */
		result?: boolean;
		/** The record belongs to more than one Scope: «в нескольких Scope» in the legend (research п. 17). */
		multi?: boolean;
		/**
		 * In a merged row: the colours of the row's members this record answers to, in lane
		 * order — one paints plainly, several weave (research п. 2, 7). Absent in a one-Scope row,
		 * whose own colour paints every mark.
		 */
		colours?: readonly ScopeColour[];
		label: string;
		/** The caption while forced, when it says more than `label`: a closed intention adds its closing day (C4). */
		forcedLabel?: string;
		timeLabel: string;
	}
>;

/** `merged`: a lane of several Scopes arranged into one row (research п. 7); no single Scope; its chevron unfolds its members beneath it (C5). */
export type RowKind = 'scope' | 'merged' | 'unscoped' | MarkKind;
export type RowGrouping = 'scope' | 'kind';

export type ProjectedRow = Readonly<{
	id: string;
	kind: RowKind;
	/** The one Scope of a plain Scope row; `null` for a merged row and for every other row kind. */
	scopeId: string | null;
	/** The Scopes the row shows: `[scopeId]` for a Scope row, the members of a merged row, `[]` otherwise. */
	scopeIds: readonly string[];
	name: string;
	/** The colours (hue + saturation) of the row's Scopes that have one, in member order: the rail's dots. */
	colours: readonly ScopeColour[];
	depth: number;
	/** A group row with children to unfold, or a merged row — its members unfold beneath it (C5). */
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

/** An explicit record-to-record link, drawn as a bracket while one end is selected (research п. 15). */
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
	/** Legend kinds hidden with Shift+click; a mark answering to any of them leaves the ribbon. */
	hiddenLegend: ReadonlySet<LegendKey>;
	/** «Соло»: only the marks answering to this kind stay; wins over `hiddenLegend` while set (research п. 17). */
	soloLegend?: LegendKey | null;
	/** Epoch ms of «сейчас», deciding «просроченное» (research п. 11); the clock's now when unsaid. */
	now?: number;
	/** Trace Kinds whose records the ribbon shows; typed records stay off the rows and the parked list until their Kind is chosen here (ANSWERS 2026-09-15). */
	shownKindIds?: ReadonlySet<string>;
	/** Scope-name filter; ancestor rows keep the path, not unrelated direct records. */
	scopeQuery: string;
	grouping: RowGrouping;
	/** The language the projection names its own rows in; Russian when unsaid. */
	language?: Locale;
	/** Decisions of the proposed records on the ribbon, by their preview id. */
	proposals?: ReadonlyMap<string, ProposalDecision>;
	/**
	 * The rows as arranged on this device (research п. 7): lanes of Scopes in order, a lane of
	 * several as one merged row. Absent or `null`: the Scope tree as it is. Scope grouping only.
	 */
	arrangement?: RowArrangement | null;
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
	/** Legend kinds at least one mark of the rows answers to, before the legend filter: what the legend lists. */
	legendKeys: ReadonlySet<LegendKey>;
}>;
