import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import { createTriplitRepository } from '../repository';
import {
	DATA_SPACES,
	createImportedDataSpace,
	CANONICAL_DATA_SPACE_ID,
	BELGRADE_SCENARIO_DATA_SPACE_ID
} from '../data-space';
import { schema } from '../schema';
import { createBackupRepository } from './Backup';
import { parseDataSpaceBackup } from './parse';
import { BACKUP_COLLECTIONS, BACKUP_FORMAT } from './constants';

const now = '2026-09-07T12:00:00.000Z';

describe('DataSpace backup', () => {
	it('exports all stored collections, typed data, links and deleted records without adding journal entries', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const repository = createTriplitRepository(client);
			const scope = await repository.createScope({ name: 'Личные записи' });
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Заметка',
				initialKindV: {
					dataSchema: {
						type: 'object',
						properties: { tags: { type: 'array', items: { type: 'string' } } }
					}
				}
			});
			const trace = await repository.createTraceWithScope(
				{
					content: 'Тестовая запись',
					capturedAt: now,
					timezone: 'UTC',
					aboutKind: 'instant',
					aboutTime: {
						basis: 'absolute',
						precision: 'minute',
						certainty: 'exact',
						start: now,
						end: null
					},
					kindId: kind.id,
					kindVId: kindV.id,
					data: { tags: ['важное', 'личное'] }
				},
				scope.id
			);
			await repository.setTraceDeleted(trace.id, true);
			const before = await repository.listLogs();
			const backup = await createBackupRepository(
				client,
				DATA_SPACES[CANONICAL_DATA_SPACE_ID],
				() => now
			).export();
			const file = JSON.parse(JSON.stringify(backup));
			expect(file.format).toBe(BACKUP_FORMAT);
			expect(file.exportedAt).toBe(now);
			expect(Object.keys(file.collections).sort()).toEqual(Object.keys(schema).sort());
			expect(file.collections.traces).toEqual([
				expect.objectContaining({
					id: trace.id,
					isDeleted: true,
					kindId: kind.id,
					kindVId: kindV.id,
					data: { tags: ['важное', 'личное'] }
				})
			]);
			expect(file.collections.scopes).toEqual([expect.objectContaining({ id: scope.id })]);
			expect(file.collections.intersections).toContainEqual(
				expect.objectContaining({ fromId: trace.id, toId: scope.id })
			);
			expect(file.collections.traceKindVersions).toContainEqual(
				expect.objectContaining({ id: kindV.id, kindId: kind.id })
			);
			expect(file.collections.logs).toHaveLength(before.length);
			expect(await repository.listLogs()).toEqual(before);
			expect(file.dataSpace).toEqual({ id: 'canonical', label: 'Мои данные' });
			const restored = new TriplitClient({
				schema,
				storage: { type: 'memory' },
				autoConnect: false
			});
			try {
				const backupRepository = createBackupRepository(restored, createImportedDataSpace('Копия'));
				await backupRepository.restore(file);
				const copy = await backupRepository.export();
				expect(copy.collections).toEqual(backup.collections);
				expect(
					(await createBackupRepository(client, DATA_SPACES.canonical).export()).collections
				).toEqual(backup.collections);
			} finally {
				await restored.clear({ full: true });
				restored.disconnect();
			}
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
	it('exports an empty isolated space with its own identity and a complete collection inventory', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const space = DATA_SPACES[BELGRADE_SCENARIO_DATA_SPACE_ID];
			const backup = await createBackupRepository(client, space, () => now).export();
			expect(backup.dataSpace.id).toBe(space.id);
			expect(Object.keys(backup.collections)).toEqual(BACKUP_COLLECTIONS);
			expect(Object.values(backup.collections).every((rows) => rows.length === 0)).toBe(true);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
	it('rejects a nonempty destination and leaves its records unchanged', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const repository = createTriplitRepository(client);
			await repository.createScope({ name: 'Существующая группа' });
			const target = createBackupRepository(client, createImportedDataSpace('Копия'));
			const before = await target.export();
			await expect(target.restore(before)).rejects.toThrow('уже содержит данные');
			expect((await target.export()).collections).toEqual(before.collections);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('rejects restoration into a built-in replica even when it is empty', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const target = createBackupRepository(client, DATA_SPACES.canonical);
			const before = await target.export();
			await expect(target.restore(before)).rejects.toThrow('новую локальную базу');
			expect((await target.export()).collections).toEqual(before.collections);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('validates the complete file before writing any collection', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const target = createBackupRepository(client, createImportedDataSpace('Копия'));
			const file = await target.export();
			file.collections.scopes.push({
				id: 'scope:valid',
				name: 'Верная запись',
				createdAt: now,
				updatedAt: now,
				isDeleted: false
			});
			file.collections.logs.push({ id: 'log:broken', patchJson: 'not json' });
			await expect(target.restore(file)).rejects.toThrow('Некорректная запись');
			expect(
				Object.values((await target.export()).collections).every((rows) => rows.length === 0)
			).toBe(true);

			const missing = structuredClone(file);
			delete (missing.collections as Partial<typeof missing.collections>).logs;
			expect(() => parseDataSpaceBackup(missing)).toThrow('Набор коллекций');
			file.collections.logs = [];
			file.collections.scopes.push({ ...file.collections.scopes[0] });
			expect(() => parseDataSpaceBackup(file)).toThrow('повторяется');
			file.collections.scopes.pop();
			file.collections.scopes[0].extraField = 'unknown';
			expect(() => parseDataSpaceBackup(file)).toThrow('неизвестные');
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
});
