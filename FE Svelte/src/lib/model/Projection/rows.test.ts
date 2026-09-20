import { describe, expect, it } from 'vitest';
import type { ProjectedRow } from './types';
import { UNSCOPED_ROW_ID } from './constants';
import { rowOfScope } from './rows';

const row = (id: string, kind: ProjectedRow['kind'], scopeIds: string[]): ProjectedRow => ({
	id,
	kind,
	scopeId: kind === 'scope' ? id : null,
	scopeIds,
	name: id,
	colours: [],
	depth: 0,
	hasChildren: false,
	expanded: false,
	directCount: 0,
	subtreeCount: 0,
	range: null,
	marks: []
});
const rows = [
	row('a', 'scope', ['a']),
	row(`b+c+${UNSCOPED_ROW_ID}`, 'merged', ['b', 'c']),
	row('d', 'scope', ['d'])
];
/** The merged lane unfolded (C5): its members stand as rows of their own beneath it. */
const unfolded = [...rows.slice(0, 2), row('b', 'scope', ['b']), row('c', 'scope', ['c']), rows[2]];

describe('rowOfScope: the row the rail scrolls to for a Scope (C3)', () => {
	it('finds a plain row by its id and a merged row by a member — «Без Scope» too', () => {
		expect(rowOfScope(rows, 'a')?.id).toBe('a');
		expect(rowOfScope(rows, 'c')?.id).toBe(`b+c+${UNSCOPED_ROW_ID}`);
		expect(rowOfScope(rows, UNSCOPED_ROW_ID)?.id).toBe(`b+c+${UNSCOPED_ROW_ID}`);
		expect(rowOfScope(rows, 'gone')).toBeUndefined();
	});

	it('prefers a member row under an unfolded merged row to the merged row itself (C5)', () => {
		expect(rowOfScope(unfolded, 'c')?.id).toBe('c');
		expect(rowOfScope(unfolded, UNSCOPED_ROW_ID)?.id).toBe(`b+c+${UNSCOPED_ROW_ID}`);
	});
});
