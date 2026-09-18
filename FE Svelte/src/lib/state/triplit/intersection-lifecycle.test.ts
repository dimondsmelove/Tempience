import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';

it('relinks a removed Intersection in real Triplit without replacing its identity or creation time', async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	try {
		const repo = createTriplitRepository(client);
		const draft = {
			content: 'Связанная запись',
			capturedAt: '2026-09-12T12:00:00Z',
			timezone: 'UTC',
			aboutKind: 'instant' as const,
			aboutTime: { basis: 'unknown' as const }
		};
		const from = await repo.createTrace(draft);
		const to = await repo.createTrace(draft);
		const input = { fromId: from.id, toId: to.id, kind: 'related_to' as const };
		const original = await repo.createIntersection(input);
		await repo.setIntersectionDeleted(original.id, true);
		expect(await repo.listIntersections()).toEqual([]);
		await expect(
			repo.createIntersection({ ...input, context: 'Связано повторно' })
		).resolves.toMatchObject({
			id: original.id,
			createdAt: original.createdAt,
			isDeleted: false,
			context: 'Связано повторно'
		});
		expect(await repo.listIntersections()).toHaveLength(1);
		const before = await repo.listLogs(original.id);
		await repo.createIntersection(input);
		expect(await repo.listLogs(original.id)).toEqual(before);
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});
