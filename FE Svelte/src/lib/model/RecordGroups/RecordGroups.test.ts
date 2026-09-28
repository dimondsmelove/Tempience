import { describe, expect, it } from 'vitest';
import { groupLabel, groupRecords, recordShape } from './RecordGroups';

const D = (month: number, day: number): number => Date.UTC(2026, month - 1, day, 10);
const items = (...days: [number, number][]) => days.map(([m, d]) => ({ at: D(m, d) }));

describe('recordShape', () => {
	it('draws an intention dotted before anything else, then by the kind of its time', () => {
		expect(recordShape({ kind: 'interval', intent: true })).toBe('intent');
		expect(recordShape({ kind: 'interval', intent: false })).toBe('interval');
		expect(recordShape({ kind: 'fuzzy', intent: false })).toBe('fuzzy');
		expect(recordShape(undefined)).toBe('fact');
	});
});

describe('groupRecords', () => {
	it('cuts a list by ISO weeks in its own order', () => {
		const groups = groupRecords(items([9, 16], [9, 14], [9, 13], [9, 8]), 'week', 'ru');
		expect(groups.map((group) => group.items.length)).toEqual([2, 2]);
		expect(groups[0].label).toMatch(/38 · 14–20 сент\./u);
		expect(groups[1].label).toMatch(/37 · 7–13 сент\./u);
	});
	it('keeps a short list, or one inside a single stretch, whole and unlabelled', () => {
		expect(groupRecords(items([9, 16], [9, 1]), 'week', 'ru')).toHaveLength(1);
		const one = groupRecords(items([9, 14], [9, 15], [9, 16], [9, 17]), 'week', 'ru');
		expect(one).toEqual([{ key: 0, label: '', items: one[0].items }]);
		expect(groupRecords(items([9, 16], [8, 1], [7, 1], [6, 1]), null, 'ru')).toHaveLength(1);
	});
	it('names a week over two months with both, a month in full', () => {
		expect(groupLabel(Date.UTC(2026, 7, 31), 'week', 'ru')).toMatch(/31 авг\.–6 сент\./u);
		expect(groupLabel(Date.UTC(2026, 8, 1), 'month', 'ru')).toMatch(/сентябрь 2026/u);
	});
});
