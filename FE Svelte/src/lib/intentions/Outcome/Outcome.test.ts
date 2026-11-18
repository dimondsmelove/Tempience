import { afterEach, describe, expect, it } from 'vitest';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import {
	dayTime,
	openRecordFixture,
	plainFields,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import { completeIntention } from '../CompleteIntention/CompleteIntention';
import { recordResult, setOpen, setOutcome } from './Outcome';

const now = Date.parse('2026-09-13T08:47:32.123Z');
const options = { now, zone: 'Europe/Belgrade' };
let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});

const open = async () => {
	fixture = openRecordFixture();
	const repo = fixture.repository;
	const scope = await repo.createScope({ name: 'Дом' });
	const intention = await repo.saveTraceRecord({
		fields: plainFields('Получить права', { relation: 'intend', aboutTime: dayTime('2026-09-20') }),
		memberships: { add: [scope.id] }
	});
	return { repo, scope, id: intention.trace.id };
};

const stateOf = async (repo: RecordFixture['repository'], id: string) => {
	const snapshot = await buildRepositoryExplorerSnapshot(repo, 'intentions');
	const trace = snapshot.traces.find((item) => item.id === id)!;
	return { outcome: trace.intentOutcome ?? null, open: trace.intentOpen !== false };
};

describe('recordResult', () => {
	it('«partial» records a fact in the task scopes and leaves the task open', async () => {
		const { repo, scope, id } = await open();
		const result = await recordResult(repo, id, '  Собрал копии  ', 'partial', options);
		expect(result.ok).toBe(true);
		if (!result.ok || !result.factId) throw new Error('not recorded');
		expect(await repo.getTrace(result.factId)).toMatchObject({
			content: 'Собрал копии',
			relation: 'actual',
			capturedAt: '2026-09-13T08:47:32.123Z'
		});
		const links = (await repo.listIntersections()).filter((link) => link.fromId === result.factId);
		expect(links.map(({ kind, toId }) => [kind, toId]).toSorted()).toEqual(
			[
				['belongs_to', scope.id],
				['evidence_for', id]
			].toSorted()
		);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
	});

	it('«alternative» records a fact and closes the task', async () => {
		const { repo, id } = await open();
		const result = await recordResult(repo, id, 'Заселил сожителя', 'alternative', options);
		expect(result.ok).toBe(true);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'alternative', open: false });
	});

	it('refuses an empty text, an unknown task and a later statement without writing', async () => {
		const { repo, id } = await open();
		const logs = (await repo.listLogs()).length;
		expect(await recordResult(repo, id, '   ', 'partial', options)).toEqual({
			ok: false,
			reason: 'text_required'
		});
		expect(await recordResult(repo, 'missing', 'x', 'partial', options)).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect((await repo.listLogs()).length).toBe(logs);
		await completeIntention(repo, id, { ...options, now: now + 86_400_000 });
		expect(await recordResult(repo, id, 'x', 'partial', options)).toEqual({
			ok: false,
			reason: 'later_result_exists'
		});
	});
});

describe('setOutcome', () => {
	it('presets close the task: «not_completed» with that outcome, «none» without any', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		const cancelled = await setOutcome(repo, id, 'none', { close: true });
		expect(cancelled.ok).toBe(true);
		expect(await stateOf(repo, id)).toEqual({ outcome: null, open: false });
		await setOutcome(repo, id, 'not_completed', { close: true });
		expect(await stateOf(repo, id)).toEqual({ outcome: 'not_completed', open: false });
	});

	it('without `close` only the outcome changes, and an Undo takes it back', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		const result = await setOutcome(repo, id, 'none');
		if (!result.ok) throw new Error(result.reason);
		expect(await stateOf(repo, id)).toEqual({ outcome: null, open: true });
		await repo.undoOperation(result.operationId);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
	});
});

describe('setOpen', () => {
	it('closes and opens without touching a standing outcome', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		await setOpen(repo, id, false, options);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: false });
		await setOpen(repo, id, true, options);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
		expect(await setOpen(repo, id, true, options)).toEqual({ ok: false, reason: 'unchanged' });
	});

	it('reopens none, partial, and alternative outcomes without removing active records', async () => {
		const { repo, scope } = await open();
		const createTask = async (title: string) =>
			(
				await repo.saveTraceRecord({
					fields: plainFields(title, {
						relation: 'intend',
						aboutTime: dayTime('2026-09-20')
					}),
					memberships: { add: [scope.id] }
				})
			).trace.id;
		const noneId = await createTask('Без результата');
		await setOutcome(repo, noneId, 'none', { close: true });
		const partialId = await createTask('Частично');
		await recordResult(repo, partialId, 'Часть', 'partial', options);
		await setOpen(repo, partialId, false, options);
		const alternativeId = await createTask('Альтернатива');
		await recordResult(repo, alternativeId, 'Иной путь', 'alternative', options);
		const before = await repo.listTraces();

		await setOpen(repo, noneId, true, { now: now + 1000 });
		await setOpen(repo, partialId, true, { now: now + 2000 });
		await setOpen(repo, alternativeId, true, { now: now + 3000 });

		expect(await repo.listTraces()).toEqual(before);
		expect(await stateOf(repo, noneId)).toEqual({ outcome: null, open: true });
		expect(await stateOf(repo, partialId)).toEqual({ outcome: 'partial', open: true });
		expect(await stateOf(repo, alternativeId)).toEqual({ outcome: 'alternative', open: true });
	});

	it('opening a completed task removes the completion fact in the same undoable operation', async () => {
		const { repo, id } = await open();
		const completed = await completeIntention(repo, id, options);
		if (!completed.ok) throw new Error(completed.reason);
		const secondCompletion = await repo.saveTraceRecord({
			fields: plainFields('Ещё один факт завершения', {
				relation: 'actual',
				aboutTime: dayTime('2026-09-13')
			}),
			links: {
				add: [
					{
						kind: 'evidence_for',
						intentionId: id,
						assessment: { outcome: 'completed', open: false }
					}
				]
			}
		});
		await repo.saveTraceRecord({
			fields: plainFields('Якорный факт', {
				aboutTime: {
					basis: 'relative',
					precision: 'day',
					anchorTraceId: completed.factId,
					relation: 'after'
				}
			})
		});
		const activeTraceIdsBeforeReopen = (await repo.listTraces()).map((trace) => trace.id);
		const existingLogIds = new Set((await repo.listLogs()).map((log) => log.id));
		const reopened = await setOpen(repo, id, true, { now: now + 1000 });
		if (!reopened.ok) throw new Error(reopened.reason);
		const commandLogs = (await repo.listLogs()).filter((log) => !existingLogIds.has(log.id));
		expect(commandLogs.length).toBeGreaterThan(0);
		expect(new Set(commandLogs.map((log) => log.operationId))).toEqual(
			new Set([reopened.operationId])
		);
		expect(await stateOf(repo, id)).toEqual({ outcome: null, open: true });
		const allTraces = await repo.listTraces(true);
		expect(allTraces.find((trace) => trace.id === completed.factId)?.isDeleted).toBe(true);
		expect(allTraces.find((trace) => trace.id === secondCompletion.trace.id)?.isDeleted).toBe(true);
		const links = await repo.listIntersections();
		const assessments = await repo.listIntentionAssessments(true);
		expect(links.some((link) => link.fromId === completed.factId)).toBe(true);
		expect(assessments.some((assessment) => assessment.factId === completed.factId)).toBe(true);
		await repo.undoOperation(reopened.operationId);
		const restoredTraces = await repo.listTraces(true);
		expect(restoredTraces.find((trace) => trace.id === completed.factId)?.isDeleted).toBe(false);
		expect(restoredTraces.find((trace) => trace.id === secondCompletion.trace.id)?.isDeleted).toBe(
			false
		);
		expect((await repo.listTraces()).map((trace) => trace.id)).toEqual(activeTraceIdsBeforeReopen);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'completed', open: false });
	});

	it('reopening a completed repeat leaves its copied intention active', async () => {
		const { repo, id } = await open();
		const repeated = await repo.repeatIntention(id, 'completed', '', '2026-09-14', options);
		if (!repeated.ok) throw new Error(repeated.reason);
		const reopened = await setOpen(repo, id, true, { now: now + 1000 });
		expect(reopened.ok).toBe(true);
		expect((await repo.listTraces()).some((trace) => trace.id === repeated.copyId)).toBe(true);
		expect(await stateOf(repo, repeated.copyId)).toEqual({ outcome: null, open: true });
	});

	it('refuses to undo after a removed completion fact is edited', async () => {
		const { repo, id } = await open();
		const completed = await completeIntention(repo, id, options);
		if (!completed.ok) throw new Error(completed.reason);
		const reopened = await setOpen(repo, id, true, { now: now + 1000 });
		if (!reopened.ok) throw new Error(reopened.reason);
		await repo.editTrace(completed.factId, { content: 'Изменённый факт' });
		const before = {
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		};
		await expect(repo.undoOperation(reopened.operationId)).rejects.toMatchObject({
			code: 'undo_stale'
		});
		expect({
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		}).toEqual(before);
	});

	it('refuses to undo after a later trace starts referencing a removed completion fact', async () => {
		const { repo, id } = await open();
		const completed = await completeIntention(repo, id, options);
		if (!completed.ok) throw new Error(completed.reason);
		const reopened = await setOpen(repo, id, true, { now: now + 1000 });
		if (!reopened.ok) throw new Error(reopened.reason);
		await repo.saveTraceRecord({
			fields: plainFields('Ссылка на факт', {
				aboutKind: 'trace_ref',
				aboutTime: null,
				aboutTraceId: completed.factId
			})
		});
		const before = {
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		};
		await expect(repo.undoOperation(reopened.operationId)).rejects.toMatchObject({
			code: 'undo_stale'
		});
		expect({
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		}).toEqual(before);
	});

	it('refuses to undo after a retained completion assessment is corrected', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		const completed = await completeIntention(repo, id, { ...options, now: now + 1000 });
		if (!completed.ok) throw new Error(completed.reason);
		const reopened = await setOpen(repo, id, true, { now: now + 2000 });
		if (!reopened.ok) throw new Error(reopened.reason);
		const assessment = (await repo.listIntentionAssessments(true)).find(
			(item) => item.factId === completed.factId
		);
		if (!assessment) throw new Error('Completion assessment missing');
		await repo.editIntentionAssessment(assessment.id, { outcome: 'alternative' });
		const before = {
			traces: await repo.listTraces(true),
			intersections: await repo.listIntersections(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		};
		await expect(repo.undoOperation(reopened.operationId)).rejects.toMatchObject({
			code: 'undo_stale'
		});
		expect({
			traces: await repo.listTraces(true),
			intersections: await repo.listIntersections(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		}).toEqual(before);
	});

	it('refuses to undo after a retained completion link is withdrawn', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		const completed = await completeIntention(repo, id, { ...options, now: now + 1000 });
		if (!completed.ok) throw new Error(completed.reason);
		const reopened = await setOpen(repo, id, true, { now: now + 2000 });
		if (!reopened.ok) throw new Error(reopened.reason);
		const link = (await repo.listIntersections(true)).find(
			(item) => item.fromId === completed.factId && item.kind === 'evidence_for'
		);
		if (!link) throw new Error('Completion evidence link missing');
		await repo.setIntersectionDeleted(link.id, true);
		const before = {
			traces: await repo.listTraces(true),
			intersections: await repo.listIntersections(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		};
		await expect(repo.undoOperation(reopened.operationId)).rejects.toMatchObject({
			code: 'undo_stale'
		});
		expect({
			traces: await repo.listTraces(true),
			intersections: await repo.listIntersections(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		}).toEqual(before);
	});

	it('fails closed when the completion removal undo guard is malformed', async () => {
		const { repo, id } = await open();
		const completed = await completeIntention(repo, id, options);
		if (!completed.ok) throw new Error(completed.reason);
		const reopened = await setOpen(repo, id, true, { now: now + 1000 });
		if (!reopened.ok) throw new Error(reopened.reason);
		const deletion = (await repo.listLogs()).find(
			(log) =>
				log.operationId === reopened.operationId &&
				log.entityId === completed.factId &&
				log.action === 'deleted'
		);
		if (!deletion) throw new Error('Completion deletion log missing');
		await fixture.client.update('logs', deletion.id, {
			patchJson: JSON.stringify({
				...deletion.patch,
				undoGuard: { before: null, after: 'malformed' }
			})
		} as never);
		const before = {
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		};
		await expect(repo.undoOperation(reopened.operationId)).rejects.toMatchObject({
			code: 'undo_unsupported'
		});
		expect({
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		}).toEqual(before);
	});

	it('restores the outcome that stood before the completion', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		await completeIntention(repo, id, { ...options, now: now + 1000 });
		expect(await stateOf(repo, id)).toEqual({ outcome: 'completed', open: false });
		const reopened = await setOpen(repo, id, true, { now: now + 2000 });
		expect(reopened.ok).toBe(true);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
	});

	it('refuses a stale undo as a whole and refuses a later completion without writes', async () => {
		const { repo, id } = await open();
		const completed = await completeIntention(repo, id, options);
		if (!completed.ok) throw new Error(completed.reason);
		const reopened = await setOpen(repo, id, true, { now: now + 1000 });
		if (!reopened.ok) throw new Error(reopened.reason);
		await repo.setTraceDeleted(completed.factId, false);
		const staleBefore = {
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		};
		await expect(repo.undoOperation(reopened.operationId)).rejects.toMatchObject({
			code: 'undo_stale'
		});
		expect({
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		}).toEqual(staleBefore);

		const laterTask = await repo.saveTraceRecord({
			fields: plainFields('Задача с поздним фактом', { relation: 'intend' })
		});
		await repo.saveTraceRecord({
			fields: plainFields('Позднее завершение', {
				relation: 'actual',
				aboutTime: dayTime('2026-09-14')
			}),
			links: {
				add: [
					{
						kind: 'evidence_for',
						intentionId: laterTask.trace.id,
						assessment: { outcome: 'completed', open: false }
					}
				]
			}
		});
		await repo.createDirectAssessment(laterTask.trace.id, { open: false });
		const beforeRefusal = {
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		};
		expect(await setOpen(repo, laterTask.trace.id, true, { now })).toEqual({
			ok: false,
			reason: 'later_result_exists'
		});
		expect({
			traces: await repo.listTraces(true),
			assessments: await repo.listIntentionAssessments(true),
			logs: await repo.listLogs()
		}).toEqual(beforeRefusal);
	});
});
