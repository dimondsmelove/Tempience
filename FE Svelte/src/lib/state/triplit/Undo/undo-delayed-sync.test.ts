import { expect, it } from 'vitest';
import { openSyncFixture, SYNC_URL, type SyncFixture } from '../sync.fixture';
import { evaluate, plainDraft } from './undo.fixture';

const collections = ['traces', 'intersections', 'intentionAssessments', 'logs'] as const;

/**
 * The delivery order the local tests cannot produce: the inverse of a first creation runs
 * before another replica's independent first creation of the same source arrives.
 */
it.runIf(SYNC_URL)(
	'keeps a delayed independent first creation alive after the inverse of another creation',
	async () => {
		const sync: SyncFixture = await openSyncFixture(collections);
		const [first, second] = sync.replicas.map((replica) => replica.repository);
		try {
			const intention = await first.createTrace(plainDraft('Sync delayed intention', 'intend'));
			const fact = await first.createTrace(plainDraft('Sync delayed fact', 'actual'));
			const link = await first.createIntersection({
				fromId: fact.id,
				toId: intention.id,
				kind: 'evidence_for'
			});
			await sync.acked(0);
			await expect.poll(() => sync.has(1, 'intersections', link.id), { timeout: 10000 }).toBe(true);
			await sync.replicas[1].client.disconnect();
			await expect
				.poll(() => sync.replicas[1].client.connectionStatus, { timeout: 10000 })
				.toBe('CLOSED');

			const own = await first.createEvidenceAssessment(link.id, { outcome: 'partial', open: true });
			await sync.acked(0);
			const delayed = await second.createEvidenceAssessment(link.id, {
				outcome: 'completed',
				open: false
			});
			expect(delayed.id).toBe(own.id);
			const delayedLog = (await second.listLogs(delayed.id))[0];
			expect(
				Object.keys((await sync.raw(0, 'intentionAssessments', own.id))!.initial as object)
			).toEqual([own.outcomeRevision]);

			// The inverse runs with one known candidate; it withdraws that candidate, not the source.
			const undone = await first.undoOperation(own.outcomeRevision!);
			await sync.acked(0);
			expect(
				(await first.listIntentionAssessments()).find((row) => row.id === own.id)
			).toBeUndefined();
			expect((await sync.raw(0, 'intentionAssessments', own.id))!.isDeleted).not.toBe(true);

			await sync.replicas[1].client.connect();
			await expect.poll(sync.open, { timeout: 10000 }).toBe(true);
			await sync.acked(1);
			await expect.poll(() => sync.has(0, 'logs', delayedLog.id), { timeout: 10000 }).toBe(true);
			for (const index of [0, 1]) {
				await expect
					.poll(
						async () =>
							Object.keys(
								(await sync.raw(index, 'intentionAssessments', own.id))!.initial as object
							).length,
						{ timeout: 10000 }
					)
					.toBe(2);
			}
			await sync.acked(0);
			await sync.acked(1);

			for (const [index, repo] of [first, second].entries()) {
				const raw = (await sync.raw(index, 'intentionAssessments', own.id))!;
				expect(raw.isDeleted).not.toBe(true);
				expect(raw.initial).toEqual({
					[own.outcomeRevision!]: expect.objectContaining({
						outcome: 'partial',
						open: true,
						withdrawn: undone.operation.id
					}),
					[delayed.outcomeRevision!]: expect.objectContaining({ outcome: 'completed', open: false })
				});
				const source = (await repo.listIntentionAssessments()).find((row) => row.id === own.id);
				expect(source).toMatchObject({
					isDeleted: false,
					outcome: 'completed',
					open: false,
					outcomeRevision: delayed.outcomeRevision,
					firstAssessedAt: delayed.firstAssessedAt
				});
				const result = await evaluate(repo, intention.id);
				expect(result.outcome).toEqual({ value: 'completed', sourceId: own.id });
				expect(result.open).toEqual({ value: false, sourceId: own.id });
			}
			expect(sync.errors).toEqual([]);
		} finally {
			await sync.dispose();
		}
	},
	60000
);
