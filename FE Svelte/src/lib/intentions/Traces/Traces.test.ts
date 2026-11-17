import { describe, expect, it } from 'vitest';
import type { ExplorerTrace, ExplorerIntersection } from '$lib/model/Snapshot/types';
import { tracesByDay } from './Traces';

const origin = { kind: 'canonical', sourceId: 'test' } as const;
const time = (
	start: string,
	precision: 'day' | 'minute' = 'day',
	end: string | null = null
): ExplorerTrace['aboutTime'] => ({ basis: 'absolute', precision, certainty: 'exact', start, end });
const trace = (
	id: string,
	relation: ExplorerTrace['relation'],
	aboutTime: ExplorerTrace['aboutTime'],
	extra: Partial<ExplorerTrace> = {}
): ExplorerTrace => ({
	id,
	content: id,
	relation,
	timezone: 'Europe/Belgrade',
	aboutKind: 'instant',
	aboutTime,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin,
	...extra
});
const link = (id: string, fromId: string, toId: string): ExplorerIntersection => ({
	id,
	fromId,
	toId,
	kind: 'evidence_for',
	context: null,
	origin
});
const zone = 'Europe/Belgrade';
const keys = ['2026-03-28', '2026-03-29', '2026-03-30'];
const now = Date.parse('2026-03-29T10:00:00Z');

describe('tracesByDay', () => {
	it('uses the local day at midnight and across DST for minute facts and calendar tasks', () => {
		const task = trace('task', 'intend', time('2026-03-30'));
		const facts = [
			trace('before', 'actual', time('2026-03-28T22:59:00Z', 'minute')),
			trace('after', 'actual', time('2026-03-28T23:00:00Z', 'minute')),
			trace('dst', 'actual', time('2026-03-29T22:00:00Z', 'minute'))
		];
		const result = tracesByDay(
			{ traces: [task, ...facts], intersections: facts.map((f) => link(f.id, f.id, task.id)) },
			zone,
			keys,
			now
		);
		expect(result.get('2026-03-28')?.map((v) => v.factId)).toEqual(['before']);
		expect(result.get('2026-03-29')?.map((v) => v.factId)).toEqual(['after']);
		expect(result.get('2026-03-30')).toEqual([]);
	});
	it('deduplicates pairs, allows several facts and links without an assessment, excludes missing and wrong roles', () => {
		const task = trace('task', 'intend', time('2026-03-30'));
		const fact = trace('fact', 'actual', time('2026-03-29'));
		const other = trace('other', 'actual', time('2026-03-29'));
		const result = tracesByDay(
			{
				traces: [task, fact, other],
				intersections: [
					link('a', 'fact', 'task'),
					link('duplicate', 'fact', 'task'),
					link('b', 'other', 'task'),
					link('deleted-fact', 'missing', 'task'),
					link('deleted-task', 'fact', 'missing'),
					link('self', 'task', 'task')
				]
			},
			zone,
			keys,
			now
		);
		expect(result.get('2026-03-29')).toEqual([
			{
				factId: 'fact',
				text: 'fact',
				taskId: 'task',
				taskTitle: 'task',
				taskDay: '2026-03-30',
				factDay: '2026-03-29'
			},
			{
				factId: 'other',
				text: 'other',
				taskId: 'task',
				taskTitle: 'task',
				taskDay: '2026-03-30',
				factDay: '2026-03-29'
			}
		]);
	});
	it('omits undated, weekly, range and same-day tasks, and accepts a minute task', () => {
		const fact = trace('fact', 'actual', time('2026-03-28'));
		const tasks = [
			trace('undated', 'intend', null),
			trace('week', 'intend', time('2026-03-23', 'day', '2026-03-29'), { aboutKind: 'interval' }),
			trace('range', 'intend', time('2026-03-29', 'day', '2026-03-30'), { aboutKind: 'interval' }),
			trace('same', 'intend', time('2026-03-28')),
			trace('minute', 'intend', time('2026-03-29T00:30:00Z', 'minute'))
		];
		const result = tracesByDay(
			{ traces: [fact, ...tasks], intersections: tasks.map((t) => link(t.id, 'fact', t.id)) },
			zone,
			keys,
			now
		);
		expect(result.get('2026-03-28')?.map((v) => v.taskId)).toEqual(['minute']);
	});
});
