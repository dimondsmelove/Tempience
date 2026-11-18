import { afterEach, describe, expect, it } from 'vitest';
import {
	dayTime,
	openRecordFixture,
	outcome as repositoryOutcome,
	plainFields,
	snapshotOf,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import type { TempienceRepository } from '$lib/state/triplit/repository';

describe('deleteIntention repository command', () => {
	let fixture: RecordFixture;
	let repo: TempienceRepository;

	afterEach(async () => fixture?.dispose());

	const open = () => {
		fixture = openRecordFixture();
		repo = fixture.repository;
	};

	const makeIntention = (title: string) =>
		repo.saveTraceRecord({
			fields: plainFields(title, {
				relation: 'intend',
				aboutKind: 'instant',
				aboutTime: dayTime('2026-09-10')
			})
		});

	it('returns typed refusals without writing for missing, non-intention, and deleted records', async () => {
		open();
		const factRecord = await repo.saveTraceRecord({ fields: plainFields('Факт') });
		const deleted = await makeIntention('Удалённое намерение');
		await repo.setTraceDeleted(deleted.trace.id, true);
		const before = await snapshotOf(repo);

		expect(await repo.deleteIntention('missing', 'all')).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(await repo.deleteIntention(factRecord.trace.id, 'all')).toEqual({
			ok: false,
			reason: 'not_intention'
		});
		expect(await repo.deleteIntention(deleted.trace.id, 'all')).toEqual({
			ok: false,
			reason: 'already_deleted'
		});
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('refuses a changed plan without records or logs being written', async () => {
		open();
		const root = await makeIntention('Корень');
		const child = await repo.saveTraceRecord({
			fields: plainFields('Ребёнок', {
				relation: 'intend',
				aboutKind: 'trace_ref',
				aboutTime: null,
				aboutTraceId: root.trace.id
			})
		});
		await repo.createIntersection({ fromId: child.trace.id, toId: root.trace.id, kind: 'part_of' });
		const before = await snapshotOf(repo);

		expect(
			await repo.deleteIntention(root.trace.id, 'all', { expectedDeleteIds: [root.trace.id] })
		).toEqual({ ok: false, reason: 'plan_changed' });
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('deletes the planned tree in one operation, preserves unrelated data, and fully restores on Undo', async () => {
		open();
		const root = await makeIntention('Корень');
		const child = await repo.saveTraceRecord({
			fields: plainFields('Ребёнок', {
				relation: 'intend',
				aboutKind: 'trace_ref',
				aboutTime: null,
				aboutTraceId: root.trace.id
			})
		});
		const neighbor = await makeIntention('Сосед');
		const factRecord = await repo.saveTraceRecord({
			fields: plainFields('Факт-свидетельство'),
			links: {
				add: [
					{
						kind: 'evidence_for',
						intentionId: root.trace.id,
						assessment: { outcome: 'partial', open: false }
					}
				]
			}
		});
		await repo.createDirectAssessment(root.trace.id, { outcome: 'partial', open: false });
		await repo.createIntersection({ fromId: child.trace.id, toId: root.trace.id, kind: 'part_of' });
		const before = await snapshotOf(repo);

		const result = await repo.deleteIntention(root.trace.id, 'all', {
			expectedDeleteIds: [root.trace.id, child.trace.id]
		});
		expect(result).toMatchObject({ ok: true, deletedIds: [root.trace.id, child.trace.id] });
		if (!result.ok) return;
		const afterDelete = await snapshotOf(repo);
		expect(afterDelete.traces.filter((trace) => trace.isDeleted).map((trace) => trace.id)).toEqual(
			expect.arrayContaining([root.trace.id, child.trace.id])
		);
		expect(afterDelete.traces.find((trace) => trace.id === neighbor.trace.id)?.isDeleted).toBe(
			false
		);
		expect(afterDelete.traces.find((trace) => trace.id === factRecord.trace.id)?.isDeleted).toBe(
			false
		);
		for (const id of [neighbor.trace.id, factRecord.trace.id]) {
			expect(afterDelete.traces.find((trace) => trace.id === id)).toEqual(
				before.traces.find((trace) => trace.id === id)
			);
		}
		expect(afterDelete.intersections).toEqual(before.intersections);
		expect(afterDelete.assessments).toEqual(before.assessments);
		const operationLogs = afterDelete.logs.filter((log) => log.operationId === result.operationId);
		expect(operationLogs).toHaveLength(2);
		for (const log of operationLogs) {
			expect(log.patch.undoGuard?.after).toMatchObject({
				revisions: { isDeleted: result.operationId },
				dependencies: {
					traces: expect.any(Array),
					intersections: expect.any(Array),
					assessments: expect.any(Array)
				}
			});
		}
		expect(
			operationLogs.every(
				(log) => log.entityType === 'trace' && log.action === 'deleted' && log.actor === 'user'
			)
		).toBe(true);

		await repo.undoOperation(result.operationId, 'user');
		const afterUndo = await snapshotOf(repo);
		const intentionState = (traces: typeof before.traces) =>
			traces.map(({ id, content, relation, aboutKind, aboutTime, aboutTraceId, isDeleted }) => ({
				id,
				content,
				relation,
				aboutKind,
				aboutTime,
				aboutTraceId,
				isDeleted
			}));
		expect(intentionState(afterUndo.traces)).toEqual(intentionState(before.traces));
		expect(afterUndo.intersections).toEqual(before.intersections);
		expect(afterUndo.assessments).toEqual(before.assessments);
	});

	it('leaves children and shared descendants active when deleting only the selected intention', async () => {
		open();
		const root = await makeIntention('Корень');
		const child = await makeIntention('Общий ребёнок');
		const otherParent = await makeIntention('Другой родитель');
		await repo.createIntersection({ fromId: child.trace.id, toId: root.trace.id, kind: 'part_of' });
		await repo.createIntersection({
			fromId: child.trace.id,
			toId: otherParent.trace.id,
			kind: 'part_of'
		});

		const result = await repo.deleteIntention(root.trace.id, 'only');
		expect(result).toMatchObject({ ok: true, deletedIds: [root.trace.id] });
		expect((await repo.listTraces()).map((trace) => trace.id)).toEqual(
			expect.arrayContaining([child.trace.id, otherParent.trace.id])
		);
	});

	it('atomically refuses Undo after a deleted intention is separately restored', async () => {
		open();
		const root = await makeIntention('Корень');
		const child = await makeIntention('Ребёнок');
		await repo.createIntersection({ fromId: child.trace.id, toId: root.trace.id, kind: 'part_of' });
		const result = await repo.deleteIntention(root.trace.id, 'all');
		if (!result.ok) throw new Error(result.reason);
		await repo.setTraceDeleted(child.trace.id, false);
		const beforeRefusal = await snapshotOf(repo);

		expect(await repositoryOutcome(repo.undoOperation(result.operationId, 'user'))).toBe(
			'undo_stale'
		);
		expect(await snapshotOf(repo)).toEqual(beforeRefusal);
	});

	it('atomically refuses Undo after a new intersection changes a deleted intention dependency', async () => {
		open();
		const root = await makeIntention('Корень');
		const other = await makeIntention('Другой узел');
		const child = await makeIntention('Ребёнок');
		await repo.createIntersection({ fromId: child.trace.id, toId: root.trace.id, kind: 'part_of' });
		const result = await repo.deleteIntention(root.trace.id, 'all');
		expect(result.ok && result.deletedIds).toHaveLength(2);
		if (!result.ok) throw new Error(result.reason);
		await repo.createIntersection({ fromId: root.trace.id, toId: other.trace.id, kind: 'part_of' });
		const beforeRefusal = await snapshotOf(repo);

		expect(await repositoryOutcome(repo.undoOperation(result.operationId, 'user'))).toBe(
			'undo_stale'
		);
		expect(await snapshotOf(repo)).toEqual(beforeRefusal);
	});
});
