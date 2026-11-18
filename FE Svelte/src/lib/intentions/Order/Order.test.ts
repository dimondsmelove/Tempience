import { describe, expect, it } from 'vitest';
import { applyOrder, beforeForPosition, orderKey, placeAt } from './Order';

describe('intention order', () => {
	const items = ['a', 'b', 'c'].map((id) => ({ id }));
	it('preserves default order and appends new cards after known IDs', () => {
		expect(applyOrder(items, [])).toEqual(items);
		expect(applyOrder(items, ['missing', 'c', 'a', 'c']).map((item) => item.id)).toEqual([
			'c',
			'a',
			'b'
		]);
	});
	it('ignores IDs that are absent from the current items', () => {
		expect(applyOrder(items, ['a', 'deleted', 'c']).map((item) => item.id)).toEqual([
			'a',
			'c',
			'b'
		]);
	});
	it('restores an item to its saved position when the saved order is unchanged', () => {
		const withoutB = items.filter((item) => item.id !== 'b');
		expect(applyOrder(withoutB, ['a', 'b', 'c']).map((item) => item.id)).toEqual(['a', 'c']);
		expect(applyOrder(items, ['a', 'b', 'c']).map((item) => item.id)).toEqual(['a', 'b', 'c']);
	});
	it('appends a restored item when the saved order was overwritten without its ID', () => {
		expect(applyOrder(items, ['c', 'a']).map((item) => item.id)).toEqual(['c', 'a', 'b']);
	});
	it('inserts at the beginning, middle and end and moves within a list', () => {
		expect(placeAt(['a', 'b'], 'c', 'a')).toEqual(['c', 'a', 'b']);
		expect(placeAt(['a', 'b'], 'c', 'b')).toEqual(['a', 'c', 'b']);
		expect(placeAt(['a', 'b'], 'c', null)).toEqual(['a', 'b', 'c']);
		expect(placeAt(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c']);
		expect(placeAt(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
	});
	it('uses the hovered card half to select the insertion boundary', () => {
		expect(beforeForPosition(['a', 'b', 'c'], 'b', false)).toBe('b');
		expect(beforeForPosition(['a', 'b', 'c'], 'b', true)).toBe('c');
		expect(beforeForPosition(['a', 'b', 'c'], 'c', true)).toBeNull();
		expect(beforeForPosition(['a'], 'missing', true)).toBeNull();
	});
	it('keys calendar lists in the grouping zone', () => {
		expect(orderKey({ kind: 'day', dayKey: '2026-09-14' }, 'UTC')).toBe('day:2026-09-14');
		expect(
			orderKey({ kind: 'week', weekStart: Date.parse('2026-09-13T22:00:00Z') }, 'Europe/Belgrade')
		).toBe('week:2026-09-14');
		expect(orderKey({ kind: 'later' }, 'UTC')).toBe('later');
		expect(orderKey({ kind: 'undated' }, 'UTC')).toBe('undated');
	});
});
