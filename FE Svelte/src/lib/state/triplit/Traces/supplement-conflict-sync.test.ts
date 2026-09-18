import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createBackupRepository } from '../Backup/Backup';
import { createImportedDataSpace, DATA_SPACES } from '../data-space';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import { openSyncFixture, SYNC_URL, type SyncFixture } from '../sync.fixture';
import { outcome, plainDraft, plainFields } from './record.fixture';

const collections = ['traces', 'intersections'] as const;

const activeOriginals = async (repo: TempienceRepository, supplementId: string) =>
	(await repo.listIntersections())
		.filter((row) => row.kind === 'revisits' && row.fromId === supplementId)
		.map((row) => row.toId)
		.toSorted();

/** Relink the supplement to another original the supported way: withdraw, relink, restore. */
const relink = async (
	repo: TempienceRepository,
	supplementId: string,
	oldLinkId: string,
	originalId: string
) => {
	await repo.setTraceDeleted(supplementId, true);
	await repo.setIntersectionDeleted(oldLinkId, true);
	const link = await repo.createIntersection({
		fromId: supplementId,
		toId: originalId,
		kind: 'revisits'
	});
	await repo.setTraceDeleted(supplementId, false);
	return link;
};

const spare: TriplitClient<typeof schema>[] = [];
const restoreInto = async (file: unknown) => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	spare.push(client);
	await createBackupRepository(client, createImportedDataSpace('Копия')).restore(file);
	return createTriplitRepository(client);
};

type Row = Record<string, unknown> & { id: string };
type Snapshot = { collections: Record<string, Row[]> };

/** The raw export of a replica, then only this test's own records out of the shared synthetic DB. */
const exportOwn = async (client: TriplitClient<typeof schema>, traceIds: readonly string[]) => {
	const raw: Snapshot = JSON.parse(
		JSON.stringify(await createBackupRepository(client, DATA_SPACES.canonical).export())
	);
	const own = new Set(traceIds);
	const intersections = raw.collections.intersections.filter(
		(row) => own.has(String(row.fromId)) && own.has(String(row.toId))
	);
	const entities = new Set([...own, ...intersections.map((row) => row.id)]);
	const collections = Object.fromEntries(
		Object.keys(raw.collections).map((name) => [name, [] as Row[]])
	);
	collections.traces = raw.collections.traces.filter((row) => own.has(row.id));
	collections.intersections = intersections;
	collections.logs = raw.collections.logs.filter((row) => entities.has(String(row.entityId)));
	return { raw, own: { ...raw, collections } };
};

it.runIf(SYNC_URL)(
	'merges two offline relinks into an ambiguous supplement, refuses its saves and restore, and recovers through one withdrawal',
	async () => {
		const sync: SyncFixture = await openSyncFixture(collections);
		const [first, second] = sync.replicas.map((replica) => replica.repository);
		try {
			const [a, b, c] = await Promise.all(
				['A', 'B', 'C'].map((name) => first.createTrace(plainDraft(`Sync original ${name}`)))
			);
			const created = await first.saveTraceRecord({
				fields: plainFields('Sync supplement', {
					aboutKind: 'trace_ref',
					aboutTime: null,
					aboutTraceId: null
				}),
				links: { add: [{ kind: 'revisits', originalId: a.id }] }
			});
			const s = created.trace.id;
			const linkA = created.links[0].id;
			await sync.acked(0);
			for (const id of [a.id, b.id, c.id, s])
				await expect.poll(() => sync.has(1, 'traces', id), { timeout: 10000 }).toBe(true);
			await expect.poll(() => sync.has(1, 'intersections', linkA), { timeout: 10000 }).toBe(true);

			// Both replicas relink the same supplement while the second is offline.
			await sync.replicas[1].client.disconnect();
			await expect
				.poll(() => sync.replicas[1].client.connectionStatus, { timeout: 10000 })
				.toBe('CLOSED');
			const linkB = await relink(first, s, linkA, b.id);
			await sync.acked(0);
			const linkC = await relink(second, s, linkA, c.id);
			await sync.replicas[1].client.connect();
			await expect.poll(sync.open, { timeout: 10000 }).toBe(true);
			await sync.acked(1);

			// Merged state on both replicas: the supplement is active with two recorded originals.
			for (const repo of [first, second])
				await expect
					.poll(() => activeOriginals(repo, s), { timeout: 10000 })
					.toEqual([b.id, c.id].toSorted());
			// Only this test's journal rows: the synthetic server is shared with other probes.
			const ownLogs = async (repo: TempienceRepository) =>
				(await repo.listLogs())
					.filter((log) => [a.id, b.id, c.id, s, linkA, linkB.id, linkC.id].includes(log.entityId))
					.map((log) => log.id);
			const logsBefore = await Promise.all([first, second].map(ownLogs));
			for (const [index, repo] of [first, second].entries()) {
				expect(
					await outcome(
						repo.saveTraceRecord({ id: s, fields: { title: 'Sync supplement (edited)' } })
					)
				).toBe('supplement_cardinality');
				expect(await ownLogs(repo)).toEqual(logsBefore[index]);
			}
			// Export preserves the conflicting snapshot; restore refuses it before any write.
			const ids = [a.id, b.id, c.id, s];
			const conflicting = await exportOwn(sync.replicas[0].client, ids);
			expect(
				conflicting.raw.collections.intersections.filter(
					(row) => row.fromId === s && row.kind === 'revisits' && row.isDeleted !== true
				)
			).toHaveLength(2);
			await expect(restoreInto(conflicting.own)).rejects.toThrow('Дополнение');

			// Explicit recovery through the existing withdrawal: the chosen original stays, nothing is lost.
			await first.setIntersectionDeleted(linkC.id, true);
			await sync.acked(0);
			for (const repo of [first, second])
				await expect.poll(() => activeOriginals(repo, s), { timeout: 10000 }).toEqual([b.id]);
			const edited = await second.saveTraceRecord({
				id: s,
				fields: { title: 'Sync supplement (after merge)' }
			});
			await sync.acked(1);
			await expect
				.poll(async () => (await sync.raw(0, 'traces', s))?.content, { timeout: 10000 })
				.toBe('Sync supplement (after merge)');
			for (const [index, repo] of [first, second].entries()) {
				const traces = await repo.listTraces(true);
				expect(traces.map((row) => row.id)).toEqual(expect.arrayContaining([a.id, b.id, c.id, s]));
				expect(traces.find((row) => row.id === s)).toMatchObject({
					isDeleted: false,
					content: edited.trace.content
				});
				const links = await repo.listIntersections(true);
				expect(links.map((row) => [row.id, row.isDeleted])).toEqual(
					expect.arrayContaining([
						[linkA, true],
						[linkB.id, false],
						[linkC.id, true]
					])
				);
				const logs = await ownLogs(repo);
				expect(logsBefore[index].every((id) => logs.includes(id))).toBe(true);
				expect(logs.length).toBeGreaterThan(logsBefore[index].length);
			}
			// The recovered snapshot restores again as a whole.
			const recovered = await exportOwn(sync.replicas[0].client, ids);
			const restored = await restoreInto(recovered.own);
			expect(await activeOriginals(restored, s)).toEqual([b.id]);
			expect((await restored.listTraces(true)).map((row) => row.id)).toEqual(
				expect.arrayContaining([a.id, b.id, c.id, s])
			);
			expect(sync.errors).toEqual([]);
		} finally {
			await sync.dispose();
			for (const client of spare.splice(0)) {
				await client.clear({ full: true });
				client.disconnect();
			}
		}
	},
	45000
);
