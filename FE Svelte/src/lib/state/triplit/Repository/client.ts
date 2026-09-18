import type { TempienceTriplitClient } from '../client';
import { fetchReplica } from '../replica-fetch';
import { assertStorageSchemaReady } from './readiness';
import type { Collection, Entity, RepositoryClient } from './types';

const queryFor = (client: TempienceTriplitClient, collection: Collection) => {
	switch (collection) {
		case 'scopeCaptureSettings':
			return client.query('scopeCaptureSettings');
		case 'traceKinds':
			return client.query('traceKinds');
		case 'traceKindVersions':
			return client.query('traceKindVersions');
		case 'traces':
			return client.query('traces');
		case 'periods':
			return client.query('periods');
		case 'scopes':
			return client.query('scopes');
		case 'scopeSegments':
			return client.query('scopeSegments');
		case 'intersections':
			return client.query('intersections');
		case 'sources':
			return client.query('sources');
		case 'assertions':
			return client.query('assertions');
		case 'citations':
			return client.query('citations');
		case 'assertionRelations':
			return client.query('assertionRelations');
		case 'provenanceLinks':
			return client.query('provenanceLinks');
		case 'intentionAssessments':
			return client.query('intentionAssessments');
		case 'logs':
			return client.query('logs');
		default: {
			const unknown: never = collection;
			throw new Error(`Unknown collection: ${String(unknown)}`);
		}
	}
};

export const asRepositoryClient = (client: TempienceTriplitClient): RepositoryClient => ({
	transact: (callback) =>
		client.transact((transaction) =>
			callback({
				fetch: async (collection) =>
					(await transaction.fetch(queryFor(client, collection) as never)) as unknown as Entity[],
				fetchById: async (collection, id) =>
					(await transaction.fetchById(collection, id)) as Entity | null,
				insert: async (collection, value) =>
					(await transaction.insert(collection, value as never)) as Entity,
				update: (collection, id, value) => transaction.update(collection, id, value as never)
			})
		),
	fetch: async (collection) =>
		(await fetchReplica(client, queryFor(client, collection) as never)) as unknown as Entity[],
	// The same background pull the deleted-records list relies on, one row at a time.
	warm: async (rows) => {
		await Promise.all(
			rows.map(({ collection, id }) => {
				const query = (queryFor(client, collection) as unknown as { Id(id: string): unknown }).Id(
					id
				);
				return fetchReplica(client, query as never).catch(() => undefined);
			})
		);
	},
	ready: () => assertStorageSchemaReady(client)
});
