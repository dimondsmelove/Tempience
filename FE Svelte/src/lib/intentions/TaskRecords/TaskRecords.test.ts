import { expect, it } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { recordCandidates } from './TaskRecords';
const trace = (id: string, relation: ExplorerTrace['relation'], content = id): ExplorerTrace => ({
	id,
	content,
	relation,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: null,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin: { kind: 'canonical', sourceId: 'test' }
});
it('searches available facts and excludes the task, intentions and already linked facts', () => {
	const traces = [
		trace('task', 'intend'),
		trace('linked', 'actual', 'Найти'),
		trace('other-task', 'intend', 'Найти'),
		trace('fact', 'actual', 'Найти запись'),
		trace('different', 'actual')
	];
	expect(recordCandidates(traces, 'task', ['linked'], '').map((item) => item.id)).toEqual([
		'different',
		'fact'
	]);
	expect(recordCandidates(traces, 'task', ['linked'], 'НАЙТИ').map((item) => item.id)).toEqual([
		'fact'
	]);
});
