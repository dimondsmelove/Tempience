import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { createImportedDataSpace } from '../data-space';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import type { JsonObject, TraceDraft } from '../types';
import { createBackupRepository } from './Backup';
import type { DataSpaceBackup } from './types';

const clients: TriplitClient<typeof schema>[] = [];
const createClient = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return client;
};
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const dataSchema: JsonObject = {
	type: 'object',
	properties: {
		count: { type: 'number' },
		note: { type: 'string' },
		mood: { type: ['string', 'null'] }
	},
	required: ['count', 'mood']
};

const draft = (content: string, extra: Partial<TraceDraft> = {}): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	},
	relation: 'actual',
	...extra
});

/** A file holding legacy, rewritten and cleared rows plus their journal. */
const exportMixed = async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const { kind, kindV } = await repository.createTraceKind({
		name: 'Backup codec',
		initialKindV: { dataSchema }
	});
	const pinned = { kindId: kind.id, kindVId: kindV.id };
	const legacy = await repository.createTrace(
		draft('legacy', { ...pinned, data: { count: 1, mood: null, note: 'n' } })
	);
	const rewritten = await repository.createTrace(
		draft('rewritten', { ...pinned, data: { count: 1, mood: 'ok', note: 'n' } })
	);
	await repository.editTrace(rewritten.id, { data: { count: 2, mood: null } });
	await repository.editTrace(rewritten.id, { aboutTime: { basis: 'unknown' } });
	const marker = await repository.createTrace(
		draft('marker', { aboutKind: 'trace_ref', aboutTime: null, aboutTraceId: legacy.id })
	);
	// A cleared encoded time is stored as [null]; simulate the stored shape directly.
	await client.update('traces', marker.id, { aboutTime: [null], encoding: { aboutTime: 1 } });
	const file = await createBackupRepository(client, createImportedDataSpace('Источник')).export();
	return { client, repository, file, ids: { legacy, rewritten, marker } };
};

it('round-trips legacy and encoded rows with their markers, nulls and journal', async () => {
	const { repository, file, ids } = await exportMixed();
	const stored = (id: string) =>
		file.collections.traces.find((row) => row.id === id) as Record<string, unknown>;
	expect(stored(ids.rewritten.id).data).toEqual([{ count: 2, mood: null }]);
	expect(stored(ids.rewritten.id).encoding).toEqual({ data: 1, aboutTime: 1 });
	expect(stored(ids.legacy.id).encoding).toBeUndefined();
	expect(stored(ids.marker.id).aboutTime).toEqual([null]);

	const target = createClient();
	const backup = createBackupRepository(target, createImportedDataSpace('Копия'));
	await backup.restore(file);
	const restored = createTriplitRepository(target);
	expect(await restored.listTraces(true)).toEqual(await repository.listTraces(true));
	expect((await restored.getTrace(ids.rewritten.id))?.data).toEqual({ count: 2, mood: null });
	expect((await restored.getTrace(ids.rewritten.id))?.aboutTime).toEqual({ basis: 'unknown' });
	expect((await restored.getTrace(ids.legacy.id))?.data).toEqual({
		count: 1,
		mood: null,
		note: 'n'
	});
	expect((await restored.getTrace(ids.marker.id))?.aboutTime).toBeNull();
	expect(await restored.listLogs()).toEqual(await repository.listLogs());
	expect((await backup.export()).collections).toEqual(file.collections);
});

it('refuses corrupt encodings before writing anything', async () => {
	const { file, ids } = await exportMixed();
	const target = createClient();
	const backup = createBackupRepository(target, createImportedDataSpace('Копия'));
	const attempt = async (mutate: (copy: DataSpaceBackup) => void): Promise<string> => {
		const copy = structuredClone(file);
		mutate(copy);
		try {
			await backup.restore(copy);
			return 'accepted';
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	};
	const row = (copy: DataSpaceBackup, id: string) =>
		copy.collections.traces.find((entry) => entry.id === id) as Record<string, unknown>;
	expect(
		await attempt((copy) => void (row(copy, ids.rewritten.id).encoding = { data: 2 }))
	).toMatch('unsupported version');
	expect(
		await attempt((copy) => void (row(copy, ids.rewritten.id).encoding = { content: 1 }))
	).toMatch('unsupported field');
	expect(
		await attempt((copy) => void (row(copy, ids.rewritten.id).data = { count: 2, mood: null }))
	).toMatch('singleton array');
	expect(
		await attempt(
			(copy) => void (row(copy, ids.rewritten.id).aboutTime = [{ basis: 'unknown', start: 'x' }])
		)
	).toMatch('unsupported fields');
	expect(await attempt((copy) => void (row(copy, ids.rewritten.id).data = ['text']))).toMatch(
		'JSON object'
	);
	expect(
		await attempt(
			(copy) => void (row(copy, ids.legacy.id).aboutTime = { basis: 'absolute', extra: 1 })
		)
	).toMatch('unsupported fields');
	// Leftover keys that no earlier variant could have produced are corruption, not residue.
	expect(
		await attempt(
			(copy) =>
				void (row(copy, ids.legacy.id).aboutTime = {
					basis: 'unknown',
					precision: 'nonsense',
					start: { unexpected: true }
				})
		)
	).toMatch('unsupported fields: precision, start');
	// Genuine residue of an earlier valid variant change still restores and reads.
	expect(
		await attempt((copy) => {
			row(copy, ids.legacy.id).aboutTime = {
				basis: 'unknown',
				precision: 'day',
				certainty: 'exact',
				start: '2026-09-11',
				end: null
			};
			copy.dataSpace.id = 'imported-residue';
		})
	).toBe('accepted');
	expect((await createTriplitRepository(target).getTrace(ids.legacy.id))?.aboutTime).toEqual({
		basis: 'unknown'
	});
});

it('accepts the valid file into the same fresh replica after refusing corrupt variants', async () => {
	const { file, ids } = await exportMixed();
	const target = createClient();
	const backup = createBackupRepository(target, createImportedDataSpace('Копия'));
	const corrupt = structuredClone(file);
	(
		corrupt.collections.traces.find((entry) => entry.id === ids.legacy.id) as Record<
			string,
			unknown
		>
	).aboutTime = {
		basis: 'unknown',
		precision: 'nonsense',
		start: { unexpected: true }
	};
	await expect(backup.restore(corrupt)).rejects.toThrow('unsupported fields');
	const proto = structuredClone(file);
	(
		proto.collections.traces.find((entry) => entry.id === ids.legacy.id) as Record<string, unknown>
	).aboutTime = JSON.parse('{"basis":"unknown","__proto__":{"unexpected":true}}');
	await expect(backup.restore(proto)).rejects.toThrow('unsupported fields: __proto__');
	await backup.restore(file);
	expect(await createTriplitRepository(target).listTraces(true)).toHaveLength(3);
});
