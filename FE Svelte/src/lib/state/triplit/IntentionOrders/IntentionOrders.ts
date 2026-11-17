import { Temporal } from 'temporal-polyfill';
import type { TempienceTriplitClient } from '../client';
import { assertStorageSchemaReady } from '../Repository/readiness';
import { fetchReplica } from '../replica-fetch';

export type IntentionOrder = { id: string; ids: string[]; updatedAt: string };

export const validOrderKey = (id: string): boolean => {
	if (id === 'later' || id === 'undated') return true;
	const match = /^(day|week):(\d{4}-\d{2}-\d{2})$/.exec(id);
	if (!match) return false;
	try {
		const date = Temporal.PlainDate.from(match[2]);
		return date.toString() === match[2] && (match[1] !== 'week' || date.dayOfWeek === 1);
	} catch {
		return false;
	}
};

/** Invalid entries and duplicates never prevent the rest of a stored order from being read. */
export const parseIntentionOrder = (row: {
	id: string;
	ids: unknown;
	updatedAt: string;
}): IntentionOrder => ({
	id: row.id,
	ids: Array.isArray(row.ids)
		? [
				...new Set(
					row.ids.filter(
						(id): id is string => typeof id === 'string' && id.length > 0 && id.trim() === id
					)
				)
			]
		: [],
	updatedAt: row.updatedAt
});

export const createIntentionOrdersRepository = (
	client: TempienceTriplitClient,
	now = () => new Date()
) => ({
	async list(): Promise<IntentionOrder[]> {
		await assertStorageSchemaReady(client);
		return (await fetchReplica(client, client.query('intentionOrders'))).map(parseIntentionOrder);
	},
	subscribe(next: (orders: IntentionOrder[]) => void, fail: (cause: unknown) => void): () => void {
		let disposed = false;
		let stop = () => {};
		void assertStorageSchemaReady(client)
			.then(() => {
				if (disposed) return;
				stop = client.subscribe(
					client.query('intentionOrders'),
					(rows) => {
						if (!disposed) next(rows.map(parseIntentionOrder));
					},
					fail
				);
			})
			.catch((cause) => {
				if (!disposed) fail(cause);
			});
		return () => {
			disposed = true;
			stop();
		};
	},
	async save(id: string, ids: readonly string[]): Promise<void> {
		await assertStorageSchemaReady(client);
		const row = parseIntentionOrder({ id, ids, updatedAt: now().toISOString() });
		await client.transact(async (tx) => {
			const existing = await tx.fetchById('intentionOrders', id);
			if (existing)
				await tx.update('intentionOrders', id, (current) => {
					current.ids = row.ids;
					current.updatedAt = row.updatedAt;
				});
			else await tx.insert('intentionOrders', row);
		});
	}
});
export type IntentionOrdersRepository = ReturnType<typeof createIntentionOrdersRepository>;
