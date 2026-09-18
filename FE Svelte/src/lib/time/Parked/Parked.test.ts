import { describe, expect, it } from 'vitest';
import { PARKED_STORAGE_KEY } from './constants';
import { readParkedOpen, writeParkedOpen } from './open';

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

describe('«Без даты» open state', () => {
	it('is open by default, without storage and with a blocked one', () => {
		expect(readParkedOpen(memoryStorage())).toBe(true);
		expect(readParkedOpen(undefined)).toBe(true);
		expect(readParkedOpen(throwingStorage())).toBe(true);
		expect(readParkedOpen(memoryStorage({ [PARKED_STORAGE_KEY]: 'nonsense' }))).toBe(true);
	});

	it('remembers a fold and tolerates a blocked storage on write', () => {
		const storage = memoryStorage();
		writeParkedOpen(false, storage);
		expect(readParkedOpen(storage)).toBe(false);
		writeParkedOpen(true, storage);
		expect(readParkedOpen(storage)).toBe(true);
		expect(() => writeParkedOpen(false, throwingStorage())).not.toThrow();
	});
});
