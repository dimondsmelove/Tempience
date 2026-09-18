import { TriplitClient } from '@triplit/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createImportedDataSpace, DATA_SPACES } from '../data-space';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import { intersectionIdFor } from '../Intersections/read';
import { createBackupRepository } from './Backup';
import { parseDataSpaceBackup } from './parse';
import type { DataSpaceBackup } from './types';

type Replica = { client: TriplitClient<typeof schema>; repository: TempienceRepository };
const replicas: Replica[] = [];
const replica = (): Replica => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	const entry = { client, repository: createTriplitRepository(client) };
	replicas.push(entry);
	return entry;
};
afterEach(async () => {
	for (const { client } of replicas.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const day = {
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start: '2026-09-11',
	end: null
} as const;
const fields = {
	relation: 'actual' as const,
	capturedAt: '2026-09-12T12:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant' as const,
	aboutTime: day
};
const definition = {
	dataSchema: {
		type: 'object',
		additionalProperties: false,
		required: ['weight'],
		properties: { weight: { type: 'number' } }
	}
};

/** A described plain record, a typed record and a supplement of the plain one. */
const populate = async (repository: TempienceRepository) => {
	const { kind, kindV } = await repository.createTraceKind({
		name: 'Замер',
		initialKindV: definition
	});
	const plain = await repository.saveTraceRecord({
		fields: { ...fields, title: 'Прогулка', description: 'по парку' }
	});
	const typed = await repository.saveTraceRecord({
		fields: {
			...fields,
			description: 'после сна',
			kindId: kind.id,
			kindVId: kindV.id,
			data: { weight: 74 }
		}
	});
	const supplement = await repository.saveTraceRecord({
		fields: {
			...fields,
			title: 'Уточнение',
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: null
		},
		links: { add: [{ kind: 'revisits', originalId: plain.trace.id }] }
	});
	return { plain: plain.trace, typed: typed.trace, supplement: supplement.trace };
};
type Rows = Awaited<ReturnType<typeof populate>>;

const exportOf = async (source: Replica): Promise<DataSpaceBackup> =>
	JSON.parse(
		JSON.stringify(await createBackupRepository(source.client, DATA_SPACES.canonical).export())
	);

const importer = () => {
	const destination = replica();
	return {
		destination,
		target: createBackupRepository(destination.client, createImportedDataSpace('Копия'))
	};
};

const traceRow = (file: DataSpaceBackup, id: string) =>
	file.collections.traces.find((row) => row.id === id) as Record<string, unknown>;

describe('backup of form records', () => {
	it('round-trips descriptions, typed records and supplement markers with their links', async () => {
		const source = replica();
		const rows = await populate(source.repository);
		const file = await exportOf(source);
		const { destination, target } = importer();
		await target.restore(file);
		const traces = await destination.repository.listTraces(true);
		expect(traces).toEqual(expect.arrayContaining([rows.plain, rows.typed, rows.supplement]));
		expect(traces).toHaveLength(3);
		expect(await destination.repository.listIntersections(true)).toEqual(
			await source.repository.listIntersections(true)
		);
		expect(await destination.repository.listLogs()).toEqual(await source.repository.listLogs());
		// A file written before the description field restores it as absent, read as null.
		delete traceRow(file, rows.plain.id).description;
		const older = importer();
		await older.target.restore(file);
		expect(
			(await older.destination.repository.listTraces()).find((row) => row.id === rows.plain.id)
		).toEqual({ ...rows.plain, description: null });
	});

	const corruptions: [string, (file: DataSpaceBackup, rows: Rows) => void, string][] = [
		[
			'a supplement marker without its revisits link',
			(file) => {
				file.collections.intersections = file.collections.intersections.filter(
					(row) => row.kind !== 'revisits'
				);
			},
			'Дополнение'
		],
		[
			'a supplement marker whose original is missing',
			(file, rows) => {
				file.collections.traces = file.collections.traces.filter((row) => row.id !== rows.plain.id);
			},
			'Дополнение'
		],
		[
			'a supplement marker with two active originals',
			(file, rows) => {
				const link = file.collections.intersections.find((row) => row.kind === 'revisits')!;
				file.collections.intersections.push({
					...link,
					id: `${link.id}:copy`,
					toId: rows.typed.id
				});
			},
			'Дополнение'
		],
		[
			'a supplement marker revisiting itself',
			(file, rows) => {
				const link = file.collections.intersections.find((row) => row.kind === 'revisits')!;
				link.id = intersectionIdFor(rows.supplement.id, rows.supplement.id, 'revisits');
				link.toId = rows.supplement.id;
			},
			'самому себе'
		],
		[
			'a supplement marker recorded as an intention',
			(file, rows) => {
				traceRow(file, rows.supplement.id).relation = 'intend';
			},
			'не может быть намерением'
		],
		[
			'a typed record whose version belongs to another Kind',
			(file, rows) => {
				traceRow(file, rows.typed.id).kindId = 'kind:other';
				file.collections.traceKinds.push({ ...file.collections.traceKinds[0], id: 'kind:other' });
			},
			'отсутствующую версию Kind'
		],
		[
			'a typed record without its version',
			(file, rows) => {
				traceRow(file, rows.typed.id).kindVId = null;
			},
			'задаются вместе'
		],
		[
			'a typed record whose data violates its version schema',
			(file, rows) => {
				traceRow(file, rows.typed.id).data = { weight: 'много' };
			},
			'не соответствуют своей версии Kind'
		]
	];

	it('refuses a self-original pair at parse time, exactly as the link command refuses it', async () => {
		const source = replica();
		const rows = await populate(source.repository);
		const file = await exportOf(source);
		expect(() => parseDataSpaceBackup(file)).not.toThrow();
		const link = file.collections.intersections.find((row) => row.kind === 'revisits')!;
		link.id = intersectionIdFor(rows.supplement.id, rows.supplement.id, 'revisits');
		link.toId = rows.supplement.id;
		expect(() => parseDataSpaceBackup(file)).toThrow('самому себе');
		await expect(
			source.repository.createIntersection({
				fromId: rows.supplement.id,
				toId: rows.supplement.id,
				kind: 'revisits'
			})
		).rejects.toThrow('must be different');
	});

	it.each(corruptions)(
		'rejects %s before writing any collection',
		async (_label, corrupt, message) => {
			const source = replica();
			const rows = await populate(source.repository);
			await source.repository.createScope({ name: 'Не должна записаться частично' });
			const file = await exportOf(source);
			corrupt(file, rows);
			const { target } = importer();
			await expect(target.restore(file)).rejects.toThrow(message);
			expect(
				Object.values((await target.export()).collections).every((rows) => rows.length === 0)
			).toBe(true);
		}
	);
});
