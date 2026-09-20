import type { Mark, ProjectedRow } from '$lib/model/Projection/types';
import { scopeColourKey, type ScopeColour } from '$lib/theme/scope-colour';
import {
	BAND_MIN_WIDTH_PX,
	BAND_TONE,
	CAPSULE_WIDTH_PX,
	CLOSED_GAP_TONE,
	HOLLOW_MOMENT_WIDTH_PX,
	MARK_ALPHA,
	ROLLUP_ALPHA,
	SELECTED_ALPHA,
	WOVEN_CAPSULE_WIDTH_PX
} from './constants';
import type { MarkExtent, MarkStyle, MarkStyleInput } from './types';

/**
 * The mark language without frames (research 2026-09-18, п. 3, 11–14, 18):
 * a fact is a solid capsule; an interval a 30 % band with a solid head; a
 * fuzzy date the band alone, no head; an open intention a dotted tick; a
 * closed one the tick over a 45 % capsule; a fuzzy intention the band with
 * the tick at the window start; a proposal the hollow contour of what it
 * would become; an open interval («длится») the band to «сейчас» with its
 * head at the start, or the head alone while the start lies ahead (п. 8).
 * Overdue is not marked: the position left of «сейчас» says it. Roll-ups
 * are the one dimness; selection adds the ring, never a colour; a lit
 * (hovered) record draws in full force like the selected one (п. 5, 18).
 */
export const markStyle = (
	mark: MarkStyleInput,
	options: Readonly<{ selected: boolean; lit?: boolean }>
): MarkStyle => {
	const alpha =
		options.selected || options.lit ? SELECTED_ALPHA : mark.rollup ? ROLLUP_ALPHA : MARK_ALPHA;
	// An open interval that has not started yet has nothing to span: the head alone, as a point.
	const span = mark.kind !== 'moment' && !(mark.open && mark.end <= mark.start);
	const base = { alpha, span, ring: options.selected };
	if (mark.proposal) return { ...base, band: null, capsule: null, tick: false, hollow: true };
	const band = span ? BAND_TONE : null;
	if (mark.intent) {
		return {
			...base,
			band,
			capsule: mark.closed ? CLOSED_GAP_TONE : null,
			tick: true,
			hollow: false
		};
	}
	// A fuzzy date has no head: a head would claim a position the record does not have (п. 14).
	return { ...base, band, capsule: mark.kind === 'fuzzy' ? null : 1, tick: false, hollow: false };
};

/** A fact's capsule and an interval's head: 3 px, one more when woven (п. 3). */
export const capsuleWidth = (woven: boolean): number =>
	woven ? WOVEN_CAPSULE_WIDTH_PX : CAPSULE_WIDTH_PX;

/**
 * Pixel extent of a mark from its box: a point widens to the capsule (3 px, 4 px
 * woven, 7 px hollow) around the box centre; a span keeps the box, at least wide
 * enough to show past its head. Links meet a point at its centre and a span at
 * its head. The captions start after this extent, so what is drawn is what they
 * keep clear of (owner review 2026-09-19, pack 4).
 */
export const markExtent = (
	box: Readonly<{ x0: number; x1: number }>,
	style: Pick<MarkStyle, 'span' | 'hollow'>,
	woven: boolean
): MarkExtent => {
	const narrow = capsuleWidth(woven);
	if (style.span) {
		const x = Math.round(box.x0);
		const w = Math.max(
			style.hollow ? HOLLOW_MOMENT_WIDTH_PX : BAND_MIN_WIDTH_PX,
			Math.round(box.x1) - x
		);
		return { x, w, anchorX: x + narrow / 2 };
	}
	const w = style.hollow
		? HOLLOW_MOMENT_WIDTH_PX
		: Math.max(narrow, Math.round(box.x1) - Math.round(box.x0));
	const x = Math.round((box.x0 + box.x1) / 2 - w / 2);
	return { x, w, anchorX: x + w / 2 };
};

/**
 * Whether a mark weaves — answers to Scopes of more than one colour (п. 7) — read
 * from the colours themselves. The canvas decides the same through the palette
 * (`markColours`); the layout, which has no palette, decides here for the captions.
 */
export const wovenColours = (colours: readonly ScopeColour[] | undefined): boolean =>
	new Set(colours?.map(scopeColourKey)).size > 1;

/** What the colour resolution needs from the canvas palette: ink, and the colour rule of the mode. */
export type ScopePalette = Readonly<{ ink: string; scope: (colour: ScopeColour) => string }>;

/**
 * Colours of a mark from the Scope colours it answers to, in order and
 * without repeats; a mark with no coloured Scope is ink (п. 2). One colour
 * paints plainly, several weave. A pair (hue, saturation) becomes a colour
 * through the palette's rule for the current mode (R1: `theme/scope-colour.ts`).
 */
export const resolveColours = (
	colours: readonly (ScopeColour | null | undefined)[],
	palette: ScopePalette
): readonly string[] => {
	const resolved: string[] = [];
	for (const colour of colours) {
		const value = colour == null ? undefined : palette.scope(colour);
		if (value && !resolved.includes(value)) resolved.push(value);
	}
	return resolved.length ? resolved : [palette.ink];
};

/** Colours of a row itself — its range band — from the colours of its Scopes; ink without one. */
export const rowColours = (
	row: Pick<ProjectedRow, 'colours'>,
	palette: ScopePalette
): readonly string[] => resolveColours(row.colours, palette);

/**
 * Colours of one mark: in a merged row the colours of the members the record
 * answers to, so a record in two of them weaves (research п. 2, 7); in a
 * one-Scope row the row's own colour.
 */
export const markColours = (
	row: Pick<ProjectedRow, 'colours'>,
	mark: Pick<Mark, 'colours'>,
	palette: ScopePalette
): readonly string[] => resolveColours(mark.colours ?? row.colours, palette);
