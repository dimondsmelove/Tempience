import type { Mark } from '$lib/model/Projection/types';

/**
 * The record features the mark language reads; everything else about a mark is geometry.
 * `start`/`end` are read for one thing: an open interval whose start still lies ahead has
 * `end === start` and shows its head alone (п. 8).
 */
export type MarkStyleInput = Pick<
	Mark,
	'kind' | 'intent' | 'rollup' | 'proposal' | 'closed' | 'open' | 'start' | 'end'
>;

/**
 * How one mark looks, decided before any canvas call (research 2026-09-18,
 * «Словарь насечек»). Elements compose: an interval is a band with a solid
 * head, a closed intention a 45 % capsule with the dotted tick on top, a fuzzy
 * intention the band with the tick at the window start.
 */
export type MarkStyle = Readonly<{
	/** Opacity of the whole mark: 0.9, 1 for the selected or lit record, 0.3 for a roll-up — the only dimness. */
	alpha: number;
	/** The box is a window on the axis (interval, fuzzy date), not a point: the head stays narrow. */
	span: boolean;
	/** A band across the whole box at this share of the tone; `null` for a point. */
	band: number | null;
	/** A solid capsule at this share of the tone: a fact, the interval's head, the closed intention; `null` when none. */
	capsule: number | null;
	/** A dotted vertical tick (3 px dot / 2 px gap) at the start: an intention. */
	tick: boolean;
	/** A 1 px contour of the future silhouette instead of any fill: a proposal. */
	hollow: boolean;
	/** The selection ring 2 px outside the silhouette. */
	ring: boolean;
}>;

/** Where the silhouette of a mark stands on the row, and where a link meets it. */
export type MarkExtent = Readonly<{ x: number; w: number; anchorX: number }>;

export type WeaveMode = 'layers' | 'stripes';

/** One filled rectangle of a woven mark. */
export type WeaveRect = Readonly<{ colour: string; x: number; y: number; w: number; h: number }>;

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
