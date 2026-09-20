import { describe, expect, it } from 'vitest';
import { DAY, mark, row, rows, view } from '$lib/model/Lens/fixture';
import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
import { rowContext, rowMemberIds } from './RowContext';

/** Белград, Работа and «Без Scope» as one lane: the union of their records, «offer» once with both colours. */
const merged = {
	...row(
		`belgrade+work+${UNSCOPED_ROW_ID}`,
		[
			...rows[0].marks,
			...rows[1].marks.filter((item) => item.traceId !== 'trial'),
			mark('offer', `belgrade+work+${UNSCOPED_ROW_ID}`, { start: 35 * DAY }),
			mark('dentist', `belgrade+work+${UNSCOPED_ROW_ID}`, { start: 15 * DAY })
		],
		{ kind: 'merged', scopeId: null, scopeIds: ['belgrade', 'work'] }
	),
	name: 'belgrade +2',
	expanded: true,
	directCount: 7,
	subtreeCount: 7
};

describe('rowContext: the Context of a merged row (loop 008, C5)', () => {
	it('reads the members from the row id', () => {
		expect(rowMemberIds(merged)).toEqual(['belgrade', 'work', UNSCOPED_ROW_ID]);
		expect(rowMemberIds({ id: 'work' })).toEqual(['work']);
	});

	it('names the members as chips, «Без Scope» neutral with the row’s unscoped records as its lens', () => {
		const context = rowContext(merged, view, 'Без Scope');
		expect(context).toMatchObject({
			id: merged.id,
			name: 'belgrade +2',
			expanded: true,
			directCount: 7,
			subtreeCount: 7
		});
		expect(context.members).toEqual([
			{
				id: 'belgrade',
				name: 'belgrade',
				colorHue: null,
				colorChroma: null,
				colorDepth: null,
				lens: { kind: 'scope', scopeId: 'belgrade' }
			},
			{
				id: 'work',
				name: 'work',
				colorHue: null,
				colorChroma: null,
				colorDepth: null,
				lens: { kind: 'scope', scopeId: 'work' }
			},
			{
				id: UNSCOPED_ROW_ID,
				name: 'Без Scope',
				colorHue: null,
				colorChroma: null,
				lens: { kind: 'traces', traceIds: ['dentist'] }
			}
		]);
		// A member the snapshot lacks is still a chip, by its id.
		expect(
			rowContext({ ...merged, id: 'belgrade+gone' }, view, 'Без Scope').members[1]
		).toMatchObject({ id: 'gone', name: 'gone' });
	});

	it('lists every record once, by start time, with the caption the ribbon draws', () => {
		const context = rowContext(merged, view, 'Без Scope');
		expect(context.records.map((record) => record.traceId)).toEqual([
			'trial',
			'move',
			'dentist',
			'course',
			'interview',
			'offer',
			'sprint'
		]);
		expect(context.records[1]).toEqual({ traceId: 'move', label: 'move', start: 10 * DAY });
		expect(rowContext({ ...merged, marks: [] }, view, 'Без Scope').records).toEqual([]);
	});
});
