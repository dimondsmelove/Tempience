import { describe, expect, it } from 'vitest';
import { DATA_SPACES } from './data-space';
import {
	createScenarioImportRepository,
	type ScenarioImportBatch
} from './scenario-import-repository';
import type { RepositoryClient } from './repository';

type Collection = Parameters<RepositoryClient['fetch']>[0];
type Row = Record<string, unknown> & { id: string };

const allCollections: Collection[] = [
	'traceKinds',
	'traceKindVersions',
	'traces',
	'periods',
	'scopes',
	'scopeSegments',
	'intersections',
	'sources',
	'assertions',
	'citations',
	'assertionRelations',
	'provenanceLinks',
	'logs'
];

const fakeClient = (failAfter = Number.POSITIVE_INFINITY) => {
	const stores = Object.fromEntries(
		allCollections.map((name) => [name, new Map<string, Row>()])
	) as Record<Collection, Map<string, Row>>;
	let writes = 0;
	const client: RepositoryClient = {
		transact: async (callback) => {
			const snapshot = new Map(
				allCollections.map((name) => [name, new Map(stores[name].entries())])
			);
			try {
				return await callback({
					fetch: async (collection) => [...stores[collection].values()],
					fetchById: async (collection, id) => stores[collection].get(id),
					insert: async (collection, value) => {
						writes += 1;
						if (writes === failAfter) throw new Error('injected insert failure');
						const row = value as Row;
						stores[collection].set(row.id, row);
						return row;
					},
					update: async (collection, id, value) => {
						const row = stores[collection].get(id);
						if (!row) throw new Error(`missing ${collection}:${id}`);
						stores[collection].set(id, { ...row, ...value });
					}
				});
			} catch (error) {
				for (const [name, rows] of snapshot) {
					stores[name].clear();
					for (const [id, row] of rows) stores[name].set(id, row);
				}
				throw error;
			}
		},
		fetch: async (collection) => [...stores[collection].values()]
	};
	return { client, stores };
};

const makeBatch = (overrides: Partial<ScenarioImportBatch> = {}): ScenarioImportBatch => ({
	schemaVersion: 'tempience.scenario-import.v1',
	manifestId: 'manifest-belgrade',
	manifestVersion: 1,
	targetDataSpaceId: 'belgrade-what-if-v1',
	capturedAt: '2026-08-29T10:00:00.000Z',
	mapping: {
		'scope:candidate': 'scope-1',
		'trace:candidate': 'trace-1',
		'link:candidate': 'trace-1:scope-1:belongs_to'
	},
	entries: [
		{
			type: 'scope',
			id: 'scope-1',
			candidateId: 'scope:candidate',
			draft: { name: 'Belgrade', note: null }
		},
		{
			type: 'trace',
			id: 'trace-1',
			candidateId: 'trace:candidate',
			draft: {
				content: 'Arrived',
				timezone: 'Europe/Belgrade',
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-08-29T11:00:00+02:00',
					end: null
				}
			}
		},
		{
			type: 'intersection',
			id: 'trace-1:scope-1:belongs_to',
			candidateId: 'link:candidate',
			draft: {
				fromId: 'trace:candidate',
				toId: 'scope:candidate',
				kind: 'belongs_to'
			}
		}
	],
	skipped: [],
	...overrides
});

const repository = (client: RepositoryClient) =>
	createScenarioImportRepository(client, DATA_SPACES['belgrade-what-if-v1'], {
		now: () => '2026-08-29T10:01:00.000Z',
		deviceId: 'test-device'
	});

describe('scenario import repository', () => {
	it('inspects without writes and applies a fresh batch', async () => {
		const { client, stores } = fakeClient();
		const importer = repository(client);
		const preview = await importer.inspect(makeBatch());
		expect(preview.planned).toEqual({ created: 3, reused: 0, skipped: 0 });
		expect([...stores.traces]).toHaveLength(0);
		const receipt = await importer.apply(makeBatch());
		expect(receipt).toMatchObject({ created: 3, reused: 0, skipped: 0, failures: [] });
		expect(stores.logs).toHaveLength(3);
	});

	it('is idempotent and preserves first-import capturedAt', async () => {
		const { client, stores } = fakeClient();
		const importer = repository(client);
		const first = await importer.apply(makeBatch());
		const second = await importer.apply({ ...makeBatch(), capturedAt: '2026-08-30T10:00:00.000Z' });
		expect(second).toMatchObject({ created: 0, reused: 3, capturedAt: first.capturedAt });
		expect(stores.traces.get('trace-1')?.capturedAt).toBe(first.capturedAt);
		expect(stores.logs).toHaveLength(3);
	});

	it('rejects drift before writing', async () => {
		const { client, stores } = fakeClient();
		const importer = repository(client);
		await importer.apply(makeBatch());
		stores.scopes.get('scope-1')!.name = 'Changed';
		await expect(importer.apply(makeBatch())).rejects.toThrow(/differs/);
		expect(stores.logs).toHaveLength(3);
	});

	it('rejects canonical and invalid skipped endpoint batches', async () => {
		const { client } = fakeClient();
		const importer = createScenarioImportRepository(client, DATA_SPACES.canonical);
		await expect(importer.apply(makeBatch())).rejects.toThrow(/canonical/);
		const scenario = repository(client);
		await expect(
			scenario.apply({
				...makeBatch(),
				skipped: [{ candidateId: 'scope:candidate', reason: 'deferred' }]
			})
		).rejects.toThrow(/skipped/);
	});

	it('rolls back entities and logs on injected insert failure', async () => {
		const { client, stores } = fakeClient(2);
		await expect(repository(client).apply(makeBatch())).rejects.toThrow(/injected/);
		expect(stores.scopes).toHaveLength(0);
		expect(stores.traces).toHaveLength(0);
		expect(stores.intersections).toHaveLength(0);
		expect(stores.logs).toHaveLength(0);
	});

	it("carries a plain record's description, refuses one on a typed record, reuses rows without the key", async () => {
		const withDescription = (description: string | null | undefined): ScenarioImportBatch => ({
			...makeBatch(),
			entries: makeBatch().entries.map((entry) =>
				entry.type === 'trace' ? { ...entry, draft: { ...entry.draft, description } } : entry
			)
		});
		const { client, stores } = fakeClient();
		await repository(client).apply(withDescription('First line\n→ next: the sequel'));
		expect(stores.traces.get('trace-1')?.description).toBe('First line\n→ next: the sequel');
		// The same batch again: reused, not drift.
		expect(
			(await repository(client).inspect(withDescription('First line\n→ next: the sequel'))).planned
		).toEqual({
			created: 0,
			reused: 3,
			skipped: 0
		});
		expect((await repository(client).inspect(withDescription('Other'))).drift).toHaveLength(1);

		const legacy = fakeClient();
		await repository(legacy.client).apply(withDescription(undefined));
		expect('description' in (legacy.stores.traces.get('trace-1') ?? {})).toBe(true);
		expect(legacy.stores.traces.get('trace-1')?.description).toBeNull();
		// A row imported before descriptions travelled has no key at all; it reads as none.
		const stored = legacy.stores.traces.get('trace-1') ?? { id: 'trace-1' };
		delete stored.description;
		expect((await repository(legacy.client).inspect(withDescription(null))).planned).toEqual({
			created: 0,
			reused: 3,
			skipped: 0
		});

		const typed = fakeClient();
		typed.stores.traceKinds.set('kind-1', { id: 'kind-1', name: 'Reading', isDeleted: false });
		typed.stores.traceKindVersions.set('kind-1-v1', {
			id: 'kind-1-v1',
			kindId: 'kind-1',
			dataSchema: { type: 'object', properties: { n: { type: 'integer' } } },
			isDeleted: false
		});
		const typedBatch: ScenarioImportBatch = {
			...makeBatch(),
			entries: makeBatch().entries.map((entry) =>
				entry.type === 'trace'
					? {
							...entry,
							draft: {
								...entry.draft,
								content: '',
								description: 'Not here',
								kindId: 'kind-1',
								kindVId: 'kind-1-v1',
								data: { n: 1 }
							}
						}
					: entry
			)
		};
		const preview = await repository(typed.client).inspect(typedBatch);
		expect(preview.errors.map((issue) => issue.reason)).toEqual([
			'Typed Trace keeps its description in content'
		]);
	});

	it('preserves a Period note and accepts legacy batches without one', async () => {
		const { client, stores } = fakeClient();
		const batch = makeBatch({
			mapping: { ...makeBatch().mapping, 'period:candidate': 'period-1' },
			entries: [
				...makeBatch().entries,
				{
					type: 'period',
					id: 'period-1',
					candidateId: 'period:candidate',
					draft: {
						name: 'August',
						time: { precision: 'month', start: '2026-08', end: '2026-08' },
						timezone: 'Europe/Belgrade',
						note: 'First line\nSecond line'
					}
				}
			]
		});
		expect((await repository(client).inspect(batch)).planned).toEqual({
			created: 4,
			reused: 0,
			skipped: 0
		});
		await repository(client).apply(batch);
		expect(stores.periods.get('period-1')?.note).toBe('First line\nSecond line');

		const legacy = fakeClient();
		legacy.stores.periods.set('period-1', {
			id: 'period-1',
			name: 'August',
			time: { precision: 'month', start: '2026-08', end: '2026-08' },
			timezone: 'Europe/Belgrade',
			isDeleted: false
		});
		const oldBatch = {
			...batch,
			entries: batch.entries.map((entry) =>
				entry.type === 'period' ? { ...entry, draft: { ...entry.draft, note: undefined } } : entry
			)
		};
		expect((await repository(legacy.client).inspect(oldBatch)).planned).toEqual({
			created: 3,
			reused: 1,
			skipped: 0
		});
	});
});
