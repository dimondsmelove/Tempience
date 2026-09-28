import { describe, expect, it } from 'vitest';
import { ms } from '$lib/model/Chapters';
import { recordItems } from './items';

const today = ms('2026-09-27T12:00:00+02:00');

describe('a chapter’s Context lists', () => {
	it('lists the records by day and title, the year only when it is not this one', () => {
		const items = recordItems(
			[
				{
					id: 'a',
					title: 'Старое',
					at: ms('2019-10-10T10:00:00+02:00'),
					intent: false,
					scopeIds: []
				},
				{ id: 'b', title: 'Новое', at: ms('2026-09-10T10:00:00+02:00'), intent: true, scopeIds: [] }
			],
			'Europe/Belgrade',
			'ru',
			today
		);
		expect(items).toEqual([
			{ traceId: 'a', date: '10 окт. 2019', title: 'Старое', at: ms('2019-10-10T10:00:00+02:00') },
			{ traceId: 'b', date: '10 сент.', title: 'Новое', at: ms('2026-09-10T10:00:00+02:00') }
		]);
	});
});
