import type { PeriodRef } from '$lib/model/Axis/types';

/**
 * What the pointer rests on (loop 008, C2): a record (any of its marks or captions
 * on the canvas, a reference in the Context), a row (its name in the rail; the
 * row's band on the canvas is no target — owner review 2026-09-19, п. 14/15), a
 * Scope (its records with the subtree, as its row draws them), a calendar period
 * (its column and the records in it), an explicit set of records (the period's
 * records of one Scope, both ends of a link) or a Kind (its records). The canvas
 * and the rail emit `trace` and `row`; the Context attaches the rest (C3).
 */
export type HoverTarget =
	| Readonly<{ kind: 'trace'; traceId: string }>
	| Readonly<{ kind: 'row'; rowId: string }>
	| Readonly<{ kind: 'scope'; scopeId: string }>
	| Readonly<{ kind: 'period'; period: PeriodRef }>
	| Readonly<{ kind: 'traces'; traceIds: readonly string[] }>
	| Readonly<{ kind: 'kind'; kindId: string }>
	| null;

/**
 * What lights up (research 2026-09-18, п. 5; loop 008 A+B): the records drawn in
 * full force with their captions forced, in every row they project into, and
 * the rows whose names the rail sets in bold. The focus and the lens each give
 * one; the ribbon reads their union.
 */
export type LitSet = Readonly<{
	traceIds: ReadonlySet<string>;
	rowIds: ReadonlySet<string>;
}>;
