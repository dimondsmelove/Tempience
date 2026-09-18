import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { buildRepositoryExplorerSnapshot } from '../Workbench/snapshot';
import { createBackupRepository } from './Backup/Backup';
import { DATA_SPACES, CANONICAL_DATA_SPACE_ID, createImportedDataSpace } from './data-space';
import { createTriplitRepository } from './repository';
import { schema } from './schema';

const clients: TriplitClient<typeof schema>[] = [];
const createClient = () => {
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
const setup = async () => {
	const client = createClient();
	const repo = createTriplitRepository(client);
	const { kind } = await repo.createTraceKind({
		name: 'Измерение',
		initialKindV: { dataSchema: { type: 'object', properties: {} } }
	});
	const a = await repo.createScope({ name: 'A' });
	const b = await repo.createScope({ name: 'B' });
	return { client, repo, kind, a, b };
};

it('supports zero/multiple direct memberships without putting Kind in the Trace snapshot', async () => {
	const { repo, kind, a, b } = await setup();
	expect(await repo.setTraceKindScopes(kind.id, [])).toEqual([]);
	const links = await repo.setTraceKindScopes(kind.id, [a.id, b.id, a.id]);
	expect(links).toHaveLength(2);
	expect(links.every((link) => link.fromEntityType === 'traceKind')).toBe(true);
	expect((await buildRepositoryExplorerSnapshot(repo, 'test')).intersections).toEqual([]);
	await repo.setTraceKindScopes(kind.id, [b.id]);
	expect((await repo.listIntersections()).map((link) => link.toId)).toEqual([b.id]);
	await repo.setTraceKindScopes(kind.id, []);
	expect(await repo.listIntersections()).toEqual([]);
});

it('restores only memberships removed by this Scope deletion despite unrelated Kind edits', async () => {
	const { repo, kind, a, b } = await setup();
	const [original] = await repo.setTraceKindScopes(kind.id, [a.id]);
	await repo.setScopeDeleted(a.id, true);
	await repo.editTraceKind(kind.id, 'Другое название');
	await repo.setTraceKindScopes(kind.id, [b.id]);
	await repo.setScopeDeleted(a.id, false);
	expect(await repo.listIntersections()).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				id: original.id,
				activationId: original.activationId,
				isDeleted: false
			}),
			expect.objectContaining({ toId: b.id, isDeleted: false })
		])
	);
	const scopeLogs = await repo.listLogs(a.id);
	const linkLogs = await repo.listLogs(original.id);
	for (const action of ['deleted', 'restored']) {
		const scopeLog = scopeLogs.find((log) => log.action === action)!;
		expect(linkLogs).toContainEqual(
			expect.objectContaining({
				action,
				operationId: scopeLog.operationId,
				occurredAt: scopeLog.occurredAt
			})
		);
	}
});

it('explicit No Scope cancels pending restoration even when active memberships are already empty', async () => {
	const { repo, kind, a } = await setup();
	await repo.setTraceKindScopes(kind.id, [a.id]);
	await repo.setScopeDeleted(a.id, true);
	await repo.setTraceKindScopes(kind.id, []);
	await repo.setScopeDeleted(a.id, false);
	expect(await repo.listIntersections()).toEqual([]);
});

it('manual removal cancels only that pending membership and does not revive an older unlink', async () => {
	const { repo, kind, a, b } = await setup();
	const [first, second] = await repo.setTraceKindScopes(kind.id, [a.id, b.id]);
	await repo.setIntersectionDeleted(first.id, true);
	await repo.setScopeDeleted(a.id, true);
	await repo.setScopeDeleted(b.id, true);
	await repo.setIntersectionDeleted(second.id, true);
	await repo.setScopeDeleted(a.id, false);
	await repo.setScopeDeleted(b.id, false);
	expect(await repo.listIntersections()).toEqual([]);
});

it('refuses an unavailable Scope atomically and gives a relink a new activation', async () => {
	const { repo, kind, a, b } = await setup();
	const [link] = await repo.setTraceKindScopes(kind.id, [a.id]);
	await repo.setScopeDeleted(b.id, true);
	const logs = await repo.listLogs();
	await expect(repo.setTraceKindScopes(kind.id, [b.id])).rejects.toThrow('Scope');
	expect(await repo.listLogs()).toEqual(logs);
	expect(await repo.listIntersections()).toEqual([link]);
	await repo.setTraceKindScopes(kind.id, []);
	const [relinked] = await repo.setTraceKindScopes(kind.id, [a.id]);
	expect(relinked.id).toBe(link.id);
	expect(relinked.createdAt).toBe(link.createdAt);
	expect(relinked.activationId).not.toBe(link.activationId);
	expect(() => repo.setTraceKindScopes(kind.id, [], 'ai')).toThrow();
});

it('preserves removal provenance through backup/import and restores it in the imported space', async () => {
	const { client, repo, kind, a } = await setup();
	const [original] = await repo.setTraceKindScopes(kind.id, [a.id]);
	await repo.setScopeDeleted(a.id, true);
	const backup = await createBackupRepository(
		client,
		DATA_SPACES[CANONICAL_DATA_SPACE_ID]
	).export();
	const restored = createClient();
	const imported = createImportedDataSpace('Membership test');
	await createBackupRepository(restored, imported).restore(backup);
	const restoredRepo = createTriplitRepository(restored);
	expect(await restoredRepo.listLogs()).toEqual(await repo.listLogs());
	await restoredRepo.setScopeDeleted(a.id, false);
	expect(await restoredRepo.listIntersections()).toEqual([
		expect.objectContaining({
			id: original.id,
			activationId: original.activationId,
			isDeleted: false
		})
	]);
});

it('leaves existing Trace data and memberships intact when deleting a Kind Scope', async () => {
	const { repo, kind, a } = await setup();
	await repo.setTraceKindScopes(kind.id, [a.id]);
	const trace = await repo.createTraceWithScope(
		{
			content: 'Существующий факт',
			capturedAt: '2026-09-12T12:00:00.000Z',
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: { basis: 'unknown' }
		},
		a.id
	);
	const [membership] = (await repo.listIntersections()).filter((row) => row.fromId === trace.id);
	await repo.setScopeDeleted(a.id, true);
	expect(await repo.listTraces()).toEqual([trace]);
	expect(await repo.listIntersections()).toEqual([membership]);
});

it.each(['missing-target', 'invalid-removal'] as const)(
	'rejects %s in imported Kind membership before any write',
	async (corruption) => {
		const { client, repo, kind, a } = await setup();
		await repo.setTraceKindScopes(kind.id, [a.id]);
		const backup = await createBackupRepository(
			client,
			DATA_SPACES[CANONICAL_DATA_SPACE_ID]
		).export();
		const [row] = backup.collections.intersections;
		if (corruption === 'missing-target') row.toId = 'missing';
		else row.scopeDeletionOperationId = 'unrelated-operation';
		const restored = createClient();
		const target = createBackupRepository(restored, createImportedDataSpace('Invalid membership'));
		await expect(target.restore(backup)).rejects.toThrow(/принадлежност/);
		expect(
			Object.values((await target.export()).collections).every((rows) => rows.length === 0)
		).toBe(true);
	}
);
