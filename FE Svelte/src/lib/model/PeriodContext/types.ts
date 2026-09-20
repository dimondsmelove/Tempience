import type { PeriodRef } from '$lib/model/Axis/types';
import type { MarkTime } from '$lib/model/Projection/types';
import type { ExplorerPeriod } from '$lib/model/Snapshot/types';

/** A Scope as the period names it: its name and the colour pair that tints its chip. */
export type PeriodScope = Readonly<{
	id: string;
	name: string;
	colorHue: number | null;
	colorChroma: number | null;
	colorDepth?: number | null;
}>;

/** One record of the period, listed once whatever its Scopes; `scopes` is empty for «Без Scope». */
export type PeriodRecord = Readonly<{
	traceId: string;
	label: string;
	time: MarkTime;
	/** The record's Scopes that are in the snapshot, in rail order: what its row lights up. */
	scopes: readonly PeriodScope[];
}>;

/** What the pointer or the keyboard focus rests on in the period: an active-Scope chip or a record. */
export type PeriodFocus = Readonly<{ kind: 'scope' | 'trace'; id: string }> | null;

/** What a focus lights up: the records of that Scope, or the Scopes of that record. */
export type PeriodEmphasis = Readonly<{
	traceIds: ReadonlySet<string>;
	scopeIds: ReadonlySet<string>;
}>;

/**
 * How the period's list gives way under a focus (loop 008, C3, B): under a chip the records of
 * the other Scopes fold away and the other chips dim; under a record the other records dim and
 * nothing moves. Ids of what folds or dims; empty sets without a focus.
 */
export type PeriodFade = Readonly<{
	/** Records folded away (height 0): the ones outside the hovered Scope. */
	folded: ReadonlySet<string>;
	/** Records at 0.35: every other record while one is hovered. */
	dimmedTraceIds: ReadonlySet<string>;
	/** Chips at 0.35: every other chip while one is hovered. */
	dimmedScopeIds: ReadonlySet<string>;
}>;

/** Neighbouring calendar periods: same unit around, one unit up, the units inside. */
export type PeriodNeighbors = Readonly<{
	previous: PeriodRef;
	next: PeriodRef;
	parent: PeriodRef | null;
	children: readonly PeriodRef[];
}>;

export type PeriodContext = Readonly<{
	period: PeriodRef;
	title: string;
	/** The persisted Period whose bounds match the calendar period, if one exists. */
	record: ExplorerPeriod | null;
	note: string | null;
	/** Every record inside the period once, by start time (an open interval by its start). */
	records: readonly PeriodRecord[];
	/** Distinct records inside the period. */
	traceCount: number;
	/** The Scopes that have records in the period, in rail order. */
	activeScopes: readonly PeriodScope[];
	neighbors: PeriodNeighbors;
}>;
