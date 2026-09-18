import type { TempienceTriplitClient } from './client';

/** Synced core collections shown in diagnostics; every new collection is listed here explicitly. */
export const SYNC_COLLECTIONS = [
	'traceKinds',
	'traceKindVersions',
	'traces',
	'periods',
	'scopes',
	'scopeSegments',
	'intersections',
	'intentionAssessments',
	'logs'
] as const;

export type SyncCollectionName = (typeof SYNC_COLLECTIONS)[number];

export type SyncCollectionDiagnostics = {
	local: number;
	server: number | null;
};

export type CollectionFetchPolicy = 'local-only' | 'remote-only';

const forEachCollection = <Value>(
	value: (name: SyncCollectionName) => Value
): Record<SyncCollectionName, Value> =>
	Object.fromEntries(SYNC_COLLECTIONS.map((name) => [name, value(name)])) as Record<
		SyncCollectionName,
		Value
	>;

export const getCollectionCounts = async (
	client: TempienceTriplitClient,
	policy: CollectionFetchPolicy
): Promise<Record<SyncCollectionName, number>> => {
	const counts = await Promise.all(
		SYNC_COLLECTIONS.map(
			async (name) =>
				[
					name,
					((await client.fetch(client.query(name) as never, { policy })) as unknown[]).length
				] as const
		)
	);
	return Object.fromEntries(counts) as Record<SyncCollectionName, number>;
};

export const unavailableServerCounts = (): Record<SyncCollectionName, null> =>
	forEachCollection(() => null);

export const getServerCollectionCounts = async (
	client: TempienceTriplitClient
): Promise<{ counts: Record<SyncCollectionName, number | null>; error: string | null }> => {
	try {
		return { counts: await getCollectionCounts(client, 'remote-only'), error: null };
	} catch (cause: unknown) {
		return {
			counts: unavailableServerCounts(),
			error: cause instanceof Error ? cause.message : 'server_unavailable'
		};
	}
};

export const combineCollectionCounts = (
	local: Record<SyncCollectionName, number>,
	server: Record<SyncCollectionName, number | null>
): Record<SyncCollectionName, SyncCollectionDiagnostics> =>
	forEachCollection((name) => ({ local: local[name], server: server[name] }));
