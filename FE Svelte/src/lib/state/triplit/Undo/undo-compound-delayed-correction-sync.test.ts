import { expect, it } from 'vitest';
import { openSyncFixture, SYNC_URL, type SyncFixture } from '../sync.fixture';
import { evaluate, plainDraft } from './undo.fixture';

const collections = ['traces', 'intersections', 'intentionAssessments', 'logs'] as const;

/**
 * A save that added evidence is not offered back: the inverse would withdraw the new link and
 * with it a correction or first assessment another replica made offline and delivers later.
 */
it.runIf(SYNC_URL)(
	'refuses to undo a save that added evidence before any write, so a delayed correction and first assessment keep their effect',
	async () => {
		const sync: SyncFixture = await openSyncFixture(collections);
		const [first, second] = sync.replicas.map((replica) => replica.repository);
		// Only this test's journal rows: the synthetic server is shared with other probes.
		const own = new Set<string>();
		const journal = async (index: number) =>
			(
				(await sync.replicas[index].client.fetch(sync.replicas[index].client.query('logs'), {
					policy: 'local-only'
				})) as { id: string; entityId: string; cause: string }[]
			)
				.filter((log) => own.has(log.entityId))
				.map((log) => `${log.id}:${log.cause}`)
				.toSorted();
		try {
			const fact = await first.createTrace(plainDraft('Sync compound fact', 'actual'));
			const assessed = await first.createTrace(plainDraft('Sync assessed intention', 'intend'));
			const unassessed = await first.createTrace(plainDraft('Sync unassessed intention', 'intend'));
			await sync.acked(0);
			for (const id of [fact.id, assessed.id, unassessed.id])
				await expect.poll(() => sync.has(1, 'traces', id), { timeout: 10000 }).toBe(true);

			// Two saves of the EXISTING fact: one adds evidence with its first assessment, the other
			// edits a field and adds evidence without an assessment.
			const withAssessment = await first.saveTraceRecord({
				id: fact.id,
				fields: {},
				links: {
					add: [
						{
							kind: 'evidence_for',
							intentionId: assessed.id,
							assessment: { outcome: 'partial', open: true }
						}
					]
				}
			});
			const withField = await first.saveTraceRecord({
				id: fact.id,
				fields: { title: 'Sync compound fact (edited)' },
				links: { add: [{ kind: 'evidence_for', intentionId: unassessed.id }] }
			});
			const source = withAssessment.assessments[0];
			for (const id of [fact.id, withAssessment.links[0].id, withField.links[0].id, source.id])
				own.add(id);
			await sync.acked(0);
			await expect
				.poll(() => sync.has(1, 'intentionAssessments', source.id), { timeout: 10000 })
				.toBe(true);
			await expect
				.poll(() => sync.has(1, 'intersections', withField.links[0].id), { timeout: 10000 })
				.toBe(true);
			await expect
				.poll(async () => (await sync.raw(1, 'traces', fact.id))?.content, { timeout: 10000 })
				.toBe('Sync compound fact (edited)');

			await sync.replicas[1].client.disconnect();
			await expect
				.poll(() => sync.replicas[1].client.connectionStatus, { timeout: 10000 })
				.toBe('CLOSED');
			// Offline on the second replica: the first assessment is corrected, the unassessed link
			// receives its first assessment.
			const { assessment: correction } = await second.editIntentionAssessment(source.id, {
				outcome: 'completed',
				open: false
			});
			const delayed = await second.createEvidenceAssessment(withField.links[0].id, {
				outcome: 'completed',
				open: false
			});

			// The first replica, unaware, tries to undo both saves: refused whole, no write, no Log.
			const journalBefore = await journal(0);
			const rowsBefore = [
				await sync.raw(0, 'traces', fact.id),
				await sync.raw(0, 'intersections', withAssessment.links[0].id),
				await sync.raw(0, 'intersections', withField.links[0].id),
				await sync.raw(0, 'intentionAssessments', source.id)
			];
			for (const operation of [withAssessment.operation.id, withField.operation.id]) {
				await expect(first.undoOperation(operation)).rejects.toMatchObject({
					code: 'undo_unsupported',
					details: { entityType: 'intersection', reason: 'evidence_link' }
				});
			}
			expect(await journal(0)).toEqual(journalBefore);
			expect([
				await sync.raw(0, 'traces', fact.id),
				await sync.raw(0, 'intersections', withAssessment.links[0].id),
				await sync.raw(0, 'intersections', withField.links[0].id),
				await sync.raw(0, 'intentionAssessments', source.id)
			]).toEqual(rowsBefore);
			expect((await first.listTraces()).find((row) => row.id === fact.id)?.content).toBe(
				'Sync compound fact (edited)'
			);

			await sync.replicas[1].client.connect();
			await expect.poll(sync.open, { timeout: 10000 }).toBe(true);
			await sync.acked(1);
			await expect
				.poll(
					async () =>
						(
							(await sync.raw(0, 'intentionAssessments', source.id))?.values as {
								outcome?: { operationId?: string };
							}
						)?.outcome?.operationId,
					{ timeout: 10000 }
				)
				.toBe(correction.outcomeRevision);
			await expect
				.poll(() => sync.has(0, 'intentionAssessments', delayed.id), { timeout: 10000 })
				.toBe(true);
			own.add(delayed.id);
			await sync.acked(0);

			for (const [index, repo] of [first, second].entries()) {
				expect(
					(await repo.listIntentionAssessments()).find((row) => row.id === source.id)
				).toMatchObject({
					isDeleted: false,
					outcome: 'completed',
					open: false,
					outcomeRevision: correction.outcomeRevision,
					firstAssessedAt: source.firstAssessedAt
				});
				const corrected = await evaluate(repo, assessed.id);
				expect(corrected.outcome).toEqual({ value: 'completed', sourceId: source.id });
				expect(corrected.open).toEqual({ value: false, sourceId: source.id });
				const late = await evaluate(repo, unassessed.id);
				expect(late.outcome).toEqual({ value: 'completed', sourceId: delayed.id });
				expect(late.open).toEqual({ value: false, sourceId: delayed.id });
				expect((await sync.raw(index, 'traces', fact.id))?.content).toBe(
					'Sync compound fact (edited)'
				);
				expect((await journal(index)).filter((entry) => entry.endsWith(':undo'))).toEqual([]);
			}
			expect(sync.errors).toEqual([]);
		} finally {
			await sync.dispose();
		}
	},
	60000
);
