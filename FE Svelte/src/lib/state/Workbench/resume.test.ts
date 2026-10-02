import { describe, expect, it } from 'vitest';
import { WORKBENCH_RESUME_KEY } from './constants';
import { readResume, writeResume, type ResumeStorage } from './resume';

const memory = (): ResumeStorage & { map: Map<string, string> } => {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => void map.set(key, value)
	};
};
const refusing: ResumeStorage = {
	getItem: () => {
		throw new Error('denied');
	},
	setItem: () => {
		throw new Error('denied');
	}
};

describe('the record a demo notebook was last on', () => {
	it('is kept per DataSpace and read back', () => {
		const storage = memory();
		writeResume(storage, 'demo-watson', 'demo-w-later');
		writeResume(storage, 'demo-anya', 'demo-a-start');
		expect(readResume(storage, 'demo-watson')).toBe('demo-w-later');
		expect(readResume(storage, 'demo-anya')).toBe('demo-a-start');
		expect(storage.map.get(`${WORKBENCH_RESUME_KEY}:demo-watson`)).toBe('demo-w-later');
	});

	it('reads as nothing when absent, without storage or when storage refuses', () => {
		expect(readResume(memory(), 'demo-watson')).toBeNull();
		expect(readResume(null, 'demo-watson')).toBeNull();
		expect(readResume(refusing, 'demo-watson')).toBeNull();
		expect(() => writeResume(refusing, 'demo-watson', 'x')).not.toThrow();
	});
});
