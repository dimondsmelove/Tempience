import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import {
	evaluate,
	journalOf,
	openRecordFixture,
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

describe('undoOperation — first-creation candidates', () => {
	it('withdraws only its own first creation: another candidate keeps the source alive with its values', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		const link = fact.links[0];
		const created = await repo.createEvidenceAssessment(link.id, {
			outcome: 'partial',
			open: true
		});
		const creation = created.outcomeRevision!;
		// A first creation of another replica merged into the same source before the inverse.
		await fixture.client.update('intentionAssessments', created.id, {
			initial: {
				'op:other-replica': { at: '2026-09-13T09:30:00.000Z', outcome: 'completed', open: false }
			}
		} as never);
		const undone = await repo.undoOperation(creation);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intentionAssessment:deleted:undo'
		]);
		const stored = await fixture.client.fetchById('intentionAssessments', created.id);
		expect(stored?.initial).toEqual({
			[creation]: expect.objectContaining({
				outcome: 'partial',
				open: true,
				withdrawn: undone.operation.id
			}),
			'op:other-replica': { at: '2026-09-13T09:30:00.000Z', outcome: 'completed', open: false }
		});
		expect(stored?.isDeleted).not.toBe(true);
		const source = (await repo.listIntentionAssessments()).find((row) => row.id === created.id);
		expect(source).toMatchObject({
			isDeleted: false,
			outcome: 'completed',
			open: false,
			outcomeRevision: 'op:other-replica',
			firstAssessedAt: '2026-09-13T09:30:00.000Z'
		});
		expect((await evaluate(repo, intention.id)).outcome).toEqual({
			value: 'completed',
			sourceId: created.id
		});
		// The withdrawn creation is not offered back again, and a new first creation on the spent
		// identity is a creation, not a revival of the undone one.
		const before = await snapshotOf(repo);
		await expect(repo.undoOperation(creation)).rejects.toMatchObject({
			code: 'undo_stale',
			details: { reason: 'candidate' }
		});
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('spends a source whose only creation was withdrawn and creates anew on the same identity', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		const link = fact.links[0];
		const created = await repo.createEvidenceAssessment(link.id, { outcome: 'partial' });
		await repo.undoOperation(created.outcomeRevision!);
		expect(await repo.listIntentionAssessments()).toEqual([]);
		expect(
			(await repo.listIntentionAssessments(true)).find((row) => row.id === created.id)
		).toMatchObject({
			isDeleted: true,
			firstAssessedAt: created.firstAssessedAt
		});
		expect((await evaluate(repo, intention.id)).outcome.sourceId).toBeNull();
		const fresh = await repo.createEvidenceAssessment(link.id, { open: false });
		expect(fresh).toMatchObject({ id: created.id, isDeleted: false, open: false, outcome: null });
		expect(fresh.firstAssessedAt).not.toBe(created.firstAssessedAt);
		expect((await repo.listLogs(created.id))[0]).toMatchObject({
			action: 'created',
			cause: 'normal'
		});
		expect(
			Object.keys(
				(await fixture.client.fetchById('intentionAssessments', created.id))?.initial ?? {}
			)
		).toHaveLength(2);
	});
});
