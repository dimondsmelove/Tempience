import { describe, expect, it } from 'vitest';
import { FoldedSections } from './FoldedSections.svelte';

const memory = (): Storage => {
	const items = new Map<string, string>();
	return {
		getItem: (key) => items.get(key) ?? null,
		setItem: (key, value) => void items.set(key, value),
		removeItem: (key) => void items.delete(key),
		clear: () => items.clear(),
		key: () => null,
		length: 0
	};
};

describe('a Context’s folded sections', () => {
	it('opens every section at first, and remembers a fold under its own key', () => {
		const storage = memory();
		const folds = new FoldedSections(['note', 'records'] as const, 'test.sections', storage);
		expect(folds.collapsed).toEqual({ note: false, records: false });
		folds.toggle('records');
		expect(folds.collapsed.records).toBe(true);
		expect(JSON.parse(storage.getItem('test.sections')!)).toEqual({ note: false, records: true });
		const again = new FoldedSections(['note', 'records'] as const, 'test.sections', storage);
		expect(again.collapsed).toEqual({ note: false, records: true });
	});
	it('opens a section that must show, and leaves an open one as it is', () => {
		const storage = memory();
		storage.setItem('test.sections', JSON.stringify({ note: true, records: 'broken' }));
		const folds = new FoldedSections(['note', 'records'] as const, 'test.sections', storage);
		expect(folds.collapsed).toEqual({ note: true, records: false });
		folds.open('note');
		folds.open('records');
		expect(folds.collapsed).toEqual({ note: false, records: false });
	});
});
