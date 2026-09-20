import { describe, expect, it } from 'vitest';
import { dimmedTraceIds, matchesQuery, normalizeQuery } from './Search';

const records = [
	{ id: 'move', content: 'Переезд в Белград', description: null },
	{ id: 'course', content: 'Курс сербского', description: 'Группа A2, вечер' },
	{ id: 'weight', content: '72 кг', displayTitle: 'Вес · 72 кг' },
	{ id: 'dentist', content: 'Стоматолог' }
];

describe('record search (п. 9, Q2-A)', () => {
	it('normalises the query: trimmed and case-folded, empty when blank', () => {
		expect(normalizeQuery('  БелГрад ')).toBe('белград');
		expect(normalizeQuery('   ')).toBe('');
	});

	it('matches the title case-insensitively', () => {
		expect(matchesQuery(records[0], 'белград')).toBe(true);
		expect(matchesQuery(records[0], 'ПЕРЕЕЗД')).toBe(true);
		expect(matchesQuery(records[0], 'курс')).toBe(false);
	});

	it('matches the description and the displayed title of a typed record', () => {
		expect(matchesQuery(records[1], 'вечер')).toBe(true);
		expect(matchesQuery(records[2], 'вес')).toBe(true);
		expect(matchesQuery(records[3], 'вечер')).toBe(false);
	});

	it('an empty query matches everything and dims nothing', () => {
		expect(matchesQuery(records[3], '')).toBe(true);
		expect(dimmedTraceIds('', records).size).toBe(0);
		expect(dimmedTraceIds('   ', records)).toBe(dimmedTraceIds('', records));
	});

	it('dims exactly the records that do not match', () => {
		expect([...dimmedTraceIds('кг', records)].toSorted()).toEqual(['course', 'dentist', 'move']);
		expect([...dimmedTraceIds('zzz', records)].toSorted()).toEqual([
			'course',
			'dentist',
			'move',
			'weight'
		]);
	});
});
