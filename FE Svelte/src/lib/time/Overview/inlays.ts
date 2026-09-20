import type { ProjectedRow } from '$lib/model/Projection/types';
import { scopeColourKey, type ScopeColour } from '$lib/theme/scope-colour';
import { SEARCH_DIM_ALPHA } from '$lib/model/Search/constants';
import { INLAY_ROLLUP_ALPHA } from './constants';
import type { OverviewInlay, WeightedRange } from './types';

/**
 * What the strip reads of one record across the rows that show it: its time (the same in
 * every projection), whether any projection is direct, and the colours of the Scopes
 * it answers to — `Mark.colours` in a merged row, the row's own colours otherwise, as the
 * ribbon paints it (`markColours`).
 */
type Shown = { start: number; end: number; direct: boolean; colours: ScopeColour[] };

/** The records the ribbon shows, each once, in the order the rows list them. */
const shownRecords = (rows: readonly ProjectedRow[]): Map<string, Shown> => {
	const shown = new Map<string, Shown>();
	for (const row of rows)
		for (const mark of row.marks) {
			const record =
				shown.get(mark.traceId) ??
				shown
					.set(mark.traceId, { start: mark.start, end: mark.end, direct: false, colours: [] })
					.get(mark.traceId)!;
			if (!mark.rollup) record.direct = true;
			for (const colour of mark.colours ?? row.colours)
				if (!record.colours.some((c) => scopeColourKey(c) === scopeColourKey(colour)))
					record.colours.push(colour);
		}
	return shown;
};

/**
 * The density's input (B4, owner review 2026-09-19, п. 18): exactly the records the ribbon
 * shows — after the legend, the Scope filters and the Scope search — each once at 1, the
 * record search's misses at 18 % (п. 9).
 */
export const shownRanges = (
	rows: readonly ProjectedRow[],
	dimmed?: ReadonlySet<string>
): WeightedRange[] =>
	[...shownRecords(rows)].map(([traceId, record]) => ({
		start: record.start,
		end: record.end,
		weight: dimmed?.has(traceId) ? SEARCH_DIM_ALPHA : 1
	}));

/**
 * The colour inlays of the strip (Q2-E, owner 2026-09-19): one at the time of every shown
 * record that answers to a coloured Scope, carrying the colours of those Scopes in row order —
 * one colour paints the strip's height, several stack as layers top to bottom. A record shown
 * only as a roll-up stands at 55 %; a search miss at 18 % of that. A record with no coloured
 * Scope adds nothing but its grey weight.
 */
export const overviewInlays = (
	rows: readonly ProjectedRow[],
	dimmed?: ReadonlySet<string>
): OverviewInlay[] => {
	const inlays: OverviewInlay[] = [];
	for (const [traceId, record] of shownRecords(rows)) {
		if (record.colours.length === 0) continue;
		inlays.push({
			t: record.start,
			colours: record.colours,
			alpha:
				(record.direct ? 1 : INLAY_ROLLUP_ALPHA) * (dimmed?.has(traceId) ? SEARCH_DIM_ALPHA : 1)
		});
	}
	return inlays;
};
