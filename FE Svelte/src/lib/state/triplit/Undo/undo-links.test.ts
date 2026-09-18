import { afterEach, describe, expect, it } from 'vitest';
import { linkSourceId, resolveLinkSource } from '../IntentionAssessments/binding';
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
const linkById = async (id: string) =>
	(await repo.listIntersections(true)).find((row) => row.id === id)!;
const sourceOf = async (linkId: string) => {
	const link = await linkById(linkId);
	return resolveLinkSource(
		link,
		await fixture.client.fetchById('intentionAssessments', linkSourceId(link))
	);
};

describe('undoOperation — links', () => {
	it('restores a withdrawn evidence link with its own activation and source; a relink never revives it', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: {
				add: [
					{ kind: 'evidence_for', intentionId: intention.id, assessment: { outcome: 'completed' } }
				]
			}
		});
		const link = fact.links[0];
		const source = fact.assessments[0];

		await repo.setIntersectionDeleted(link.id, true);
		const withdrawal = await lastOperation(link.id);
		expect((await evaluate(repo, intention.id)).outcome.sourceId).toBeNull();
		const undone = await repo.undoOperation(withdrawal);
		expect(undone.plan.steps).toEqual([{ kind: 'link.lifecycle', linkId: link.id, deleted: true }]);
		expect(await journalOf(repo, undone.operation.id)).toEqual(['intersection:restored:undo']);
		expect(await linkById(link.id)).toMatchObject({
			isDeleted: false,
			activationId: link.activationId,
			lifecycleId: undone.operation.id
		});
		expect((await sourceOf(link.id)).status).toBe('current');
		expect((await evaluate(repo, intention.id)).outcome).toEqual({
			value: 'completed',
			sourceId: source.id
		});
		expect(
			(await repo.listIntentionAssessments()).find((row) => row.id === source.id)?.firstAssessedAt
		).toBe(source.firstAssessedAt);

		// Withdraw again, then an ordinary relink: a fresh activation without the old source.
		await repo.setIntersectionDeleted(link.id, true);
		const secondWithdrawal = await lastOperation(link.id);
		const relinked = await repo.createIntersection({
			fromId: fact.trace.id,
			toId: intention.id,
			kind: 'evidence_for'
		});
		expect(relinked.id).toBe(link.id);
		expect(relinked.activationId).not.toBe(link.activationId);
		expect((await sourceOf(link.id)).status).toBe('none');
		expect((await evaluate(repo, intention.id)).outcome.sourceId).toBeNull();
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(secondWithdrawal))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('refuses after an A→B→A lifecycle and inverts only the latest withdrawal', async () => {
		open();
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		const link = fact.links[0];
		await repo.setIntersectionDeleted(link.id, true);
		const first = await lastOperation(link.id);
		await repo.setIntersectionDeleted(link.id, false);
		await repo.setIntersectionDeleted(link.id, true);
		const second = await lastOperation(link.id);
		expect(await outcome(repo.undoOperation(first))).toBe('undo_stale');
		expect((await linkById(link.id)).isDeleted).toBe(true);
		await repo.undoOperation(second);
		expect(await linkById(link.id)).toMatchObject({
			isDeleted: false,
			activationId: link.activationId
		});
	});

	it('restores only the withdrawn membership, leaving a later independent removal in place', async () => {
		open();
		const a = await repo.createScope({ name: 'A' });
		const b = await repo.createScope({ name: 'B' });
		const trace = await repo.saveTraceRecord({
			fields: plainFields('Прогулка'),
			memberships: { add: [a.id, b.id] }
		});
		const id = trace.trace.id;
		const removal = await repo.saveTraceRecord({ id, fields: {}, memberships: { remove: [a.id] } });
		await repo.saveTraceRecord({ id, fields: {}, memberships: { remove: [b.id] } });
		const undone = await repo.undoOperation(removal.operation.id);
		expect(undone.plan.steps).toEqual([
			{ kind: 'link.lifecycle', linkId: `${id}:${a.id}:belongs_to`, deleted: true }
		]);
		expect(
			(await repo.listIntersections(true))
				.filter((row) => row.fromId === id)
				.map((row) => [row.toId, row.isDeleted])
				.toSorted()
		).toEqual(
			[
				[a.id, false],
				[b.id, true]
			].toSorted()
		);
	});
});
