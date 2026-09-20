/**
 * The vocabulary of the legend (research 2026-09-18 п. 17, «Словарь насечек»):
 * every key is a kind a mark answers to, and every kind is a filter. A mark can
 * answer to several — an overdue intention is `intent` and `overdue`, a record
 * in several Scopes adds `multi`; an open interval is `open` and `interval`.
 */
export type LegendKey =
	| 'fact'
	| 'interval'
	| 'open'
	| 'fuzzy'
	| 'intent'
	| 'overdue'
	| 'closed'
	| 'fuzzyIntent'
	| 'proposal'
	| 'rollup'
	| 'multi';

/** States of the ribbon the legend explains but never filters: selection, its projections, its links. */
export type LegendStateKey = 'selected' | 'projections' | 'link';

/** Solo wins over hidden while set (п. 17): one kind alone, or everything but the hidden kinds. */
export type LegendFilter = Readonly<{
	soloLegend: LegendKey | null;
	hiddenLegend: ReadonlySet<LegendKey>;
}>;
