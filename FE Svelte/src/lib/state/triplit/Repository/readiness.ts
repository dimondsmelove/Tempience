import type { TempienceTriplitClient } from '../client';
import { schema } from '../schema';
import { RepositoryError } from './errors';

type StoredProperty = { type?: string; config?: { optional?: boolean } };
type StoredCollections = Record<
	string,
	{ schema?: { properties?: Record<string, StoredProperty> } } | undefined
>;

/**
 * The first difference between the code schema and the schema the storage actually runs:
 * what is wrong (`reason`), where (`path`, `collection.field`), and for a type drift the two
 * types. The copy the user reads is chosen by the reason; the log names it in one notation.
 */
export type StorageSchemaMismatch = Readonly<{
	reason: 'missing' | 'type' | 'required';
	path: string;
	actual?: string;
	expected?: string;
}>;

export const storageSchemaMismatch = (
	stored: StoredCollections | undefined
): StorageSchemaMismatch | null => {
	for (const [name, collection] of Object.entries(schema)) {
		const properties = stored?.[name]?.schema?.properties;
		if (!properties) return { reason: 'missing', path: name };
		const expected = collection.schema.properties as unknown as Record<string, StoredProperty>;
		for (const [key, field] of Object.entries(expected)) {
			const actual = properties[key];
			const path = `${name}.${key}`;
			if (!actual) return { reason: 'missing', path };
			if (actual.type !== field.type) {
				return { reason: 'type', path, actual: String(actual.type), expected: String(field.type) };
			}
			if (field.config?.optional && !actual.config?.optional) return { reason: 'required', path };
		}
	}
	return null;
};

/** The mismatch in the log's notation: `collection.field: missing | a instead of b | required in storage`. */
export const describeStorageSchemaMismatch = (
	stored: StoredCollections | undefined
): string | null => {
	const mismatch = storageSchemaMismatch(stored);
	if (!mismatch) return null;
	switch (mismatch.reason) {
		case 'missing':
			return `${mismatch.path}: missing`;
		case 'type':
			return `${mismatch.path}: ${mismatch.actual} instead of ${mismatch.expected}`;
		case 'required':
			return `${mismatch.path}: required in storage`;
	}
};

const readiness = new WeakMap<TempienceTriplitClient, Promise<void>>();

/**
 * Triplit keeps the previously stored schema when applying the new one fails, so `ready`
 * alone does not prove the collections this code writes. The check runs once per client.
 */
export const assertStorageSchemaReady = (client: TempienceTriplitClient): Promise<void> => {
	let pending = readiness.get(client);
	if (!pending) {
		pending = (async () => {
			await client.ready;
			const stored = await client.getSchema();
			const collections = stored?.collections as StoredCollections | undefined;
			const mismatch = storageSchemaMismatch(collections);
			if (mismatch) {
				throw new RepositoryError(
					'storage_schema',
					`Хранилище не обновлено до текущей схемы Tempience: ${describeStorageSchemaMismatch(collections)}. ` +
						'Новые операции остановлены; сохранённые данные не изменены.',
					{ ...mismatch }
				);
			}
		})();
		readiness.set(client, pending);
	}
	return pending;
};
