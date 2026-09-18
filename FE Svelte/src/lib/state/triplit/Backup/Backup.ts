import { CodedError } from '$lib/model/Errors/CodedError';
import type { TempienceTriplitClient } from '../client';
import { isImportedDataSpaceId, type DataSpace } from '../data-space';
import { parseDataSpaceBackup } from './parse';
import { BACKUP_COLLECTIONS, BACKUP_FORMAT } from './constants';
import type { DataSpaceBackup } from './types';

export const createBackupRepository = (
	client: TempienceTriplitClient,
	dataSpace: DataSpace,
	clock: () => string = () => new Date().toISOString()
) => ({
	restore: async (input: unknown): Promise<void> => {
		const backup = parseDataSpaceBackup(input);
		if (
			!isImportedDataSpaceId(dataSpace.id) ||
			dataSpace.syncEnabled ||
			dataSpace.storageName !== `tempience-triplit-${dataSpace.id}`
		)
			throw new CodedError(
				'backup_restore_target',
				'Восстановление возможно только в новую локальную базу.'
			);
		await client.ready;
		await client.transact(async (transaction) => {
			for (const collection of BACKUP_COLLECTIONS) {
				if ((await transaction.fetch({ ...client.query(collection), limit: 1 } as never)).length)
					throw new CodedError(
						'backup_not_empty',
						'База уже содержит данные. Создайте отдельную копию из файла.'
					);
			}
			for (const collection of BACKUP_COLLECTIONS) {
				for (const row of backup.collections[collection])
					await transaction.insert(collection, row as never);
			}
		});
	},
	export: async (): Promise<DataSpaceBackup> => {
		await client.ready;
		// Read one committed snapshot, including tombstones and the journal, rather than UI projections.
		const collections = (await client.transact(async (transaction) =>
			Object.fromEntries(
				await Promise.all(
					BACKUP_COLLECTIONS.map(async (collection) => [
						collection,
						await transaction.fetch(client.query(collection) as never)
					])
				)
			)
		)) as DataSpaceBackup['collections'];
		return {
			format: BACKUP_FORMAT,
			exportedAt: clock(),
			dataSpace: { id: dataSpace.id, label: dataSpace.label },
			collections
		};
	}
});
