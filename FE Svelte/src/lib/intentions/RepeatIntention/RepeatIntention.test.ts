import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import {
	dayTime,
	minuteTime,
	openRecordFixture,
	outcome as repositoryOutcome,
	plainDraft,
	plainFields,
	snapshotOf,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import { evaluate } from '$lib/state/triplit/Undo/undo.fixture';
import { repeatDays } from './targets';

const NOW = Date.parse('2026-09-13T08:00:00.000Z');
const ZONE = 'Europe/Belgrade';
const TOMORROW = '2026-09-14';
const NEXT_WEEK = '2026-09-20';

let fixture: RecordFixture;
let repo: TempienceRepository;

afterEach(async () => fixture?.dispose());

const open = () => {
	fixture = openRecordFixture();
	repo = fixture.repository;
};

const intention = (
	title: string,
	aboutTime = dayTime('2026-09-10'),
	statedDuration?: { amount: number; unit: 'minute' | 'day' } | null
) =>
	repo.saveTraceRecord({
		fields: plainFields(title, {
			relation: 'intend',
			aboutKind: statedDuration ? 'interval' : 'instant',
			aboutTime,
			statedDuration: statedDuration ?? null
		})
	});

describe('repeatIntention', () => {
	it.each(['completed', 'partial', 'alternative'] as const)(
		'closes the intention, records %s, and makes one dated open copy with its time and duration',
		async (outcome) => {
			open();
			const scope = await repo.createScope({ name: 'План' });
			const source = await repo.saveTraceRecord({
				fields: plainFields('Задача', {
					description: 'описание',
					relation: 'intend',
					aboutKind: 'interval',
					aboutTime: minuteTime('2026-09-10T10:30:00+02:00'),
					statedDuration: { amount: 45, unit: 'minute' }
				}),
				memberships: { add: [scope.id] }
			});
			const text = outcome === 'completed' ? '' : '  Что получилось  ';
			const beforeLogIds = new Set((await repo.listLogs()).map((log) => log.id));
			const result = await repo.repeatIntention(source.trace.id, outcome, text, TOMORROW, {
				now: NOW,
				zone: ZONE
			});
			expect(result).toMatchObject({ ok: true, copyDay: '2026-09-14' });
			if (!result.ok) return;
			const fact = (await repo.listTraces()).find((trace) => trace.id === result.factId)!;
			const copy = (await repo.listTraces()).find((trace) => trace.id === result.copyId)!;
			expect(fact).toMatchObject({
				content: outcome === 'completed' ? 'Задача' : 'Что получилось',
				relation: 'actual'
			});
			expect(copy).toMatchObject({
				content: 'Задача',
				description: 'описание',
				relation: 'intend',
				aboutKind: 'interval',
				aboutTime: minuteTime('2026-09-14T10:30:00+02:00'),
				statedDuration: { amount: 45, unit: 'minute' }
			});
			expect(
				(await repo.listIntersections()).some(
					(link) => link.kind === 'belongs_to' && link.fromId === copy.id && link.toId === scope.id
				)
			).toBe(true);
			const assessment = (await repo.listIntentionAssessments()).find(
				(row) => row.factId === fact.id
			);
			expect(assessment).toMatchObject({ intentionId: source.trace.id, outcome, open: false });
			expect(await evaluate(repo, source.trace.id)).toMatchObject({ open: { value: false } });
			expect(await evaluate(repo, copy.id)).toMatchObject({ open: { value: true } });
			const logs = (await repo.listLogs()).filter((log) => log.operationId === result.operationId);
			expect(new Set(logs.map((log) => log.operationId))).toEqual(new Set([result.operationId]));
			const newLogs = (await repo.listLogs()).filter((log) => !beforeLogIds.has(log.id));
			expect(newLogs.length).toBeGreaterThan(0);
			expect(new Set(newLogs.map((log) => log.operationId))).toEqual(new Set([result.operationId]));
		}
	);

	it('copies a shared descendant once, retains every root parent, scopes, and only internal tree edges', async () => {
		open();
		const scopeA = await repo.createScope({ name: 'A' });
		const scopeB = await repo.createScope({ name: 'B' });
		const parentA = await intention('Внешний родитель A');
		const parentB = await intention('Внешний родитель B');
		const deletedParent = await intention('Удалённый родитель');
		const root = await repo.saveTraceRecord({
			fields: plainFields('Корень', { relation: 'intend' }),
			memberships: { add: [scopeA.id] },
			links: {
				add: [
					{ kind: 'part_of', wholeId: parentA.trace.id },
					{ kind: 'part_of', wholeId: parentB.trace.id },
					{ kind: 'part_of', wholeId: deletedParent.trace.id }
				]
			}
		});
		await repo.setTraceDeleted(deletedParent.trace.id, true);
		const childA = await repo.saveTraceRecord({
			fields: plainFields('Подзадача A', { relation: 'intend' }),
			memberships: { add: [scopeA.id] },
			links: { add: [{ kind: 'part_of', wholeId: root.trace.id }] }
		});
		const childB = await repo.saveTraceRecord({
			fields: plainFields('Подзадача B', { relation: 'intend' }),
			memberships: { add: [scopeB.id] },
			links: { add: [{ kind: 'part_of', wholeId: root.trace.id }] }
		});
		await repo.saveTraceRecord({
			fields: plainFields('Общая подзадача', { relation: 'intend' }),
			memberships: { add: [scopeA.id, scopeB.id] },
			links: {
				add: [
					{ kind: 'part_of', wholeId: childA.trace.id },
					{ kind: 'part_of', wholeId: childB.trace.id }
				]
			}
		});
		const { kind, kindV } = await repo.createTraceKind({
			name: 'Typed child',
			initialKindV: { dataSchema: { type: 'object', properties: {} } }
		});
		const typedChild = await repo.createTrace({
			...plainDraft('Типизированная подзадача', 'intend'),
			kindId: kind.id,
			kindVId: kindV.id,
			data: {}
		});
		await repo.createIntersection({
			fromId: typedChild.id,
			toId: childA.trace.id,
			kind: 'part_of'
		});
		const nonIntention = await repo.saveTraceRecord({
			fields: plainFields('Факт-мост', { relation: 'actual' }),
			links: { add: [{ kind: 'part_of', wholeId: childA.trace.id }] }
		});
		await repo.saveTraceRecord({
			fields: plainFields('Не проходит через факт', { relation: 'intend' }),
			links: { add: [{ kind: 'part_of', wholeId: nonIntention.trace.id }] }
		});
		const result = await repo.repeatIntention(root.trace.id, 'partial', 'Сделано', NEXT_WEEK, {
			now: NOW,
			zone: ZONE
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.copyDay).toBe('2026-09-20');
		const operationTime = (await repo.listLogs()).find(
			(log) => log.operationId === result.operationId
		)!.occurredAt;
		const newTraces = (await repo.listTraces()).filter(
			(trace) => trace.createdAt === operationTime
		);
		const byTitle = new Map(newTraces.map((trace) => [trace.content, trace]));
		const copiedRoot = byTitle.get('Корень')!;
		const copiedA = byTitle.get('Подзадача A')!;
		const copiedB = byTitle.get('Подзадача B')!;
		const copiedShared = byTitle.get('Общая подзадача')!;
		const copiedTyped = byTitle.get('Типизированная подзадача')!;
		expect([copiedRoot, copiedA, copiedB, copiedShared, copiedTyped]).toHaveLength(5);
		expect(copiedTyped).toMatchObject({ kindId: null, kindVId: null, data: null });
		expect(byTitle.has('Факт-мост')).toBe(false);
		expect(byTitle.has('Не проходит через факт')).toBe(false);
		expect(copiedRoot.aboutTime).toEqual(dayTime('2026-09-20'));
		expect(
			[copiedA, copiedB, copiedShared].every((trace) => trace.aboutTime?.basis === 'unknown')
		).toBe(true);
		const scopeLinks = (await repo.listIntersections()).filter(
			(link) => link.kind === 'belongs_to'
		);
		expect(scopeLinks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ fromId: copiedRoot.id, toId: scopeA.id }),
				expect.objectContaining({ fromId: copiedA.id, toId: scopeA.id }),
				expect.objectContaining({ fromId: copiedB.id, toId: scopeB.id }),
				expect.objectContaining({ fromId: copiedShared.id, toId: scopeA.id }),
				expect.objectContaining({ fromId: copiedShared.id, toId: scopeB.id })
			])
		);
		expect(
			(await repo.listIntentionAssessments()).some(
				(assessment) => assessment.intentionId === copiedRoot.id
			)
		).toBe(false);
		const links = (await repo.listIntersections()).filter((link) => link.kind === 'part_of');
		expect(links).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ fromId: copiedRoot.id, toId: parentA.trace.id }),
				expect.objectContaining({ fromId: copiedRoot.id, toId: parentB.trace.id }),
				expect.objectContaining({ fromId: copiedA.id, toId: copiedRoot.id }),
				expect.objectContaining({ fromId: copiedB.id, toId: copiedRoot.id }),
				expect.objectContaining({ fromId: copiedShared.id, toId: copiedA.id }),
				expect.objectContaining({ fromId: copiedShared.id, toId: copiedB.id })
			])
		);
		expect(
			(await repo.listIntersections()).filter(
				(link) => link.kind === 'part_of' && link.fromId === copiedShared.id
			)
		).toHaveLength(2);
		expect(
			(await repo.listIntersections()).some(
				(link) => link.fromId === copiedRoot.id && link.toId === root.trace.id
			)
		).toBe(false);
		expect(
			(await repo.listIntersections()).some(
				(link) => link.fromId === copiedRoot.id && link.toId === deletedParent.trace.id
			)
		).toBe(false);
	});

	it('returns every refusal without writes or journal entries', async () => {
		open();
		const root = await intention('Открытая');
		const wrongRole = await repo.saveTraceRecord({ fields: plainFields('Факт') });
		const assertRefused = async (run: () => Promise<unknown>, reason: string) => {
			const before = await snapshotOf(repo);
			expect(await run()).toEqual({ ok: false, reason });
			expect(await snapshotOf(repo)).toEqual(before);
		};
		await assertRefused(
			() => repo.repeatIntention('missing', 'completed', '', TOMORROW, { now: NOW, zone: ZONE }),
			'not_found'
		);
		const deleted = await intention('Удалённая');
		await repo.setTraceDeleted(deleted.trace.id, true);
		await assertRefused(
			() =>
				repo.repeatIntention(deleted.trace.id, 'completed', '', TOMORROW, { now: NOW, zone: ZONE }),
			'not_found'
		);
		await assertRefused(
			() =>
				repo.repeatIntention(wrongRole.trace.id, 'completed', '', TOMORROW, {
					now: NOW,
					zone: ZONE
				}),
			'not_intention'
		);
		await assertRefused(
			() =>
				repo.repeatIntention(root.trace.id, 'partial', '   ', TOMORROW, { now: NOW, zone: ZONE }),
			'text_required'
		);
		await assertRefused(
			() =>
				repo.repeatIntention(root.trace.id, 'completed', '', TOMORROW, {
					now: NOW,
					zone: 'bad/zone'
				}),
			'invalid_target'
		);
		await assertRefused(
			() =>
				repo.repeatIntention(root.trace.id, 'completed', '', 'not-a-day', { now: NOW, zone: ZONE }),
			'invalid_target'
		);
		const { kind, kindV } = await repo.createTraceKind({
			name: 'Измерение',
			initialKindV: { dataSchema: { type: 'object', properties: {} } }
		});
		const typed = await repo.createTrace({
			...plainDraft('Типизированная задача', 'intend'),
			kindId: kind.id,
			kindVId: kindV.id,
			data: {}
		});
		await assertRefused(
			() => repo.repeatIntention(typed.id, 'completed', '', TOMORROW, { now: NOW, zone: ZONE }),
			'typed_unsupported'
		);
		await repo.createDirectAssessment(root.trace.id, { open: false });
		await assertRefused(
			() =>
				repo.repeatIntention(root.trace.id, 'completed', '', TOMORROW, { now: NOW, zone: ZONE }),
			'closed'
		);

		const laterRoot = await intention('Поздний результат');
		const future = await repo.saveTraceRecord({
			fields: plainFields('Факт позже', {
				relation: 'actual',
				capturedAt: '2026-09-14T10:00:00.000Z',
				aboutTime: minuteTime('2026-09-14T10:00:00.000Z')
			}),
			links: {
				add: [
					{
						kind: 'evidence_for',
						intentionId: laterRoot.trace.id,
						assessment: { outcome: 'partial' }
					}
				]
			}
		});
		await assertRefused(
			() =>
				repo.repeatIntention(laterRoot.trace.id, 'completed', '', TOMORROW, {
					now: NOW,
					zone: ZONE
				}),
			'later_result_exists'
		);
		expect(future.trace.relation).toBe('actual');
	});

	it('undoes the whole operation, and refuses a stale inverse atomically', async () => {
		open();
		const root = await intention('Повторить');
		const child = await repo.saveTraceRecord({
			fields: plainFields('Ребёнок', { relation: 'intend' }),
			links: { add: [{ kind: 'part_of', wholeId: root.trace.id }] }
		});
		const activeBefore = {
			traces: await repo.listTraces(),
			intersections: await repo.listIntersections(),
			assessments: await repo.listIntentionAssessments(),
			result: (({ open, outcome }) => ({ open, outcome }))(await evaluate(repo, root.trace.id))
		};
		const created = await repo.repeatIntention(root.trace.id, 'alternative', 'Иначе', TOMORROW, {
			now: NOW,
			zone: ZONE
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const beforeUndo = await snapshotOf(repo);
		const undone = await repo.undoOperation(created.operationId);
		expect(undone.operation.id).not.toBe(created.operationId);
		expect((await repo.listTraces()).some((trace) => trace.id === created.factId)).toBe(false);
		expect((await repo.listTraces()).some((trace) => trace.id === created.copyId)).toBe(false);
		expect(
			(await repo.listTraces()).some(
				(trace) => trace.content === 'Ребёнок' && trace.id === child.trace.id
			)
		).toBe(true);
		expect((await repo.listTraces()).some((trace) => trace.id === root.trace.id)).toBe(true);
		const afterUndo = await snapshotOf(repo);
		expect(afterUndo.logs.length).toBeGreaterThan(beforeUndo.logs.length);
		expect({
			traces: await repo.listTraces(),
			intersections: await repo.listIntersections(),
			assessments: await repo.listIntentionAssessments(),
			result: (({ open, outcome }) => ({ open, outcome }))(await evaluate(repo, root.trace.id))
		}).toEqual(activeBefore);
		const staleRoot = await intention('Устаревшее отменённое');
		const staleCreated = await repo.repeatIntention(staleRoot.trace.id, 'completed', '', TOMORROW, {
			now: NOW,
			zone: ZONE
		});
		expect(staleCreated.ok).toBe(true);
		if (!staleCreated.ok) return;
		await repo.saveTraceRecord({ id: staleCreated.copyId, fields: { title: 'Изменили копию' } });
		const staleState = await snapshotOf(repo);
		expect(await repositoryOutcome(repo.undoOperation(staleCreated.operationId))).toBe(
			'undo_stale'
		);
		expect(await snapshotOf(repo)).toEqual(staleState);
	});
});

describe('repeatDays', () => {
	it('uses local calendar days across Belgrade midnight and DST', () => {
		expect(repeatDays(Date.parse('2026-03-28T22:30:00.000Z'), ZONE)).toEqual({
			tomorrow: '2026-03-29',
			nextWeek: '2026-04-04'
		});
		expect(repeatDays(Date.parse('2026-10-24T21:30:00.000Z'), ZONE)).toEqual({
			tomorrow: '2026-10-25',
			nextWeek: '2026-10-31'
		});
	});
});
