import { describe, expect, it } from 'vitest';
import { FoldedSections } from '$lib/context/ContextSection/FoldedSections.svelte';
import { TASK_SECTIONS, TASK_SECTIONS_STORAGE_KEY } from './sections';

describe('task section storage', () => {
	it('remembers board folds independently of Context', () => {
		const data = new Map<string, string>();
		const storage = {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => void data.set(key, value),
			removeItem: (key: string) => void data.delete(key),
			clear: () => data.clear(),
			key: (index: number) => [...data.keys()][index] ?? null,
			get length() {
				return data.size;
			}
		} as Storage;
		const folds = new FoldedSections(TASK_SECTIONS, TASK_SECTIONS_STORAGE_KEY, storage);
		folds.toggle('scope');
		expect(
			new FoldedSections(TASK_SECTIONS, TASK_SECTIONS_STORAGE_KEY, storage).collapsed.scope
		).toBe(true);
		expect(data.size).toBe(1);
		expect(TASK_SECTIONS_STORAGE_KEY).toContain('intentions');
	});
});
