import { expect, it } from 'vitest';
import { openSyncFixture, SYNC_URL, type SyncFixture } from '../sync.fixture';
import { evaluate, plainDraft } from './undo.fixture';

const collections = ['traces', 'intersections', 'intentionAssessments', 'logs'] as const;

/**
 * The delivery order the local tests cannot produce: another replica corrects a source
 * offline, and the inverse of that source's creation runs before the correction arrives.
 */
it.runIf(SYNC_URL)(
	'keeps a delayed independent correction effective after the inverse of the creation it corrected',
	async () => {
		const sync: SyncFixture = await openSyncFixture(collections);
		const [first, second] = sync.replicas.map((replica) => replica.repository);
		const sourceOn = async (index: number, id: string) =>
			(await sync.replicas[index].repository.listIntentionAssessments()).find(
				(row) => row.id === id
			);
		try {
			const full = await first.createTrace(plainDraft('Sync corrected intention', 'intend'));
			const partial = await first.createTrace(
				plainDraft('Sync partly corrected intention', 'intend')
			);
			const fact = await first.createTrace(plainDraft('Sync corrected fact', 'actual'));
			const links = [
				await first.createIntersection({ fromId: fact.id, toId: full.id, kind: 'evidence_for' }),
				await first.createIntersection({ fromId: fact.id, toId: partial.id, kind: 'evidence_for' })
			];
			const created = [
				await first.createEvidenceAssessment(links[0].id, { outcome: 'partial', open: true }),
				await first.createEvidenceAssessment(links[1].id, { outcome: 'partial', open: true })
			];
			await sync.acked(0);
			for (const row of created)
				await expect
					.poll(() => sync.has(1, 'intentionAssessments', row.id), { timeout: 10000 })
					.toBe(true);
			await sync.replicas[1].client.disconnect();
			await expect
				.poll(() => sync.replicas[1].client.connectionStatus, { timeout: 10000 })
				.toBe('CLOSED');

			// Offline on the second replica: one source fully corrected, the other on one feature only.
			const corrections = [
				(await second.editIntentionAssessment(created[0].id, { outcome: 'completed', open: false }))
					.assessment,
				(await second.editIntentionAssessment(created[1].id, { outcome: 'completed' })).assessment
			];
			// The first replica, unaware, takes both creations back; each accepts with one candidate.
			const undone = [
				await first.undoOperation(created[0].outcomeRevision!),
				await first.undoOperation(created[1].outcomeRevision!)
			];
			await sync.acked(0);
			for (const row of created) expect(await sourceOn(0, row.id)).toBeUndefined();

			await sync.replicas[1].client.connect();
			await expect.poll(sync.open, { timeout: 10000 }).toBe(true);
			await sync.acked(1);
			for (const [index, correction] of corrections.entries()) {
				const log = (await second.listLogs(created[index].id)).find(
					(entry) => entry.operationId === correction.outcomeRevision
				)!;
				await expect.poll(() => sync.has(0, 'logs', log.id), { timeout: 10000 }).toBe(true);
				await expect
					.poll(
						async () =>
							(
								(await sync.raw(0, 'intentionAssessments', created[index].id))?.values as {
									outcome?: { operationId?: string };
								}
							)?.outcome?.operationId,
						{ timeout: 10000 }
					)
					.toBe(correction.outcomeRevision);
			}
			await sync.acked(0);
			await sync.acked(1);

			for (const [index, repo] of [first, second].entries()) {
				const fully = await sourceOn(index, created[0].id);
				expect(fully).toMatchObject({
					isDeleted: false,
					outcome: 'completed',
					open: false,
					outcomeRevision: corrections[0].outcomeRevision,
					firstAssessedAt: created[0].firstAssessedAt
				});
				const fullResult = await evaluate(repo, full.id);
				expect(fullResult.outcome).toEqual({ value: 'completed', sourceId: created[0].id });
				expect(fullResult.open).toEqual({ value: false, sourceId: created[0].id });
				// Only the corrected feature stands; the withdrawn creation's `open` is not revived.
				const partly = await sourceOn(index, created[1].id);
				expect(partly).toMatchObject({ isDeleted: false, outcome: 'completed', open: null });
				const partialResult = await evaluate(repo, partial.id);
				expect(partialResult.outcome).toEqual({ value: 'completed', sourceId: created[1].id });
				expect(partialResult.open).toEqual({ value: true, sourceId: null });
				for (const [n, row] of created.entries()) {
					const raw = (await sync.raw(index, 'intentionAssessments', row.id))!;
					expect(raw.isDeleted).not.toBe(true);
					expect(
						(raw.initial as Record<string, { withdrawn?: string }>)[row.outcomeRevision!].withdrawn
					).toBe(undone[n].operation.id);
				}
			}
			expect(sync.errors).toEqual([]);
		} finally {
			await sync.dispose();
		}
	},
	60000
);
