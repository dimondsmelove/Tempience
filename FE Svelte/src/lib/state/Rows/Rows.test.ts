import { describe, expect, it } from 'vitest';
import { RowsState } from './Rows.svelte';

describe('RowsState', () => {
	it('starts collapsed and toggles rows without mutating the previous set', () => {
		const rows = new RowsState();
		const before = rows.expanded;
		rows.toggle('a');
		expect(rows.isExpanded('a')).toBe(true);
		expect(before.has('a')).toBe(false);
		rows.expand('b');
		rows.toggle('a');
		expect([...rows.expanded]).toEqual(['b']);
		rows.collapse('b');
		rows.collapseAll();
		expect(rows.expanded.size).toBe(0);
	});
});
