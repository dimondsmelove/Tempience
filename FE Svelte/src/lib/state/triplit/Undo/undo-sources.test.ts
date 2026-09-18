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

const lastOperation = async (entityId: string) => (await repo.listLogs(entityId))[0].operationId;

describe('undoOperation — sources', () => {
	it('restores a withdrawn source with its explicit open=false and refuses once its lifecycle moved on', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
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
		const source = fact.assessments[0];
		const closure = await repo.createDirectAssessment(intention.id, { open: false });
		await repo.setIntentionAssessmentDeleted(source.id, true);
		const withdrawal = await lastOperation(source.id);
		expect((await evaluate(repo, intention.id)).outcome.sourceId).toBeNull();
		const undone = await repo.undoOperation(withdrawal);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intentionAssessment:restored:undo'
		]);
		const restored = (await repo.listIntentionAssessments()).find((row) => row.id === source.id);
		expect(restored).toMatchObject({
			isDeleted: false,
			outcome: 'completed',
			open: false,
			firstAssessedAt: source.firstAssessedAt,
			outcomeRevision: source.outcomeRevision,
			openRevision: source.openRevision,
			lifecycleId: undone.operation.id
		});
		const result = await evaluate(repo, intention.id);
		expect(result.outcome).toEqual({ value: 'completed', sourceId: source.id });
		expect(result.sources.map((state) => state.assessment.id)).toEqual(
			expect.arrayContaining([source.id, closure.id])
		);

		await repo.setIntentionAssessmentDeleted(source.id, true);
		const again = await lastOperation(source.id);
		await repo.setIntentionAssessmentDeleted(source.id, false);
		await repo.setIntentionAssessmentDeleted(source.id, true);
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(again))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('does not offer back a save that added evidence, assessed or not; the explicit withdrawal keeps its inverse', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const other = await repo.createTrace(plainDraft('Записать вес', 'intend'));
		const fact = await repo.saveTraceRecord({ fields: plainFields('80 кг') });
		const linked = await repo.saveTraceRecord({
			id: fact.trace.id,
			fields: { title: '80,5 кг' },
			links: {
				add: [
					{ kind: 'evidence_for', intentionId: intention.id, assessment: { outcome: 'completed' } },
					{ kind: 'evidence_for', intentionId: other.id }
				]
			}
		});
		// The whole compound inverse is refused statically: no field goes back on its own, no Log.
		const before = await snapshotOf(repo);
		await expect(repo.undoOperation(linked.operation.id)).rejects.toMatchObject({
			code: 'undo_unsupported',
			details: { entityType: 'intersection', reason: 'evidence_link' }
		});
		expect(await snapshotOf(repo)).toEqual(before);
		expect((await repo.listTraces()).find((row) => row.id === fact.trace.id)?.content).toBe(
			'80,5 кг'
		);
		expect((await evaluate(repo, intention.id)).outcome).toEqual({
			value: 'completed',
			sourceId: linked.assessments[0].id
		});
		// Ordinary explicit withdrawal stays available, and that withdrawal is offered back.
		const link = linked.links[0];
		await repo.setIntersectionDeleted(link.id, true);
		const withdrawal = (await repo.listLogs(link.id))[0].operationId;
		expect((await evaluate(repo, intention.id)).outcome.sourceId).toBeNull();
		await repo.undoOperation(withdrawal);
		expect((await evaluate(repo, intention.id)).outcome).toEqual({
			value: 'completed',
			sourceId: linked.assessments[0].id
		});
		// An assessment entered on an existing link is still taken back as its own candidate.
		const assessed = await repo.saveTraceRecord({
			id: fact.trace.id,
			fields: {},
			assessments: [{ evidenceId: linked.links[1].id, values: { open: false } }]
		});
		expect(assessed.assessments).toHaveLength(1);
		const undone = await repo.undoOperation(assessed.operation.id);
		expect(undone.plan.steps.map((step) => step.kind)).toEqual(['assessment.created']);
		expect((await evaluate(repo, other.id)).open).toEqual({ value: true, sourceId: null });
	});

	it('inverts a feature correction by its own revision and a revival with its restated feature', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: {
				add: [
					{ kind: 'evidence_for', intentionId: intention.id, assessment: { outcome: 'partial' } }
				]
			}
		});
		const source = fact.assessments[0];
		const { assessment: corrected } = await repo.editIntentionAssessment(source.id, {
			outcome: 'completed',
			open: true
		});
		const correction = corrected.outcomeRevision!;
		const undone = await repo.undoOperation(correction);
		expect(undone.plan.steps).toEqual([
			{
				kind: 'assessment.values',
				assessmentId: source.id,
				features: {
					outcome: { before: 'partial', after: 'completed', ownerBefore: source.outcomeRevision },
					open: { before: null, after: true, ownerBefore: null }
				},
				restated: []
			}
		]);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intentionAssessment:updated:undo'
		]);
		expect(
			(await repo.listIntentionAssessments()).find((row) => row.id === source.id)
		).toMatchObject({
			outcome: 'partial',
			open: null,
			outcomeRevision: source.outcomeRevision,
			openRevision: null,
			firstAssessedAt: source.firstAssessedAt
		});
		// The slots keep the inverse's revision but re-express no correction: they are inert.
		expect((await fixture.client.fetchById('intentionAssessments', source.id))?.values).toEqual({
			outcome: { value: 'partial', operationId: undone.operation.id, statement: null },
			open: { value: null, operationId: undone.operation.id, statement: null }
		});
		// A→B→A of one feature: the newest correction owns it.
		const { assessment: toAlternative } = await repo.editIntentionAssessment(source.id, {
			outcome: 'alternative'
		});
		await repo.editIntentionAssessment(source.id, { outcome: 'partial' });
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(toAlternative.outcomeRevision!))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);

		// Revival through a new assessment on the same link restates a feature; its inverse withdraws again.
		await repo.setIntentionAssessmentDeleted(source.id, true);
		const revived = await repo.createEvidenceAssessment(fact.links[0].id, { open: false });
		expect(revived).toMatchObject({ id: source.id, isDeleted: false, open: false });
		const revivalUndone = await repo.undoOperation(revived.lifecycleId);
		expect(revivalUndone.plan.steps.map((step) => step.kind).toSorted()).toEqual([
			'assessment.lifecycle',
			'assessment.values'
		]);
		expect(
			(await repo.listIntentionAssessments(true)).find((row) => row.id === source.id)
		).toMatchObject({
			isDeleted: true,
			open: null,
			outcome: 'partial'
		});

		// A revival that restates the same value takes a new revision without a value change;
		// its inverse keeps the value and moves the revision on, so the older correction stays stale.
		await repo.setIntentionAssessmentDeleted(source.id, false);
		const { assessment: closed } = await repo.editIntentionAssessment(source.id, { open: false });
		await repo.setIntentionAssessmentDeleted(source.id, true);
		const restated = await repo.createEvidenceAssessment(fact.links[0].id, { open: false });
		expect(restated).toMatchObject({ open: false, openRevision: restated.lifecycleId });
		const restatementUndone = await repo.undoOperation(restated.lifecycleId);
		expect(restatementUndone.plan.steps).toEqual([
			{ kind: 'assessment.lifecycle', assessmentId: source.id, deleted: false },
			{
				kind: 'assessment.values',
				assessmentId: source.id,
				features: {},
				restated: [{ feature: 'open', ownerBefore: closed.openRevision }]
			}
		]);
		expect(
			(await repo.listIntentionAssessments(true)).find((row) => row.id === source.id)
		).toMatchObject({ isDeleted: true, open: false, openRevision: restatementUndone.operation.id });
		await repo.setIntentionAssessmentDeleted(source.id, false);
		expect(await outcome(repo.undoOperation(closed.openRevision!))).toBe('undo_stale');
	});
});
