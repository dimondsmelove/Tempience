import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it, vi } from 'vitest';
import { schema } from '../schema';
import { createBackupRepository } from '../Backup/Backup';
import { parseDataSpaceBackup } from '../Backup/parse';
import { createImportedDataSpace } from '../data-space';
import { createIntentionOrdersRepository, parseIntentionOrder } from './IntentionOrders';
const clients: TriplitClient<typeof schema>[] = [];
const clientOf = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return client;
};
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});
it('saves independent orders, publishes updates and survives backup and restore', async () => {
	const client = clientOf();
	const repo = createIntentionOrdersRepository(client);
	const next = vi.fn();
	const stop = repo.subscribe(next, (cause) => {
		throw cause;
	});
	await repo.save('later', ['a', 'b']);
	await repo.save('undated', ['c']);
	await repo.save('later', ['b', 'a']);
	await vi.waitFor(() =>
		expect(next).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ id: 'later', ids: ['b', 'a'] })])
		)
	);
	const backup = await createBackupRepository(client, createImportedDataSpace('Source')).export();
	const copy = clientOf();
	await createBackupRepository(copy, createImportedDataSpace('Copy')).restore(backup);
	expect(await createIntentionOrdersRepository(copy).list()).toEqual(await repo.list());
	const older = {
		...backup,
		collections: Object.fromEntries(
			Object.entries(backup.collections).filter(
				([key]) => key !== 'intentionOrders' && key !== 'legendView'
			)
		)
	};
	expect(parseDataSpaceBackup(older).collections.intentionOrders).toEqual([]);
	stop();
});
it('discards malformed ID entries without losing valid IDs', () => {
	expect(
		parseIntentionOrder({ id: 'later', ids: ['a', null, '', ' b ', 'a', 'b'], updatedAt: 'now' })
			.ids
	).toEqual(['a', 'b']);
	expect(parseIntentionOrder({ id: 'later', ids: {}, updatedAt: 'now' }).ids).toEqual([]);
});
