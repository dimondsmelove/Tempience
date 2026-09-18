import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import {
	dayTime,
	evaluate,
	journalOf,
	openRecordFixture,
	outcome,
	plainDraft,
	plainFields,
	snapshotOf,
	supplementOf,
	type RecordFixture
} from './undo.fixture';

let fixture: RecordFixture;
let repo: TempienceRepository;
afterEach(async () => {
	await fixture?.dispose();
});
const open = () => {
	fixture = openRecordFixture();
	repo = fixture.repository;
};

describe('undoOperation — Trace records', () => {
	it('re-enables a deleted newer fact: the older outcome gives way again, direct closure, open=false and first time stay', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const older = await repo.saveTraceRecord({
			fields: plainFields('Старый факт', { aboutTime: dayTime('2026-09-10') }),
			links: {
				add: [
					{ kind: 'evidence_for', intentionId: intention.id, assessment: { outcome: 'partial' } }
				]
			}
		});
		const newer = await repo.saveTraceRecord({
			fields: plainFields('Новый факт', { aboutTime: dayTime('2026-09-11') }),
			links: {
				add: [
					{
						kind: 'evidence_for',
						intentionId: intention.id,
						assessment: { outcome: 'completed', open: false }
					}
				]
			}
		});
		const direct = await repo.createDirectAssessment(intention.id, { open: false });
		const source = newer.assessments[0];
		expect((await evaluate(repo, intention.id)).outcome).toEqual({
			value: 'completed',
			sourceId: source.id
		});

		const deletion = await repo.setTraceDeleted(newer.trace.id, true);
		expect(deletion.trace.isDeleted).toBe(true);
		expect((await evaluate(repo, intention.id)).outcome).toEqual({
			value: 'partial',
			sourceId: older.assessments[0].id
		});
		const deletionOperation = (await repo.listLogs(newer.trace.id))[0].operationId;

		const undone = await repo.undoOperation(deletionOperation);
		expect(undone.plan.steps).toEqual([
			{ kind: 'trace.lifecycle', traceId: newer.trace.id, deleted: true }
		]);
		expect(await journalOf(repo, undone.operation.id)).toEqual(['trace:restored:undo']);
		expect(await journalOf(repo, deletionOperation)).toEqual(['trace:deleted:normal']);
		const result = await evaluate(repo, intention.id);
		expect(result.outcome).toEqual({ value: 'completed', sourceId: source.id });
		// The later direct closure still determines openness; the revived source keeps its own.
		expect(result.open).toEqual({ value: false, sourceId: direct.id });
		expect(result.sources.map((state) => state.assessment.id)).toEqual(
			expect.arrayContaining([source.id, direct.id, older.assessments[0].id])
		);
		const restored = (await repo.listIntentionAssessments()).find((row) => row.id === source.id);
		expect(restored).toMatchObject({
			open: false,
			outcome: 'completed',
			firstAssessedAt: source.firstAssessedAt,
			lifecycleId: source.lifecycleId
		});
		expect((await repo.listIntentionAssessments()).find((row) => row.id === direct.id)).toEqual(
			direct
		);
	});

	it('inverts the edited fields exactly while an independent field and membership survive; ABA refuses', async () => {
		open();
		const a = await repo.createScope({ name: 'A' });
		const b = await repo.createScope({ name: 'B' });
		const created = await repo.saveTraceRecord({
			fields: plainFields('Прогулка', {
				description: 'по парку',
				aboutKind: 'interval',
				aboutTime: dayTime('2026-09-10', '2026-09-11'),
				statedDuration: null
			}),
			memberships: { add: [a.id] }
		});
		const id = created.trace.id;
		const edit = await repo.saveTraceRecord({
			id,
			fields: {
				title: 'Пробежка',
				aboutKind: 'instant',
				aboutTime: { basis: 'unknown' },
				statedDuration: null
			}
		});
		expect(edit.trace).toMatchObject({ content: 'Пробежка', aboutKind: 'instant' });
		// Independent later changes: another field and another membership.
		const independent = await repo.saveTraceRecord({
			id,
			fields: { description: 'по набережной' },
			memberships: { add: [b.id] }
		});
		const undone = await repo.undoOperation(edit.operation.id);
		expect(undone.plan.steps.map((step) => step.kind)).toEqual(['trace.fields']);
		expect(await journalOf(repo, undone.operation.id)).toEqual(['trace:updated:undo']);
		const trace = (await repo.listTraces()).find((row) => row.id === id)!;
		expect(trace).toMatchObject({
			content: 'Прогулка',
			description: 'по набережной',
			aboutKind: 'interval',
			aboutTime: dayTime('2026-09-10', '2026-09-11')
		});
		expect(
			(await repo.listIntersections())
				.filter((link) => link.fromId === id && link.kind === 'belongs_to')
				.map((link) => link.toId)
				.toSorted()
		).toEqual([a.id, b.id].toSorted());
		// The stored time went back through the atomic shape: an exact reread, no residue.
		expect(await fixture.client.fetchById('traces', id)).toMatchObject({
			aboutTime: [dayTime('2026-09-10', '2026-09-11')],
			encoding: { aboutTime: 1 }
		});
		expect(independent.operation.id).not.toBe(undone.operation.id);

		// A→B→A of the same field: the newest change owns it, equality with the after value is not enough.
		const toC = await repo.saveTraceRecord({ id, fields: { title: 'C' } });
		await repo.saveTraceRecord({ id, fields: { title: 'Прогулка' } });
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(toC.operation.id))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('undoes typed data and duration edits through the codec, including removal', async () => {
		open();
		const { kind, kindV } = await repo.createTraceKind({
			name: 'Замер',
			initialKindV: {
				dataSchema: {
					type: 'object',
					additionalProperties: false,
					required: ['weight'],
					properties: { weight: { type: 'number' }, note: { type: 'string' } }
				}
			}
		});
		const typed = await repo.saveTraceRecord({
			fields: plainFields(null, {
				description: '',
				kindId: kind.id,
				kindVId: kindV.id,
				data: { weight: 74 },
				aboutKind: 'interval',
				aboutTime: dayTime('2026-09-10', '2026-09-11'),
				statedDuration: null
			})
		});
		const id = typed.trace.id;
		// Explicit boundaries give way to a start with a stated duration; the data gains a key.
		const edit = await repo.saveTraceRecord({
			id,
			fields: {
				data: { weight: 75, note: 'после сна' },
				aboutTime: dayTime('2026-09-10'),
				statedDuration: { amount: 2, unit: 'day' },
				description: 'x'
			}
		});
		expect(edit.trace).toMatchObject({
			data: { weight: 75, note: 'после сна' },
			statedDuration: { amount: 2, unit: 'day' },
			content: 'x'
		});
		await repo.undoOperation(edit.operation.id);
		const trace = (await repo.listTraces()).find((row) => row.id === id)!;
		expect(trace).toMatchObject({
			data: { weight: 74 },
			aboutTime: dayTime('2026-09-10', '2026-09-11'),
			statedDuration: null,
			content: '',
			description: null
		});
		expect(Object.keys(trace.data ?? {})).toEqual(['weight']);
		expect(await fixture.client.fetchById('traces', id)).toMatchObject({
			data: [{ weight: 74 }],
			aboutTime: [dayTime('2026-09-10', '2026-09-11')],
			statedDuration: null,
			encoding: { data: 1, aboutTime: 1 }
		});
	});

	it('returns an intention to its own past date after an allowed edit to a future date', async () => {
		open();
		const intention = await repo.createTrace(
			plainDraft('Старое намерение', 'intend', dayTime('2020-01-01'))
		);
		const moved = await repo.saveTraceRecord({
			id: intention.id,
			fields: { aboutTime: dayTime('2100-01-01') }
		});
		expect(moved.trace.aboutTime).toEqual(dayTime('2100-01-01'));
		const undone = await repo.undoOperation(moved.operation.id);
		expect(await journalOf(repo, undone.operation.id)).toEqual(['trace:updated:undo']);
		expect((await repo.listTraces()).find((row) => row.id === intention.id)?.aboutTime).toEqual(
			dayTime('2020-01-01')
		);
	});

	it('keeps ordinary restore separate and reads a repeated inverse as stale', async () => {
		open();
		const trace = await repo.createTrace(plainDraft('Запись'));
		await repo.setTraceDeleted(trace.id, true);
		const deletion = (await repo.listLogs(trace.id))[0].operationId;
		await repo.setTraceDeleted(trace.id, false);
		expect((await repo.listLogs(trace.id))[0]).toMatchObject({
			action: 'restored',
			cause: 'restore'
		});
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(deletion))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);

		await repo.setTraceDeleted(trace.id, true);
		const again = (await repo.listLogs(trace.id))[0].operationId;
		const undone = await repo.undoOperation(again);
		expect((await repo.listLogs(trace.id))[0]).toMatchObject({
			action: 'restored',
			cause: 'undo',
			operationId: undone.operation.id
		});
		const after = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(again))).toBe('undo_stale');
		// Neither an inverse nor an ordinary restore is offered back: no redo, no second undo system.
		expect(await outcome(repo.undoOperation(undone.operation.id))).toBe('undo_unsupported');
		expect(await snapshotOf(repo)).toEqual(after);
		expect(await outcome(repo.undoOperation('op:never'))).toBe('undo_unknown');
	});

	it('obeys the pair rule for a supplement: a deleted original keeps it restorable, a withdrawn link refuses whole', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		const supplement = await supplementOf(repo, original);
		await repo.setTraceDeleted(original.id, true);
		await repo.setTraceDeleted(supplement.trace.id, true);
		const deletion = (await repo.listLogs(supplement.trace.id))[0].operationId;
		await repo.undoOperation(deletion);
		expect((await repo.listTraces()).find((row) => row.id === supplement.trace.id)?.isDeleted).toBe(
			false
		);
		expect((await repo.listTraces(true)).find((row) => row.id === original.id)?.isDeleted).toBe(
			true
		);

		await repo.setTraceDeleted(supplement.trace.id, true);
		const secondDeletion = (await repo.listLogs(supplement.trace.id))[0].operationId;
		await repo.setIntersectionDeleted(supplement.links[0].id, true);
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(secondDeletion))).toBe('supplement_orphan');
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('refuses to undo a creation and leaves nothing behind', async () => {
		open();
		const created = await repo.saveTraceRecord({ fields: plainFields('Новая запись') });
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(created.operation.id))).toBe('undo_unsupported');
		expect(await snapshotOf(repo)).toEqual(before);
	});
});
