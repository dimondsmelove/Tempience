import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import {
	dayTime,
	openRecordFixture,
	plainFields,
	snapshotOf,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import { completeIntention, revertCompletion } from './CompleteIntention';

const now = Date.parse('2026-09-13T08:47:32.123Z');
const options = { now, zone: 'Europe/Belgrade' };
let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});

describe('completeIntention', () => {
	it('creates a fact, memberships and closing assessment in one operation', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const a = await repo.createScope({ name: 'A' });
		const b = await repo.createScope({ name: 'B' });
		const intention = await repo.saveTraceRecord({
			fields: plainFields('Прогулка', {
				relation: 'intend',
				description: 'Описание',
				aboutTime: dayTime('2026-09-20')
			}),
			memberships: { add: [a.id, b.id] }
		});
		const oldLogs = await repo.listLogs();
		const save = vi.spyOn(repo, 'saveTraceRecord');
		const result = await completeIntention(repo, intention.trace.id, options);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.reason);
		expect(save).toHaveBeenCalledTimes(1);
		expect(await repo.getTrace(result.factId)).toMatchObject({
			content: 'Прогулка',
			description: null,
			relation: 'actual',
			capturedAt: '2026-09-13T08:47:32.123Z',
			timezone: options.zone,
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: '2026-09-13T08:47:32.123Z',
				end: null
			}
		});
		const links = (await repo.listIntersections()).filter((link) => link.fromId === result.factId);
		expect(links.map(({ kind, toId }) => [kind, toId]).toSorted()).toEqual(
			[
				['belongs_to', a.id],
				['belongs_to', b.id],
				['evidence_for', intention.trace.id]
			].toSorted()
		);
		const assessment = (await repo.listIntentionAssessments()).find(
			(item) => item.factId === result.factId
		);
		expect(assessment).toMatchObject({
			intentionId: intention.trace.id,
			outcome: 'completed',
			open: false,
			evidenceId: links.find((link) => link.kind === 'evidence_for')?.id
		});
		const derived = (await buildRepositoryExplorerSnapshot(repo, 'test')).traces.find(
			(item) => item.id === intention.trace.id
		);
		expect(derived).toMatchObject({ intentOpen: false, intentOutcome: 'completed' });
		const newLogs = (await repo.listLogs()).filter(
			(log) => !oldLogs.some((old) => old.id === log.id)
		);
		expect(new Set(newLogs.map((log) => log.operationId))).toEqual(new Set([result.operationId]));
		expect(newLogs.map((log) => `${log.entityType}:${log.action}`).toSorted()).toEqual(
			[
				'intersection:linked',
				'intersection:linked',
				'intersection:linked',
				'intentionAssessment:created',
				'trace:created'
			].toSorted()
		);
	});

	it('completes a past intention', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const intention = await repo.saveTraceRecord({
			fields: plainFields('Прошлое', { relation: 'intend', aboutTime: dayTime('2001-01-01') })
		});
		expect((await completeIntention(repo, intention.trace.id, options)).ok).toBe(true);
		expect(
			(await buildRepositoryExplorerSnapshot(repo, 'test')).traces.find(
				(trace) => trace.id === intention.trace.id
			)?.intentOpen
		).toBe(false);
	});

	it('refuses a later eligible evidence source without writing', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const intention = await repo.saveTraceRecord({
			fields: plainFields('Намерение', { relation: 'intend' })
		});
		await repo.saveTraceRecord({
			fields: plainFields('Позднее событие', { aboutTime: dayTime('2027-01-01') }),
			links: {
				add: [
					{
						kind: 'evidence_for',
						intentionId: intention.trace.id,
						assessment: { outcome: 'partial', open: true }
					}
				]
			}
		});
		const before = await snapshotOf(repo);
		expect(await completeIntention(repo, intention.trace.id, options)).toEqual({
			ok: false,
			reason: 'later_result_exists'
		});
		expect(await snapshotOf(repo)).toEqual(before);
		expect(
			(await buildRepositoryExplorerSnapshot(repo, 'test')).traces.find(
				(trace) => trace.id === intention.trace.id
			)
		).toMatchObject({ intentOpen: true, intentOutcome: 'partial' });
	});

	it('ignores an ineligible later evidence source', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const intention = await repo.saveTraceRecord({
			fields: plainFields('Намерение', { relation: 'intend' })
		});
		const later = await repo.saveTraceRecord({
			fields: plainFields('Позднее событие', { aboutTime: dayTime('2027-01-01') }),
			links: {
				add: [{ kind: 'evidence_for', intentionId: intention.trace.id, assessment: { open: true } }]
			}
		});
		await repo.setTraceDeleted(later.trace.id, true);
		expect((await completeIntention(repo, intention.trace.id, options)).ok).toBe(true);
	});

	it('reverts a completion, preserves its sources, supports Undo and allows completion again', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const intention = await repo.saveTraceRecord({
			fields: plainFields('Намерение', { relation: 'intend' })
		});
		const result = await completeIntention(repo, intention.trace.id, options);
		if (!result.ok) throw new Error(result.reason);
		const before = await snapshotOf(repo);
		expect(await revertCompletion(repo, result.factId)).toEqual({ ok: true });
		const after = await snapshotOf(repo);
		expect(after.intersections).toEqual(before.intersections);
		expect(after.assessments).toEqual(before.assessments);
		expect(after.logs.filter((log) => before.logs.some((old) => old.id === log.id))).toEqual(
			before.logs
		);
		const snapshot = await buildRepositoryExplorerSnapshot(repo, 'test');
		expect(snapshot.traces.find((trace) => trace.id === result.factId)).toBeUndefined();
		expect(snapshot.traces.find((trace) => trace.id === intention.trace.id)?.intentOpen).toBe(true);
		const deletion = after.logs.find(
			(log) => log.entityId === result.factId && log.action === 'deleted'
		);
		if (!deletion) throw new Error('Deletion log missing');
		const undone = await repo.undoOperation(deletion.operationId);
		expect(undone.plan.steps).toEqual([
			{ kind: 'trace.lifecycle', traceId: result.factId, deleted: true }
		]);
		expect(
			(await buildRepositoryExplorerSnapshot(repo, 'test')).traces.find(
				(trace) => trace.id === intention.trace.id
			)?.intentOpen
		).toBe(false);
		expect(await revertCompletion(repo, result.factId)).toEqual({ ok: true });
		expect((await completeIntention(repo, intention.trace.id, options)).ok).toBe(true);
	});

	it('rejects missing, deleted, non-fact and unlinked records without writing', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const intention = await repo.saveTraceRecord({
			fields: plainFields('Намерение', { relation: 'intend' })
		});
		const fact = await repo.saveTraceRecord({ fields: plainFields('Факт') });
		const deleted = await repo.saveTraceRecord({ fields: plainFields('Удалён') });
		await repo.setTraceDeleted(deleted.trace.id, true);
		const before = await snapshotOf(repo);
		for (const [id, reason] of [
			['missing', 'not_found'],
			[deleted.trace.id, 'not_found'],
			[intention.trace.id, 'not_a_completion'],
			[fact.trace.id, 'not_a_completion']
		] as const) {
			expect(await revertCompletion(repo, id)).toEqual({ ok: false, reason });
			expect(await snapshotOf(repo)).toEqual(before);
		}
	});

	it('completes a task that is closed without being completed', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const task = await repo.saveTraceRecord({
			fields: plainFields('Закрыто', { relation: 'intend' })
		});
		await repo.createDirectAssessment(task.trace.id, { outcome: 'not_completed', open: false });
		// Direct statements are ordered by the real action time, so the fact must come after it.
		const result = await completeIntention(repo, task.trace.id, {
			...options,
			now: Date.now() + 1000
		});
		expect(result.ok).toBe(true);
		const trace = (await buildRepositoryExplorerSnapshot(repo, 'intentions')).traces.find(
			(item) => item.id === task.trace.id
		);
		expect([trace?.intentOutcome, trace?.intentOpen]).toEqual(['completed', false]);
	});

	it('refuses missing, non-intention, completed and typed records without writes', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const fact = await repo.saveTraceRecord({ fields: plainFields('Факт') });
		const closed = await repo.saveTraceRecord({
			fields: plainFields('Закрыто', { relation: 'intend' })
		});
		await repo.createDirectAssessment(closed.trace.id, { outcome: 'completed', open: false });
		const { kind, kindV } = await repo.createTraceKind({
			name: 'Тип',
			initialKindV: { dataSchema: { type: 'object', additionalProperties: false, properties: {} } }
		});
		const typed = await repo.saveTraceRecord({
			fields: plainFields(null, {
				relation: 'intend',
				kindId: kind.id,
				kindVId: kindV.id,
				data: {}
			})
		});
		const before = await snapshotOf(repo);
		for (const [id, reason] of [
			['missing', 'not_found'],
			[fact.trace.id, 'not_intention'],
			[closed.trace.id, 'closed'],
			[typed.trace.id, 'typed_unsupported']
		] as const) {
			expect(await completeIntention(repo, id, options)).toEqual({ ok: false, reason });
			expect(await snapshotOf(repo)).toEqual(before);
		}
	});
});
