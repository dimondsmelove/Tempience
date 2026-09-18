import type { JsonObject, JsonPrimitive } from '../types';

export type TraceDatasetScopeMode = 'direct' | 'subtree';

export type TraceDatasetScalarType = 'string' | 'number' | 'boolean';

export type TraceDatasetValueType = TraceDatasetScalarType | 'string[]';

export type TraceDatasetStoredCoreField =
	| 'capturedAt'
	| 'timezone'
	| 'aboutKind'
	| 'aboutAt'
	| 'aboutStart'
	| 'aboutEnd'
	| 'aboutTraceId'
	| 'content'
	| 'description'
	| 'relation'
	| 'createdAt'
	| 'updatedAt';

export type TraceDatasetCoreField = TraceDatasetStoredCoreField | 'aboutDate';

export type TraceDatasetColumn =
	| {
			key: string;
			source: 'core';
			field: TraceDatasetCoreField;
	  }
	| {
			key: string;
			source: 'data';
			path: readonly string[];
			expectedType: TraceDatasetValueType;
	  }
	| {
			key: string;
			source: 'item';
			path: readonly string[];
			expectedType: TraceDatasetValueType;
	  };

export type TraceDatasetRepeat = {
	path: readonly string[];
};

export type TraceDatasetFilterOperator =
	'=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'nin' | 'like' | 'nlike' | 'isDefined';

export type TraceDatasetDataFilter = {
	path: readonly string[];
	expectedType: TraceDatasetScalarType;
	operator: TraceDatasetFilterOperator;
	value: JsonPrimitive | readonly JsonPrimitive[];
};

export type TraceDatasetTimeRange = {
	field: 'capturedAt' | 'aboutAt' | 'aboutStart' | 'aboutEnd';
	from?: string;
	to?: string;
};

export type TraceDatasetRequest = {
	kindId: string;
	/** One version's rows only: its own schema is then the only one the columns are checked against. */
	kindVId?: string;
	/** Only these records, when given — a page — answered by lookup; an empty list reads nothing. */
	ids?: readonly string[];
	scope?: {
		id: string;
		mode: TraceDatasetScopeMode;
	};
	time?: TraceDatasetTimeRange;
	filters?: readonly TraceDatasetDataFilter[];
	repeat?: TraceDatasetRepeat;
	columns: readonly TraceDatasetColumn[];
	order?: {
		field: TraceDatasetStoredCoreField;
		direction: 'ASC' | 'DESC';
	};
	limit?: number;
	includeDeleted?: boolean;
};

export type TraceDatasetCell = JsonPrimitive | readonly string[];

export type TraceDatasetRow = {
	traceId: string;
	kindVId: string;
	itemIndex?: number;
	values: Record<string, TraceDatasetCell>;
};

export type TraceDatasetCompatibilityIssue = {
	kindVId: string;
	generation: number;
	path: string[];
	expectedType: TraceDatasetValueType;
	actualType: string | null;
	reason: 'type_mismatch' | 'unsupported_schema';
};

export type TraceDatasetSnapshotBase = {
	kindId: string;
	resolvedScopeIds: string[] | null;
};

/** What a live query of one Kind's rows answers with, whatever the rows are. */
export type KindRowsSnapshot<Row> =
	| (TraceDatasetSnapshotBase & { status: 'loading' })
	| (TraceDatasetSnapshotBase & { status: 'ready'; rows: Row[] })
	| (TraceDatasetSnapshotBase & {
			status: 'incompatible';
			issues: TraceDatasetCompatibilityIssue[];
	  })
	| (TraceDatasetSnapshotBase & { status: 'error'; message: string });

export type TraceDatasetSnapshot = KindRowsSnapshot<TraceDatasetRow>;

/**
 * The thin index of one Kind's history: every active record of the Kind under the Scope and
 * value filters, with what orders and places it and nothing else — no data, no text. The
 * version, the event-time filter, the order and the pages are the reader's own work on it.
 */
export type KindIndexRequest = {
	kindId: string;
	scope?: TraceDatasetRequest['scope'];
	filters?: readonly TraceDatasetDataFilter[];
};

export type KindIndexRow = {
	id: string;
	kindVId: string;
	/** The E3 event key, or null for a record without one: unknown, relative, by reference. */
	key: string | null;
	/** The calendar span the record's time covers, or null without one. */
	span: { start: number; end: number } | null;
	capturedAt: string;
	/** The stored time could not be read: the record is listed without a date, and says so. */
	unreadable?: true;
};

export type KindIndexSnapshot = KindRowsSnapshot<KindIndexRow>;

export type TraceDatasetReader = {
	subscribeTraceDataset: (
		request: TraceDatasetRequest,
		callback: (snapshot: TraceDatasetSnapshot) => void
	) => () => void;
	/**
	 * One read of the rows, answered as the live query's snapshot would be; a page by ids is a
	 * lookup. A Scope is not resolved here: a read of a page names its rows already.
	 */
	readTraceDataset: (request: TraceDatasetRequest) => Promise<TraceDatasetSnapshot>;
	subscribeKindIndex: (
		request: KindIndexRequest,
		callback: (snapshot: KindIndexSnapshot) => void
	) => () => void;
};

export type UnknownRecord = Record<string, unknown>;

export type Unsubscribe = () => void;

export type StoredTraceKindV = {
	id: string;
	generation: number;
	dataSchema: JsonObject | null;
};

export type ScopeHierarchyEdge = {
	id: string;
	fromId: string;
	toId: string;
};

export type DataRequirement = {
	source: 'data' | 'item';
	path: readonly string[];
	expectedType: TraceDatasetValueType;
};
