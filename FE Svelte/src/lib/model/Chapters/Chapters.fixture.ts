import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { ms } from './time';
import type { Chapter, Level, LineupEntry } from './types';

/** The owner's zone: the fixtures' instants are written in it, and the tests read them in it. */
export const ZONE = 'Europe/Belgrade';

const scope = (id: string, name = id) => ({
	id,
	name,
	note: null,
	startedAt: null,
	endedAt: null,
	colorHue: null,
	colorChroma: null,
	createdAt: '',
	updatedAt: ''
});
const childOf = (fromId: string, toId: string) => ({
	id: `${fromId}>${toId}`,
	fromId,
	toId,
	kind: 'child_of',
	createdAt: '',
	updatedAt: ''
});

export const tree = {
	scopes: ['digital', 'tempience', 'people', 'mama', 'work', 'body'].map((id) => scope(id)),
	intersections: [childOf('tempience', 'digital'), childOf('mama', 'people')]
} as unknown as Pick<ExplorerSnapshot, 'scopes' | 'intersections'>;

export const chapter = (
	id: string,
	start: string,
	end: string | null,
	extra: Partial<Chapter> = {}
) =>
	({
		id,
		name: id,
		note: '',
		colorHue: null,
		colorChroma: null,
		colorDepth: null,
		start,
		end,
		closedAt: null,
		lineup: [],
		stages: [],
		...extra
	}) satisfies Chapter;

export const lineup = (focus: string[], support: string[]): LineupEntry[] => [
	...focus.map((scopeId) => ({ scopeId, level: 'focus' as Level })),
	...support.map((scopeId) => ({ scopeId, level: 'support' as Level }))
];

export const move = chapter('move', '2026-06-01T00:00:00+02:00', '2026-09-01T00:00:00+02:00');
export const system = chapter('system', '2026-09-01T00:00:00+02:00', '2026-09-28T00:00:00+02:00', {
	lineup: [
		{ scopeId: 'body', level: 'support' },
		{ scopeId: 'tempience', level: 'focus' },
		{ scopeId: 'people', level: 'support' }
	],
	stages: [
		{
			id: 'open',
			name: 'Открытие',
			note: '',
			start: '2026-09-01T00:00:00+02:00',
			lineup: [
				{ scopeId: 'body', level: 'focus' },
				{ scopeId: 'tempience', level: 'support' }
			]
		},
		{ id: 'push', name: 'Рывок', note: '', start: '2026-09-08T00:00:00+02:00', lineup: null }
	]
});
export const out = chapter('out', '2026-09-28T00:00:00+02:00', null);
export const chapters = [move, system, out];
export const now = ms('2026-09-26T12:00:00+02:00');

/** Round 2's three chapters, each with a lineup of both levels. */
export const story3 = [
	chapter('a', '2026-06-01T00:00:00+02:00', '2026-09-01T00:00:00+02:00', {
		lineup: lineup(['work'], ['people'])
	}),
	chapter('b', '2026-09-01T00:00:00+02:00', '2026-09-28T00:00:00+02:00', {
		lineup: lineup(['tempience'], ['people', 'body'])
	}),
	chapter('c', '2026-09-28T00:00:00+02:00', null, {
		lineup: lineup(['tempience', 'mama'], ['people'])
	})
];
