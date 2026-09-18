import { CodedError } from '$lib/model/Errors/CodedError';
import { Type } from '@triplit/client';
import { schema } from '../schema';
import { BACKUP_COLLECTIONS, BACKUP_COLLECTION_PROFILES, BACKUP_FORMAT } from './constants';
import { assertBackupReferences } from './references';
import type { BackupCollection, BackupEntity, DataSpaceBackup } from './types';

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * A file is supported only when its collection set is exactly one published profile;
 * a missing original collection, an unknown one or a mixture of versions is refused.
 */
const matchesPublishedProfile = (collections: Record<string, unknown>): boolean => {
	const names = Object.keys(collections).toSorted();
	return BACKUP_COLLECTION_PROFILES.some(
		(profile) =>
			profile.length === names.length &&
			[...profile].toSorted().every((name, index) => name === names[index])
	);
};

export const parseDataSpaceBackup = (value: unknown): DataSpaceBackup => {
	if (!record(value) || value.format !== BACKUP_FORMAT)
		throw new CodedError(
			'backup_not_export',
			'Нужен JSON-файл, сохранённый через «Экспортировать данные».'
		);
	if (typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt)))
		throw new CodedError('backup_exported_at', 'В файле отсутствует корректная дата экспорта.');
	if (
		!record(value.dataSpace) ||
		typeof value.dataSpace.id !== 'string' ||
		!value.dataSpace.id ||
		typeof value.dataSpace.label !== 'string' ||
		!value.dataSpace.label.trim() ||
		value.dataSpace.label.length > 200
	)
		throw new CodedError('backup_label', 'В файле отсутствует корректное название базы.');
	if (!record(value.collections) || !matchesPublishedProfile(value.collections))
		throw new CodedError(
			'backup_collections',
			'Набор коллекций не соответствует этой версии Tempience.'
		);

	const collections = {} as Record<BackupCollection, BackupEntity[]>;
	for (const name of BACKUP_COLLECTIONS) {
		const rows = Object.hasOwn(value.collections, name) ? value.collections[name] : [];
		if (!Array.isArray(rows))
			throw new CodedError(
				'backup_collection_array',
				`Коллекция ${name} должна содержать массив записей.`,
				{ name }
			);
		const ids = new Set<string>();
		for (const row of rows) {
			if (!record(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id))
				throw new CodedError(
					'backup_collection_ids',
					`В коллекции ${name} отсутствует ID или повторяется одна запись.`,
					{ name }
				);
			ids.add(row.id);
			const model = schema[name].schema;
			if (Object.keys(row).some((key) => !Object.hasOwn(model.properties, key)))
				throw new CodedError(
					'backup_collection_fields',
					`В коллекции ${name} есть поля, неизвестные этой версии Tempience.`,
					{ name }
				);
			const result = Type.validateEncoded(model, Type.encode(model, row), { partial: false });
			if (!result.valid)
				throw new CodedError(
					'backup_row_invalid',
					`Некорректная запись ${name}/${row.id}: ${result.error}`,
					{ name, id: row.id, detail: result.error }
				);
			if (name === 'logs') {
				try {
					JSON.parse(row.patchJson as string);
				} catch {
					throw new CodedError('backup_log_corrupt', `Повреждён журнал: ${row.id}.`, {
						id: row.id
					});
				}
			}
		}
		collections[name] = rows as BackupEntity[];
	}
	assertBackupReferences(collections);
	return {
		format: BACKUP_FORMAT,
		exportedAt: value.exportedAt,
		dataSpace: { id: value.dataSpace.id, label: value.dataSpace.label.trim() },
		collections
	};
};
