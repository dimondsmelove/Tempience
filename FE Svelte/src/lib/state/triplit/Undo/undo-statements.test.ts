import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import {
	evaluate,
	journalOf,
	openRecordFixture,
	outcome,
	plainDraft,
	plainFields,
	snapshotOf,
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

/** A fact linked as evidence with one first assessment whose creation is then taken back. */
const withdrawnCreation = async (values: { outcome?: 'partial'; open?: boolean }) => {
	const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
	const fact = await repo.saveTraceRecord({
		fields: plainFields('80 кг'),
		links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
	});
	const link = fact.links[0];
	const created = await repo.createEvidenceAssessment(link.id, values);
	const creation = (created.outcomeRevision ?? created.openRevision)!;
	const undone = await repo.undoOperation(creation);
	return { intention, link, created, creation, undone };
};

/** Another replica's correction as it arrives through the merge: a genuine statement of its own. */
const arrivingCorrection = (id: string, values: Record<string, unknown>) =>
	fixture.client.update('intentionAssessments', id, {
		values: Object.fromEntries(
			Object.entries(values).map(([feature, value]) => [
				feature,
				{ value, operationId: 'op:other-replica', statement: 'op:other-replica' }
			])
		)
	} as never);

describe('undoOperation — statements of a source', () => {
	it('keeps a source alive through a correction that arrives after its creation was taken back', async () => {
		open();
		const { intention, created } = await withdrawnCreation({ outcome: 'partial', open: true });
		expect(await repo.listIntentionAssessments()).toEqual([]);
		await arrivingCorrection(created.id, { outcome: 'completed', open: false });
		const source = (await repo.listIntentionAssessments()).find((row) => row.id === created.id);
		expect(source).toMatchObject({
			isDeleted: false,
			outcome: 'completed',
			open: false,
			outcomeRevision: 'op:other-replica',
			openRevision: 'op:other-replica',
			firstAssessedAt: created.firstAssessedAt
		});
		const result = await evaluate(repo, intention.id);
		expect(result.outcome).toEqual({ value: 'completed', sourceId: created.id });
		expect(result.open).toEqual({ value: false, sourceId: created.id });
	});

	it('never revives a value only the withdrawn creation set: one corrected feature, explicit null and false', async () => {
		open();
		const { created } = await withdrawnCreation({ outcome: 'partial', open: true });
		await arrivingCorrection(created.id, { outcome: 'completed' });
		expect(
			(await repo.listIntentionAssessments()).find((row) => row.id === created.id)
		).toMatchObject({
			isDeleted: false,
			outcome: 'completed',
			open: null,
			openRevision: null
		});
		await arrivingCorrection(created.id, { open: false });
		expect(
			(await repo.listIntentionAssessments()).find((row) => row.id === created.id)
		).toMatchObject({
			outcome: 'completed',
			open: false
		});
		await arrivingCorrection(created.id, { outcome: null });
		expect(
			(await repo.listIntentionAssessments()).find((row) => row.id === created.id)
		).toMatchObject({
			isDeleted: false,
			outcome: null,
			open: false
		});
	});

	it('leaves nothing standing once every statement is taken back, and refuses while a known one stands', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		const created = await repo.createEvidenceAssessment(fact.links[0].id, { outcome: 'partial' });
		const creation = created.outcomeRevision!;
		const { assessment: corrected } = await repo.editIntentionAssessment(created.id, {
			outcome: 'completed'
		});
		await expect(repo.undoOperation(creation)).rejects.toMatchObject({
			code: 'undo_stale',
			details: { reason: 'newer_change', field: 'outcome', operationId: corrected.outcomeRevision }
		});
		await repo.undoOperation(corrected.outcomeRevision!);
		expect(
			(await repo.listIntentionAssessments()).find((row) => row.id === created.id)
		).toMatchObject({
			outcome: 'partial',
			outcomeRevision: creation
		});
		const undone = await repo.undoOperation(creation);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intentionAssessment:deleted:undo'
		]);
		expect(await repo.listIntentionAssessments()).toEqual([]);
		expect((await evaluate(repo, intention.id)).outcome.sourceId).toBeNull();
	});

	it('re-expresses an earlier correction when a later one is taken back, and that correction keeps standing', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		const created = await repo.createEvidenceAssessment(fact.links[0].id, { outcome: 'partial' });
		const { assessment: first } = await repo.editIntentionAssessment(created.id, {
			outcome: 'completed'
		});
		const { assessment: second } = await repo.editIntentionAssessment(created.id, {
			outcome: 'alternative'
		});
		const undone = await repo.undoOperation(second.outcomeRevision!);
		expect((await fixture.client.fetchById('intentionAssessments', created.id))?.values).toEqual({
			outcome: {
				value: 'completed',
				operationId: undone.operation.id,
				statement: first.outcomeRevision
			}
		});
		expect(
			(await repo.listIntentionAssessments()).find((row) => row.id === created.id)
		).toMatchObject({
			outcome: 'completed',
			outcomeRevision: undone.operation.id
		});
		// The first correction still stands, so taking the creation back is refused, not silent.
		await expect(repo.undoOperation(created.outcomeRevision!)).rejects.toMatchObject({
			code: 'undo_stale',
			details: { reason: 'newer_change', operationId: first.outcomeRevision }
		});
		// A restated correction cannot be taken back through its old revision either.
		expect(await outcome(repo.undoOperation(first.outcomeRevision!))).toBe('undo_stale');
	});

	it('creates anew on a spent identity without reading inert slots', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		const created = await repo.createEvidenceAssessment(fact.links[0].id, { outcome: 'partial' });
		const { assessment: corrected } = await repo.editIntentionAssessment(created.id, {
			outcome: 'completed'
		});
		await repo.undoOperation(corrected.outcomeRevision!);
		await repo.undoOperation(created.outcomeRevision!);
		expect(await repo.listIntentionAssessments()).toEqual([]);
		const fresh = await repo.createEvidenceAssessment(fact.links[0].id, { open: false });
		expect(fresh).toMatchObject({ id: created.id, isDeleted: false, outcome: null, open: false });
		expect(fresh.firstAssessedAt).not.toBe(created.firstAssessedAt);
		expect((await evaluate(repo, intention.id)).open).toEqual({
			value: false,
			sourceId: created.id
		});
		const raw = await fixture.client.fetchById('intentionAssessments', created.id);
		expect(Object.keys(raw?.initial as object)).toHaveLength(2);
		expect((raw?.values as { outcome: { statement: unknown } }).outcome.statement).toBeNull();
	});

	it('refuses an ordinary restore of a canceled creation without writing, and withdraws it as a no-op', async () => {
		open();
		const { created } = await withdrawnCreation({ outcome: 'partial' });
		const before = await snapshotOf(repo);
		await expect(repo.setIntentionAssessmentDeleted(created.id, false)).rejects.toMatchObject({
			code: 'assessment_canceled'
		});
		expect(await snapshotOf(repo)).toEqual(before);
		expect((await repo.setIntentionAssessmentDeleted(created.id, true)).assessment.isDeleted).toBe(
			true
		);
		expect(await snapshotOf(repo)).toEqual(before);
		// Once a correction stands again, ordinary withdrawal and restore work on the row as before.
		await arrivingCorrection(created.id, { outcome: 'completed' });
		const { assessment: withdrawn } = await repo.setIntentionAssessmentDeleted(created.id, true);
		expect(withdrawn.isDeleted).toBe(true);
		const { assessment: restored } = await repo.setIntentionAssessmentDeleted(created.id, false);
		expect(restored).toMatchObject({ isDeleted: false, outcome: 'completed' });
		expect((await repo.listLogs(created.id))[0]).toMatchObject({
			action: 'restored',
			cause: 'restore'
		});
	});
});
