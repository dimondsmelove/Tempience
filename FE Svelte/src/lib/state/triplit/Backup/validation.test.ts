import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import { createImportedDataSpace, DATA_SPACES } from '../data-space';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { createBackupRepository } from './Backup';

const now = '2026-09-12T12:00:00.000Z';
const draft = {
	content: 'Оригинал',
	capturedAt: now,
	timezone: 'UTC',
	aboutKind: 'instant' as const,
	aboutTime: {
		basis: 'absolute' as const,
		precision: 'minute' as const,
		certainty: 'exact' as const,
		start: now,
		end: null
	}
};

const corruptions: [string, (row: Record<string, unknown>) => void][] = [
	[
		'missing inline original',
		(row) => {
			row.aboutTraceId = 'missing:original';
		}
	],
	[
		'missing relative anchor',
		(row) => {
			row.aboutKind = 'instant';
			row.aboutTraceId = null;
			row.aboutTime = {
				basis: 'relative',
				precision: 'day',
				anchorTraceId: 'missing:anchor',
				relation: 'after'
			};
		}
	],
	[
		// An interval without an end is valid since C5 («длится»); one that ends before it starts is not.
		'interval that ends before it starts',
		(row) => {
			row.aboutKind = 'interval';
			row.aboutTraceId = null;
			row.aboutTime = {
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: now,
				end: '2026-09-12T11:00:00.000Z'
			};
		}
	]
];

describe('backup temporal integrity', () => {
	it.each(corruptions)('rejects %s before writing any collection', async (_label, corrupt) => {
		const source = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const destination = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		try {
			const repository = createTriplitRepository(source);
			await repository.createScope({ name: 'Не должна записаться частично' });
			const original = await repository.createTrace(draft);
			const reference = await repository.createTrace({
				...draft,
				content: 'Дополнение',
				aboutKind: 'trace_ref',
				aboutTime: null,
				aboutTraceId: original.id
			});
			const file = JSON.parse(
				JSON.stringify(await createBackupRepository(source, DATA_SPACES.canonical).export())
			);
			corrupt(file.collections.traces.find((row: { id: string }) => row.id === reference.id));
			const target = createBackupRepository(destination, createImportedDataSpace('Проверка'));
			await expect(target.restore(file)).rejects.toThrow();
			expect(
				Object.values((await target.export()).collections).every((rows) => rows.length === 0)
			).toBe(true);
		} finally {
			await source.clear({ full: true });
			await destination.clear({ full: true });
			source.disconnect();
			destination.disconnect();
		}
	});

	it('restores legacy temporal indexes and forward references to soft-deleted originals', async () => {
		const source = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const destination = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		try {
			const repository = createTriplitRepository(source);
			const original = await repository.createTrace(draft);
			const reference = await repository.createTrace({
				...draft,
				content: 'Дополнение',
				aboutKind: 'trace_ref',
				aboutTime: null,
				aboutTraceId: original.id
			});
			await repository.setTraceDeleted(original.id, true);
			const file = await createBackupRepository(source, DATA_SPACES.canonical).export();
			const originalRow = file.collections.traces.find((row) => row.id === original.id)!;
			delete originalRow.aboutTime;
			file.collections.traces = [
				file.collections.traces.find((row) => row.id === reference.id)!,
				originalRow
			];
			const target = createBackupRepository(
				destination,
				createImportedDataSpace('Совместимая копия')
			);
			await target.restore(JSON.parse(JSON.stringify(file)));
			const restored = await createTriplitRepository(destination).listTraces(true);
			expect(restored).toContainEqual(
				expect.objectContaining({ id: original.id, isDeleted: true, aboutTime: draft.aboutTime })
			);
			expect(restored).toContainEqual(
				expect.objectContaining({ id: reference.id, aboutTraceId: original.id })
			);
			expect((await target.export()).collections.logs).toEqual(file.collections.logs);
		} finally {
			await source.clear({ full: true });
			await destination.clear({ full: true });
			source.disconnect();
			destination.disconnect();
		}
	});
});
