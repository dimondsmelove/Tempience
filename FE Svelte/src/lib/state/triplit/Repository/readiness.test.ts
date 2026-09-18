import { TriplitClient, Schema as S } from '@triplit/client';
import { BTreeKVStore } from '@triplit/db/storage/memory-btree';
import { afterEach, expect, it } from 'vitest';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { RepositoryError } from './errors';
import { assertStorageSchemaReady, describeStorageSchemaMismatch } from './readiness';

const clients: TriplitClient<never>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const omit = <T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> =>
	Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as Omit<T, K>;
const legacySchema = S.Collections(omit(schema, 'intentionAssessments'));

const timestamp = '2026-09-13T08:00:00.000Z';
const intentionRow = {
	id: 'intention-1',
	capturedAt: timestamp,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	},
	content: 'Намерение',
	relation: 'intend',
	isDeleted: false,
	createdAt: timestamp,
	updatedAt: timestamp
};

const codeOf = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
		return 'resolved';
	} catch (error) {
		return error instanceof RepositoryError ? `${error.code}: ${error.message}` : String(error);
	}
};

it('passes once per client when the storage runs the current schema', async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client as never);
	const first = assertStorageSchemaReady(client);
	expect(assertStorageSchemaReady(client)).toBe(first);
	await expect(first).resolves.toBeUndefined();
	expect(
		describeStorageSchemaMismatch((await client.getSchema())?.collections as never)
	).toBeNull();
});

it('refuses assessment operations on a client that still runs the schema without the collection', async () => {
	const client = new TriplitClient({
		schema: legacySchema,
		storage: { type: 'memory' },
		autoConnect: false
	});
	clients.push(client as never);
	await client.insert('traces', intentionRow as never);
	const repository = createTriplitRepository(client as never);
	expect(await codeOf(repository.createDirectAssessment('intention-1', { open: false }))).toMatch(
		/^storage_schema: .*intentionAssessments: missing/
	);
	expect(await codeOf(repository.listIntentionAssessments())).toMatch(/^storage_schema/);
	// Existing operations keep working on the stored schema.
	expect(await repository.listTraces()).toHaveLength(1);
});

it('detects a real failed schema update: Triplit falls back to the stored schema', async () => {
	const storage = new BTreeKVStore();
	const storedSchema = S.Collections({
		...schema,
		intentionAssessments: {
			schema: S.Schema(omit(schema.intentionAssessments.schema.properties, 'updatedAt') as never)
		}
	});
	const writer = new TriplitClient({ schema: storedSchema, storage, autoConnect: false });
	await writer.insert('intentionAssessments', {
		id: 'assessment:legacy',
		source: 'direct',
		origin: { intentionId: 'intention-1' },
		initial: { 'op-1': { at: timestamp, open: false } }
	} as never);
	await writer.insert('traces', intentionRow as never);
	writer.disconnect();

	const events: string[] = [];
	const client = new TriplitClient({
		schema,
		storage,
		autoConnect: false,
		experimental: {
			onDatabaseInit: (_db, event) => {
				events.push(event.type);
			}
		}
	});
	clients.push(client as never);
	await client.ready;
	// Adding a required attribute to a non-empty collection cannot be applied; the SDK keeps the old schema.
	expect(events).toEqual(['SCHEMA_UPDATE_FAILED']);
	const repository = createTriplitRepository(client);
	expect(await codeOf(repository.createDirectAssessment('intention-1', { open: true }))).toMatch(
		/^storage_schema: .*intentionAssessments\.updatedAt: missing.*данные не изменены/
	);
	expect(await codeOf(repository.listIntentionAssessments())).toMatch(/^storage_schema/);
	expect(await repository.listTraces()).toHaveLength(1);
	expect(await client.fetch(client.query('intentionAssessments'))).toHaveLength(1);
	expect(await repository.listLogs()).toEqual([]);
});

it('describes type and optionality drift of the stored schema', () => {
	const current = JSON.parse(JSON.stringify({ ...schema })) as Record<
		string,
		{ schema: { properties: Record<string, { type: string; config?: { optional?: boolean } }> } }
	>;
	expect(describeStorageSchemaMismatch(current)).toBeNull();
	const drifted = JSON.parse(JSON.stringify(current)) as typeof current;
	drifted.intentionAssessments.schema.properties.source.type = 'number';
	expect(describeStorageSchemaMismatch(drifted)).toBe(
		'intentionAssessments.source: number instead of string'
	);
	const stricter = JSON.parse(JSON.stringify(current)) as typeof current;
	stricter.intentionAssessments.schema.properties.values.config = {};
	expect(describeStorageSchemaMismatch(stricter)).toBe(
		'intentionAssessments.values: required in storage'
	);
	expect(describeStorageSchemaMismatch(undefined)).toBe('scopeCaptureSettings: missing');
});
