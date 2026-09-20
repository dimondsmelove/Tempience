import type { HoverTarget } from '$lib/model/Hover/types';

/** A member of the row as its chip names it: a Scope with its colour pair, or «Без Scope» in neutral. */
export type RowMember = Readonly<{
	id: string;
	name: string;
	colorHue: number | null;
	colorChroma: number | null;
	colorDepth?: number | null;
	/** What the chip lights on the ribbon: the Scope, or — for «Без Scope» — the row's unscoped records. */
	lens: HoverTarget;
}>;

/** One record of the row, once whatever its members: what the list shows and lights. */
export type RowRecord = Readonly<{
	traceId: string;
	label: string;
	/** Epoch ms of the record's start, as the ribbon places it. */
	start: number;
}>;

export type RowContext = Readonly<{
	id: string;
	name: string;
	/** The lane's fold: the member rows stand beneath the merged row. */
	expanded: boolean;
	/** The members shown, in lane order. */
	members: readonly RowMember[];
	/** `n · Σ m` as the rail counts them. */
	directCount: number;
	subtreeCount: number;
	/** Every record the row draws, once, by start time. */
	records: readonly RowRecord[];
}>;
