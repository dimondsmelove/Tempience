import { versionSummaries } from '$lib/model/TraceForm/summary-fields';
import type { TempienceRepository } from '../../repository';
import type { JsonObject } from '../../types';
import { bytes, timed } from './tools';

const TITLE = 'Длинная запись дневника, которую ни одна строка не показывает. '.repeat(20);

/**
 * One Kind whose first version keeps a short `title` — a summary leaf — and whose second
 * makes the same key a multi-line text no row shows, with `rows` long records of the second
 * version. The union of both versions' leaves (the read before this fix) carried every long
 * title; the read by own version carries none of them.
 */
export const measureCrossVersion = async (repository: TempienceRepository, rows: number) => {
	const { kind, kindV: short } = await repository.createTraceKind({
		name: 'Дневник (кросс-версия)',
		initialKindV: {
			dataSchema: {
				type: 'object',
				properties: { title: { type: 'string' }, mood: { type: 'string' } }
			} as JsonObject
		}
	});
	const long = await repository.createTraceKindV(kind.id, {
		dataSchema: {
			type: 'object',
			properties: { title: { type: 'string' }, mood: { type: 'string' } }
		} as JsonObject,
		uiSchema: { title: { 'ui:components': { textWidget: 'textareaWidget' } } } as JsonObject,
		parentKindVIds: [short.id]
	});
	const ids: string[] = [];
	for (let index = 0; index < rows; index += 1) {
		const trace = await repository.createTrace({
			content: '',
			capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: { basis: 'unknown' },
			relation: 'actual',
			kindId: kind.id,
			kindVId: long.id,
			data: { title: TITLE, mood: 'ровно' }
		});
		ids.push(trace.id);
	}
	const own = versionSummaries([short, long]);
	// What the union did: the first version's leaves read through the second version's rows.
	const union = own.map((entry) => ({ ...entry, paths: [['title'], ['mood']] }));
	const unionRead = await timed(() =>
		repository.listTraceHeads({ ids, deleted: 'all', summaries: union })
	);
	const ownRead = await timed(() =>
		repository.listTraceHeads({ ids, deleted: 'all', summaries: own })
	);
	return {
		rows,
		summaries: own.map((entry) => entry.paths.map((path) => path.join('.')).join(', ')),
		union: { ms: unionRead.ms, bytes: bytes(unionRead.value) },
		own: { ms: ownRead.ms, bytes: bytes(ownRead.value) }
	};
};
