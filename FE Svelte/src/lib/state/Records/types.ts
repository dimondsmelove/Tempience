import type { TraceSummary } from '$lib/model/TraceForm/summary';
import type { SupplementState } from '$lib/state/triplit/Traces/supplement';
import type { IntentionResultView } from './result';
import type { Trace, TraceIntersectionKind } from '$lib/state/triplit/types';

/** What is known about the record at the other end of a link. */
export type EndpointState =
	/** Present and active: the ordinary neighbour the timeline also shows. */
	| 'active'
	/** Present and deleted: known, readable, and not part of the active timeline. */
	| 'deleted'
	/** Not on this replica at all: nothing is known beyond the link naming it. */
	| 'unavailable';

/** A link of the selected record together with the record at its other end. */
export type LinkedRecord = Readonly<{
	/** The stored link, or null for a reference carried by the record's own fields. */
	linkId: string | null;
	kind: TraceIntersectionKind | 'trace_ref' | 'temporal_anchor';
	direction: 'outgoing' | 'incoming';
	otherId: string;
	state: EndpointState;
	/** The other record as stored, when this replica has it. */
	trace: Trace | null;
	/** How the other record is named in a row; null when nothing is known about it. */
	summary: TraceSummary | null;
}>;

/** One Scope this record belongs to, or belonged to until the membership was withdrawn. */
export type Membership = Readonly<{
	linkId: string;
	scopeId: string;
	/** The Scope's name, or null when this replica does not hold the Scope. */
	name: string | null;
	active: boolean;
}>;

/** Every row the reader resolved for one record, with the rows it could not resolve. */
export type LinkedRecords = Readonly<{
	traceId: string;
	links: readonly LinkedRecord[];
	/** The record itself, as stored; null when it is not on this replica. */
	trace: Trace | null;
	/** How the record itself is named and what its own typed values are; null when it is absent. */
	summary: TraceSummary | null;
	/**
	 * The Scope memberships of this record, withdrawn ones included. The Context lists them in
	 * «Принадлежность» rather than among the links, and they are consequences of this record.
	 */
	memberships: readonly Membership[];
	/** What this record is as a supplement (P4), or null when it is not a marker. */
	supplement: SupplementState | null;
	/** The result of this record as an intention, with every statement behind it. */
	result: IntentionResultView | null;
	/**
	 * Links this record no longer has: withdrawn by hand or by a Scope deletion. The active
	 * edges of the snapshot cannot find them, and the history needs them by name.
	 */
	withdrawnLinks: readonly LinkedRecord[];
	/**
	 * Statements that started at this record, whatever became of them: withdrawn, or moved
	 * to another intention by a correction. Their current placement may be elsewhere.
	 */
	pastSourceIds: readonly string[];
}>;
