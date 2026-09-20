import type { Mark, ProjectedRow, TraceLink } from '$lib/model/Projection/types';
import type { ExplorerIntersection, ExplorerScope, ExplorerTrace } from '$lib/model/Snapshot/types';
import type { LensView } from './types';

export const DAY = 86_400_000;
const origin = { kind: 'synthetic-conformance', sourceId: 'test' } as const;

export const mark = (
	traceId: string,
	rowId: string,
	options: Partial<Pick<Mark, 'rollup' | 'start' | 'end' | 'kind'>> = {}
): Mark => ({
	id: `${traceId}@${rowId}`,
	traceId,
	rowId,
	kind: options.kind ?? 'moment',
	intent: false,
	rollup: options.rollup ?? false,
	start: options.start ?? 0,
	end: options.end ?? options.start ?? 0,
	label: traceId,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact'
});

export const row = (
	id: string,
	marks: Mark[],
	options: Partial<Pick<ProjectedRow, 'kind' | 'scopeId' | 'scopeIds'>> = {}
): ProjectedRow => ({
	id,
	kind: options.kind ?? 'scope',
	scopeId: options.scopeId === undefined ? id : options.scopeId,
	scopeIds: options.scopeIds ?? [id],
	name: id,
	colours: [],
	depth: 0,
	hasChildren: false,
	expanded: false,
	directCount: marks.length,
	subtreeCount: marks.length,
	range: null,
	marks
});

const trace = (id: string, kindId: string | null = null): ExplorerTrace => ({
	origin,
	id,
	content: id,
	relation: 'actual',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: null,
	aboutTraceId: null,
	kindId,
	kindVId: null,
	data: null
});
const scope = (id: string): ExplorerScope => ({
	origin,
	id,
	name: id,
	note: null,
	startedAt: null,
	endedAt: null,
	colorHue: null,
	colorChroma: null
});
const link = (
	id: string,
	fromId: string,
	toId: string,
	kind: 'belongs_to' | 'child_of' | 'part_of'
): ExplorerIntersection => ({
	origin,
	id,
	fromId,
	toId,
	kind,
	context: null
});

/**
 * The ribbon fixture in miniature: Белград holds «move» (day 10), «course» (days 20–40,
 * linked to «move» and «interview»), «offer» (day 35, also in Работа); Работа is a
 * collapsed group with «offer» direct and the roll-ups of Проект — «interview» (day 30)
 * and «sprint» (days 38–50); «dentist» (day 15) has no Scope; «trial» (days −20…−10)
 * is in all three Scopes. «hidden» is a record of Белград the legend took off the ribbon.
 */
export const rows: ProjectedRow[] = [
	row('belgrade', [
		mark('trial', 'belgrade', { kind: 'interval', start: -20 * DAY, end: -10 * DAY }),
		mark('move', 'belgrade', { start: 10 * DAY }),
		mark('course', 'belgrade', { kind: 'interval', start: 20 * DAY, end: 40 * DAY }),
		mark('offer', 'belgrade', { start: 35 * DAY })
	]),
	row('work', [
		mark('trial', 'work', { kind: 'interval', start: -20 * DAY, end: -10 * DAY }),
		mark('interview', 'work', { rollup: true, start: 30 * DAY }),
		mark('offer', 'work', { start: 35 * DAY }),
		mark('sprint', 'work', { rollup: true, kind: 'interval', start: 38 * DAY, end: 50 * DAY })
	]),
	row('unscoped', [mark('dentist', 'unscoped', { start: 15 * DAY })], {
		kind: 'unscoped',
		scopeId: null,
		scopeIds: []
	})
];

export const links: TraceLink[] = [
	{ fromTraceId: 'course', toTraceId: 'move', kind: 'part_of' },
	{ fromTraceId: 'course', toTraceId: 'interview', kind: 'part_of' }
];

export const view: LensView & { intersections: ExplorerIntersection[] } = {
	traces: [
		trace('trial'),
		trace('move', 'kind:visit'),
		trace('course'),
		trace('offer', 'kind:visit'),
		trace('interview'),
		trace('sprint'),
		trace('dentist', 'kind:visit'),
		trace('hidden', 'kind:visit')
	],
	scopes: [scope('belgrade'), scope('work'), scope('project')],
	intersections: [
		link('i:project', 'project', 'work', 'child_of'),
		link('i:trial-b', 'trial', 'belgrade', 'belongs_to'),
		link('i:trial-w', 'trial', 'work', 'belongs_to'),
		link('i:trial-p', 'trial', 'project', 'belongs_to'),
		link('i:move', 'move', 'belgrade', 'belongs_to'),
		link('i:course', 'course', 'belgrade', 'belongs_to'),
		link('i:offer-b', 'offer', 'belgrade', 'belongs_to'),
		link('i:offer-w', 'offer', 'work', 'belongs_to'),
		link('i:interview', 'interview', 'project', 'belongs_to'),
		link('i:sprint', 'sprint', 'project', 'belongs_to'),
		link('i:hidden', 'hidden', 'belgrade', 'belongs_to'),
		link('l:course-move', 'course', 'move', 'part_of'),
		link('l:course-interview', 'course', 'interview', 'part_of')
	]
};

export const sorted = (ids: Iterable<string>): string[] => [...ids].toSorted();
