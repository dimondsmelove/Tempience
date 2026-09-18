import { describe, expect, it } from 'vitest';
import { SECTIONS_STORAGE_KEY } from './constants';
import { readCollapsed, writeCollapsed } from './sections';

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

const throwingStorage = (): Storage => ({
	...memoryStorage(),
	getItem: () => {
		throw new Error('blocked');
	},
	setItem: () => {
		throw new Error('blocked');
	}
});

describe('Context sections state', () => {
	it('opens everything by default, without storage too', () => {
		// A part added later defaults to open, like every other one.
		expect(readCollapsed(memoryStorage())).toEqual({
			overview: false,
			result: false,
			links: false,
			neighborhood: false,
			history: false,
			tech: false
		});
		expect(readCollapsed(undefined)).toEqual({
			overview: false,
			result: false,
			links: false,
			neighborhood: false,
			history: false,
			tech: false
		});
	});

	it('reads only known sections with a true flag and survives malformed JSON', () => {
		const stored = memoryStorage({
			[SECTIONS_STORAGE_KEY]: JSON.stringify({ links: true, overview: 'yes', extra: true })
		});
		expect(readCollapsed(stored)).toEqual({
			overview: false,
			result: false,
			links: true,
			neighborhood: false,
			history: false,
			tech: false
		});
		expect(readCollapsed(memoryStorage({ [SECTIONS_STORAGE_KEY]: '{oops' })).links).toBe(false);
	});

	it('writes the state back and tolerates a blocked storage', () => {
		const storage = memoryStorage();
		writeCollapsed(
			{
				overview: false,
				result: false,
				links: true,
				neighborhood: true,
				history: false,
				tech: false
			},
			storage
		);
		expect(readCollapsed(storage)).toEqual({
			overview: false,
			result: false,
			links: true,
			neighborhood: true,
			history: false,
			tech: false
		});
		expect(() =>
			writeCollapsed(
				{
					overview: true,
					result: false,
					links: false,
					neighborhood: false,
					history: false,
					tech: false
				},
				throwingStorage()
			)
		).not.toThrow();
		expect(readCollapsed(throwingStorage()).overview).toBe(false);
	});
});
