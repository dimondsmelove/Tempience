import { describe, expect, it } from 'vitest';
import type { KindIndexRow } from '$lib/state/triplit/trace-dataset';
import { PAGE_SIZE } from './constants';
import { clampPage, pageCount, pageOf, placeByVersion } from './order';

const row = (
	id: string,
	kindVId: string,
	key: string | null,
	capturedAt = '2026-09-01T00:00:00.000Z'
): KindIndexRow => ({
	id,
	kindVId,
	key,
	span: key ? { start: Date.parse(key), end: Date.parse(key) + 60_000 } : null,
	capturedAt
});

describe('the order of a history', () => {
	it('keeps every record in its own version, events newest first, the undated apart', () => {
		const placed = placeByVersion(
			[
				// Backdated: written with the new version about an old day; stays in the new one.
				row('backdated', 'v2', '2025-01-05T00:00:00.000Z', '2026-09-03T00:00:00.000Z'),
				row('old', 'v1', '2026-03-01T10:00:00.000Z', '2026-03-01T10:00:00.000Z'),
				row('recent', 'v2', '2026-08-01T10:00:00.000Z', '2026-08-01T10:00:00.000Z'),
				row('undated-late', 'v1', null, '2026-09-02T00:00:00.000Z'),
				row('undated-early', 'v1', null, '2026-09-01T00:00:00.000Z'),
				// The same event key: the later captured first.
				row('tie-early', 'v2', '2026-08-01T10:00:00.000Z', '2026-07-31T00:00:00.000Z')
			],
			{ from: '', to: '' }
		);
		expect(placed.get('v2')?.dated.map((entry) => entry.id)).toEqual([
			'recent',
			'tie-early',
			'backdated'
		]);
		expect(placed.get('v1')?.dated.map((entry) => entry.id)).toEqual(['old']);
		expect(placed.get('v1')?.undated.map((entry) => entry.id)).toEqual([
			'undated-late',
			'undated-early'
		]);
		expect(placed.get('v2')?.undated).toEqual([]);
	});

	it('keeps the rows whose own time touches the period, and no undated row under a bound', () => {
		const rows = [
			row('january', 'v1', '2026-01-15T10:00:00.000Z'),
			row('march', 'v1', '2026-03-15T10:00:00.000Z'),
			row('undated', 'v1', null)
		];
		const placed = placeByVersion(rows, { from: '2026-03-01', to: '' });
		expect(placed.get('v1')?.dated.map((entry) => entry.id)).toEqual(['march']);
		expect(placed.get('v1')?.undated).toEqual([]);
		expect(
			placeByVersion(rows, { from: '', to: '2026-02-01' })
				.get('v1')
				?.dated.map((entry) => entry.id)
		).toEqual(['january']);
		// A bound that does not read as a day constrains nothing.
		expect(placeByVersion(rows, { from: 'вчера', to: '' }).get('v1')?.undated).toHaveLength(1);
	});

	it('pages a list and keeps a page number within it', () => {
		const rows = Array.from({ length: PAGE_SIZE * 2 + 1 }, (_, index) => index);
		expect(pageCount(rows.length)).toBe(3);
		expect(pageCount(0)).toBe(1);
		expect(pageOf(rows, 2)).toEqual([PAGE_SIZE * 2]);
		expect(clampPage(5, rows.length)).toBe(2);
		expect(clampPage(-1, rows.length)).toBe(0);
	});
});
