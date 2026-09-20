import type { ScopeColour } from '$lib/theme/scope-colour';
import { describe, expect, it } from 'vitest';
import type { Mark, ProjectedRow } from '$lib/model/Projection/types';
import { overviewInlays, shownRanges } from './inlays';

const DAY = 86_400_000;
const mark = (traceId: string, rowId: string, start: number, patch: Partial<Mark> = {}): Mark => ({
	id: `${traceId}@${rowId}`,
	traceId,
	rowId,
	kind: 'moment',
	intent: false,
	rollup: false,
	start,
	end: start,
	label: traceId,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact',
	...patch
});
const c = (hue: number, chroma: number | null = null): ScopeColour => ({ hue, chroma });
const row = (id: string, colours: ScopeColour[], marks: Mark[]): ProjectedRow => ({
	id,
	kind: 'scope',
	scopeId: id,
	scopeIds: [id],
	name: id,
	colours,
	depth: 0,
	hasChildren: false,
	expanded: false,
	directCount: marks.length,
	subtreeCount: marks.length,
	range: null,
	marks
});

/**
 * Белград (hue 1) holds «move» and «offer»; Работа (hue 5) holds «offer» too and rolls
 * «interview» up from its colourless child; «Без Scope» holds «dentist». The rows are what the
 * ribbon shows after its filters — the strip never looks further.
 */
const rows = [
	row(
		'belgrade',
		[c(1)],
		[mark('move', 'belgrade', 10 * DAY), mark('offer', 'belgrade', 20 * DAY)]
	),
	row(
		'work',
		[c(5)],
		[mark('offer', 'work', 20 * DAY), mark('interview', 'work', 15 * DAY, { rollup: true })]
	),
	row('unscoped', [], [mark('dentist', 'unscoped', 12 * DAY, { end: 13 * DAY })])
];

describe('shownRanges — the density reads the shown marks (B4, п. 18)', () => {
	it('lists every shown record once, with its time, at weight 1', () => {
		expect(shownRanges(rows)).toEqual([
			{ start: 10 * DAY, end: 10 * DAY, weight: 1 },
			{ start: 20 * DAY, end: 20 * DAY, weight: 1 },
			{ start: 15 * DAY, end: 15 * DAY, weight: 1 },
			{ start: 12 * DAY, end: 13 * DAY, weight: 1 }
		]);
	});

	it('a record the search misses weighs 18 %; a record the rows do not show is not there at all', () => {
		const filtered = [rows[0], rows[2]];
		expect(shownRanges(filtered, new Set(['move'])).map((item) => item.weight)).toEqual([
			0.18, 1, 1
		]);
		expect(shownRanges(filtered).some((item) => item.start === 15 * DAY)).toBe(false);
		expect(shownRanges([])).toEqual([]);
	});
});

describe('overviewInlays — a 2 px inlay at every shown record with a coloured Scope (Q2-E)', () => {
	it('gives the time and the hues in row order; two coloured Scopes are two layers; no colour, no inlay', () => {
		expect(overviewInlays(rows)).toEqual([
			{ t: 10 * DAY, colours: [c(1)], alpha: 1 },
			{ t: 20 * DAY, colours: [c(1), c(5)], alpha: 1 },
			{ t: 15 * DAY, colours: [c(5)], alpha: 0.55 }
		]);
	});

	it('a merged row colours a record by the members it answers to, not by the whole row', () => {
		const merged: ProjectedRow = {
			...row(
				'belgrade+work',
				[c(1), c(5)],
				[
					mark('move', 'belgrade+work', 10 * DAY, { colours: [c(1)] }),
					mark('offer', 'belgrade+work', 20 * DAY, { colours: [c(1), c(5)] }),
					mark('interview', 'belgrade+work', 15 * DAY, { rollup: true, colours: [] })
				]
			),
			kind: 'merged',
			scopeId: null,
			scopeIds: ['belgrade', 'work']
		};
		expect(overviewInlays([merged])).toEqual([
			{ t: 10 * DAY, colours: [c(1)], alpha: 1 },
			{ t: 20 * DAY, colours: [c(1), c(5)], alpha: 1 }
		]);
	});

	it('a roll-up stands at 55 % unless some projection is direct; a search miss takes 18 % of that', () => {
		const direct = [rows[1], row('project', [], [mark('interview', 'project', 15 * DAY)])];
		expect(overviewInlays(direct).find((inlay) => inlay.t === 15 * DAY)?.alpha).toBe(1);
		const dimmed = overviewInlays(rows, new Set(['interview', 'offer']));
		expect(dimmed.map((inlay) => Number(inlay.alpha.toFixed(4)))).toEqual([1, 0.18, 0.099]);
	});

	it('follows the filter: rows the ribbon dropped leave no inlay', () => {
		expect(overviewInlays([rows[2]])).toEqual([]);
		expect(overviewInlays(rows.filter((item) => item.id !== 'work'))).toEqual([
			{ t: 10 * DAY, colours: [c(1)], alpha: 1 },
			{ t: 20 * DAY, colours: [c(1)], alpha: 1 }
		]);
	});
});
