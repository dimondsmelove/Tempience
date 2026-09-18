import type {
	KindIndexRow,
	TraceDatasetDataFilter,
	TraceDatasetScopeMode
} from '$lib/state/triplit/trace-dataset';

export type HistoryScope = Readonly<{ id: string; mode: TraceDatasetScopeMode }>;

/** The explicit filters of a Kind's history; every one is visible while it applies. */
export type HistoryFilters = Readonly<{
	/** The versions shown, or null for every version. */
	versionIds: readonly string[] | null;
	scope: HistoryScope | null;
	/** Calendar days the record's own time must touch; blank is unconstrained. */
	from: string;
	to: string;
	values: readonly TraceDatasetDataFilter[];
}>;

/** Calendar days (YYYY-MM-DD) the record's own time must touch; blank is unconstrained. */
export type Period = Readonly<{ from: string; to: string }>;

/** Where one version's table stands: its page of dated rows, and its group without a date. */
export type VersionPages = Readonly<{ dated: number; undated: number; undatedOpen: boolean }>;

/** The index rows of one version under the period: dated, in event order, and undated apart. */
export type VersionRows = Readonly<{
	dated: readonly KindIndexRow[];
	undated: readonly KindIndexRow[];
}>;
