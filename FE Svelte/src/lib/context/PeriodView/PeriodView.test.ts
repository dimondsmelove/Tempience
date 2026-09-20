import { describe, expect, it } from 'vitest';
import {
	PERIOD_SECTIONS,
	PERIOD_SECTIONS_STORAGE_KEY,
	readPeriodCollapsed,
	writePeriodCollapsed
} from './sections';

const memoryStorage = (initial: Record<string, string> = {}): Storage => {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key) => map.get(key) ?? null,
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => void map.delete(key),
		setItem: (key, value) => void map.set(key, value)
	};
};

const allOpen = {
	overview: false,
	note: false,
	scopes: false,
	records: false,
	neighborhood: false
};

describe('period Context sections', () => {
	it('stands in the owner’s order and opens everything by default, without storage too', () => {
		expect(PERIOD_SECTIONS.map((section) => section.id)).toEqual([
			'overview',
			'note',
			'scopes',
			'records',
			'neighborhood'
		]);
		expect(readPeriodCollapsed(memoryStorage())).toEqual(allOpen);
		expect(readPeriodCollapsed(undefined)).toEqual(allOpen);
	});

	it('remembers the folded sections under its own key, reading only known ids with a true flag', () => {
		const storage = memoryStorage();
		writePeriodCollapsed({ ...allOpen, records: true, note: true }, storage);
		expect(storage.getItem(PERIOD_SECTIONS_STORAGE_KEY)).toContain('"records":true');
		expect(readPeriodCollapsed(storage)).toEqual({ ...allOpen, records: true, note: true });
		// The record's and the Scope's keys are not read: a fold there is theirs.
		expect(
			readPeriodCollapsed(memoryStorage({ 'tempience.context.sections.v1': '{"records":true}' }))
		).toEqual(allOpen);
		const stored = memoryStorage({
			[PERIOD_SECTIONS_STORAGE_KEY]: JSON.stringify({ records: true, overview: 'yes', extra: true })
		});
		expect(readPeriodCollapsed(stored)).toEqual({ ...allOpen, records: true });
		expect(readPeriodCollapsed(memoryStorage({ [PERIOD_SECTIONS_STORAGE_KEY]: '{oops' }))).toEqual(
			allOpen
		);
	});

	it('tolerates a blocked storage', () => {
		const blocked: Storage = {
			...memoryStorage(),
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(() => writePeriodCollapsed({ ...allOpen, records: true }, blocked)).not.toThrow();
		expect(readPeriodCollapsed(blocked)).toEqual(allOpen);
	});
});
