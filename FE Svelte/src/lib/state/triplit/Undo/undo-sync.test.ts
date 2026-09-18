import { expect, it } from 'vitest';
import { canonical, openSyncFixture, SYNC_URL, type SyncFixture } from '../sync.fixture';
import { dayTime, evaluate, plainFields } from './undo.fixture';

const collections = ['traces', 'intersections', 'intentionAssessments', 'logs'] as const;

it.runIf(SYNC_URL)(
	'converges lifecycle, revisions, journal causes and derived results of inverses across two replicas',
	async () => {
		const sync: SyncFixture = await openSyncFixture(collections);
		const [first, second] = sync.replicas.map((replica) => replica.repository);
		const journal = async (index: number, operationId: string) =>
			(
				(await sync.replicas[index].client.fetch(sync.replicas[index].client.query('logs'), {
					policy: 'local-only'
				})) as { operationId: string; entityType: string; action: string; cause: string }[]
			)
				.filter((log) => log.operationId === operationId)
				.map((log) => `${log.entityType}:${log.action}:${log.cause}`)
				.toSorted();
		const journalOn = (index: number, operationId: string, expected: string[]) =>
			expect.poll(() => journal(index, operationId), { timeout: 10000 }).toEqual(expected);
		try {
			const intention = await first.saveTraceRecord({
				fields: plainFields('Sync intention', {
					relation: 'intend',
					aboutTime: dayTime('2100-01-01')
				})
			});
			const fact = await first.saveTraceRecord({
				fields: plainFields('Sync fact', {
					description: 'first',
					aboutTime: dayTime('2026-09-11')
				}),
				links: {
					add: [
						{
							kind: 'evidence_for',
							intentionId: intention.trace.id,
							assessment: { outcome: 'completed', open: false }
						}
					]
				}
			});
			const link = fact.links[0];
			const source = fact.assessments[0];
			await sync.acked(0);
			await journalOn(1, fact.operation.id, [
				'intentionAssessment:created:normal',
				'intersection:linked:normal',
				'trace:created:normal'
			]);

			// Link withdrawal and its inverse: same activation, same source, journal cause on both.
			await first.setIntersectionDeleted(link.id, true);
			await sync.acked(0);
			const withdrawal = (await first.listLogs(link.id))[0].operationId;
			await journalOn(1, withdrawal, ['intersection:deleted:normal']);
			expect((await evaluate(second, intention.trace.id)).outcome.sourceId).toBeNull();
			const undone = await first.undoOperation(withdrawal);
			await sync.acked(0);
			await journalOn(1, undone.operation.id, ['intersection:restored:undo']);
			await expect
				.poll(async () => (await sync.raw(1, 'intersections', link.id))?.lifecycleId, {
					timeout: 10000
				})
				.toBe(undone.operation.id);
			for (const repo of [first, second]) {
				const row = (await repo.listIntersections()).find((item) => item.id === link.id);
				expect(row).toMatchObject({ isDeleted: false, activationId: link.activationId });
				const result = await evaluate(repo, intention.trace.id);
				expect(result.outcome).toEqual({ value: 'completed', sourceId: source.id });
				expect(result.open).toEqual({ value: false, sourceId: source.id });
			}

			// Retarget and its inverse converge with B's independent result untouched.
			const other = await first.saveTraceRecord({
				fields: plainFields('Sync other intention', {
					relation: 'intend',
					aboutTime: dayTime('2100-01-02')
				})
			});
			const moved = await first.correctEvidenceTarget(link.id, other.trace.id);
			const retarget = (await first.listLogs(moved.link.id))[0].operationId;
			await sync.acked(0);
			await expect.poll(() => sync.has(1, 'traces', other.trace.id), { timeout: 10000 }).toBe(true);
			const closure = await second.createDirectAssessment(other.trace.id, { open: false });
			await sync.acked(1);
			await journalOn(1, retarget, [
				'intentionAssessment:updated:normal',
				'intersection:deleted:normal',
				'intersection:linked:normal'
			]);
			await expect
				.poll(() => sync.has(0, 'intentionAssessments', closure.id), { timeout: 10000 })
				.toBe(true);
			const returned = await first.undoOperation(retarget);
			await sync.acked(0);
			await journalOn(1, returned.operation.id, [
				'intentionAssessment:updated:undo',
				'intersection:deleted:undo',
				'intersection:restored:undo'
			]);
			await expect
				.poll(async () => (await sync.raw(1, 'intentionAssessments', source.id))?.lifecycleId, {
					timeout: 10000
				})
				.toBe(returned.operation.id);
			for (const repo of [first, second]) {
				const state = (await repo.listIntentionAssessments()).find((row) => row.id === source.id);
				expect(state).toMatchObject({
					intentionId: intention.trace.id,
					evidenceId: link.id,
					activationId: link.activationId,
					placementRevision: returned.operation.id,
					firstAssessedAt: source.firstAssessedAt
				});
				expect((await evaluate(repo, intention.trace.id)).outcome.sourceId).toBe(source.id);
				const otherResult = await evaluate(repo, other.trace.id);
				expect(otherResult.open).toEqual({ value: false, sourceId: closure.id });
				expect(otherResult.outcome.sourceId).toBeNull();
			}

			// Field inverse against a remote independent change, then against a remote same-field change.
			const edit = await first.saveTraceRecord({
				id: fact.trace.id,
				fields: {
					title: 'Sync fact (edited)',
					aboutTime: { basis: 'unknown' },
					aboutKind: 'instant'
				}
			});
			await sync.acked(0);
			await journalOn(1, edit.operation.id, ['trace:updated:normal']);
			const remote = await second.saveTraceRecord({
				id: fact.trace.id,
				fields: { description: 'second' }
			});
			await sync.acked(1);
			await journalOn(0, remote.operation.id, ['trace:updated:normal']);
			// Per-field stamps merge key by key across replicas: both writers' stamps are present.
			await expect
				.poll(async () => (await sync.raw(0, 'traces', fact.trace.id))?.revisions, {
					timeout: 10000
				})
				.toMatchObject({
					content: edit.operation.id,
					aboutTime: edit.operation.id,
					description: remote.operation.id
				});
			const fieldsUndone = await first.undoOperation(edit.operation.id);
			await sync.acked(0);
			await journalOn(1, fieldsUndone.operation.id, ['trace:updated:undo']);
			await expect
				.poll(async () => (await sync.raw(1, 'traces', fact.trace.id))?.content, { timeout: 10000 })
				.toBe('Sync fact');
			for (const repo of [first, second]) {
				const row = (await repo.listTraces()).find((item) => item.id === fact.trace.id)!;
				expect(row).toMatchObject({
					content: 'Sync fact',
					description: 'second',
					aboutKind: 'instant',
					aboutTime: dayTime('2026-09-11')
				});
			}
			expect(canonical(await sync.raw(0, 'traces', fact.trace.id))).toBe(
				canonical(await sync.raw(1, 'traces', fact.trace.id))
			);

			const local = await first.saveTraceRecord({
				id: fact.trace.id,
				fields: { aboutTime: dayTime('2026-09-12') }
			});
			await sync.acked(0);
			await journalOn(1, local.operation.id, ['trace:updated:normal']);
			const remoteSame = await second.saveTraceRecord({
				id: fact.trace.id,
				fields: { aboutTime: dayTime('2026-09-13') }
			});
			await sync.acked(1);
			await journalOn(0, remoteSame.operation.id, ['trace:updated:normal']);
			await expect(first.undoOperation(local.operation.id)).rejects.toMatchObject({
				code: 'undo_stale',
				details: { reason: 'revision', field: 'aboutTime', revision: remoteSame.operation.id }
			});
			for (const repo of [first, second]) {
				expect(
					(await repo.listTraces()).find((item) => item.id === fact.trace.id)?.aboutTime
				).toEqual(dayTime('2026-09-13'));
			}
			expect(sync.errors).toEqual([]);
		} finally {
			await sync.dispose();
		}
	},
	60000
);
