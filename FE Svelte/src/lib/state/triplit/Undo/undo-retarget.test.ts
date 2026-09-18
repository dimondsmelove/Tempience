import { afterEach, describe, expect, it } from 'vitest';
import { linkSourceId, resolveLinkSource } from '../IntentionAssessments/binding';
import type { TempienceRepository } from '../repository';
import type { Trace } from '../types';
import {
	dayTime,
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

const linkById = async (id: string) =>
	(await repo.listIntersections(true)).find((row) => row.id === id)!;
const sourceById = async (id: string) =>
	(await repo.listIntentionAssessments(true)).find((row) => row.id === id)!;

/** A fact with an assessed evidence link to A, plus intentions B and C. */
const scene = async () => {
	const a = await repo.createTrace(plainDraft('A', 'intend'));
	const b = await repo.createTrace(plainDraft('B', 'intend'));
	const c = await repo.createTrace(plainDraft('C', 'intend'));
	const fact = await repo.saveTraceRecord({
		fields: plainFields('F', { aboutTime: dayTime('2026-09-10') }),
		links: {
			add: [{ kind: 'evidence_for', intentionId: a.id, assessment: { outcome: 'completed' } }]
		}
	});
	return { a, b, c, fact, link: fact.links[0], source: fact.assessments[0] };
};

const retarget = async (linkId: string, intention: Trace) => {
	const moved = await repo.correctEvidenceTarget(linkId, intention.id);
	const operationId = (await repo.listLogs(moved.link.id))[0].operationId;
	return { ...moved, operationId };
};

describe('undoOperation — retarget', () => {
	it('returns the source to A after A→B while B keeps its independent result', async () => {
		open();
		const { a, b, fact, link, source } = await scene();
		const moved = await retarget(link.id, b);
		expect(moved.assessment).toMatchObject({ intentionId: b.id, evidenceId: moved.link.id });
		// Independent B results after the move: a direct closure and another fact's evidence.
		const closure = await repo.createDirectAssessment(b.id, { open: false });
		const other = await repo.saveTraceRecord({
			fields: plainFields('G', { aboutTime: dayTime('2026-09-12') }),
			links: {
				add: [{ kind: 'evidence_for', intentionId: b.id, assessment: { outcome: 'partial' } }]
			}
		});
		const bBefore = await evaluate(repo, b.id);
		expect(bBefore.outcome).toEqual({ value: 'partial', sourceId: other.assessments[0].id });

		const undone = await repo.undoOperation(moved.operationId);
		expect(undone.plan.steps.map((step) => step.kind).toSorted()).toEqual([
			'assessment.placement',
			'link.created',
			'link.lifecycle'
		]);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intentionAssessment:updated:undo',
			'intersection:deleted:undo',
			'intersection:restored:undo'
		]);
		expect(await linkById(link.id)).toMatchObject({
			isDeleted: false,
			activationId: link.activationId,
			toId: a.id
		});
		expect(await linkById(moved.link.id)).toMatchObject({ isDeleted: true, toId: b.id });
		const returned = await sourceById(source.id);
		expect(returned).toMatchObject({
			intentionId: a.id,
			evidenceId: link.id,
			activationId: link.activationId,
			placementRevision: undone.operation.id,
			firstAssessedAt: source.firstAssessedAt,
			outcome: 'completed',
			isDeleted: false
		});
		expect(returned.firstAssessedAt).not.toBe(undone.operation.timestamp);
		expect(
			resolveLinkSource(
				await linkById(link.id),
				await fixture.client.fetchById(
					'intentionAssessments',
					linkSourceId(await linkById(link.id))
				)
			)
		).toMatchObject({ status: 'current' });
		expect((await evaluate(repo, a.id)).outcome).toEqual({
			value: 'completed',
			sourceId: source.id
		});
		const bAfter = await evaluate(repo, b.id);
		expect(bAfter.outcome).toEqual(bBefore.outcome);
		expect(bAfter.open).toEqual({ value: false, sourceId: closure.id });
		expect(bAfter.sources.map((state) => state.assessment.id)).not.toContain(source.id);
		expect(fact.trace.id).toBe(link.fromId);
	});

	it('refuses a P2 collision, a further move, a deleted endpoint and a withdrawn source, each whole', async () => {
		open();
		const { a, b, c, link } = await scene();
		const first = await retarget(link.id, b);
		// P2: the original pair was relinked on its own with a fresh activation.
		const relinked = await repo.createIntersection({
			fromId: link.fromId,
			toId: a.id,
			kind: 'evidence_for'
		});
		expect(relinked.activationId).not.toBe(link.activationId);
		let before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(first.operationId))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);
		await repo.setIntersectionDeleted(relinked.id, true);

		// A→B→C: the first move is no longer the source's placement; the old binding is not restored.
		const second = await retarget(first.link.id, c);
		before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(first.operationId))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);

		// Deleted endpoint: the return to B would restore a link to a deleted intention.
		await repo.setTraceDeleted(b.id, true);
		before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(second.operationId))).toBe('evidence_endpoint');
		expect(await snapshotOf(repo)).toEqual(before);
		await repo.setTraceDeleted(b.id, false);

		// Withdrawn source: its lifecycle moved after the retarget.
		await repo.setIntentionAssessmentDeleted(second.assessment!.id, true);
		before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(second.operationId))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);
		await repo.setIntentionAssessmentDeleted(second.assessment!.id, false);
		expect(await outcome(repo.undoOperation(second.operationId))).toBe('undo_stale');
	});

	it('does not offer back an unassessed retarget or a plain evidence link creation, before or after a later assessment', async () => {
		open();
		const a = await repo.createTrace(plainDraft('A', 'intend'));
		const b = await repo.createTrace(plainDraft('B', 'intend'));
		const f = await repo.createTrace(plainDraft('F', 'actual'));
		const old = await repo.createIntersection({ fromId: f.id, toId: a.id, kind: 'evidence_for' });
		const moved = await retarget(old.id, b);
		expect(moved.assessment).toBeNull();
		// No source travelled: the new link is not the return of one, so nothing is offered back.
		let before = await snapshotOf(repo);
		await expect(repo.undoOperation(moved.operationId)).rejects.toMatchObject({
			code: 'undo_unsupported',
			details: { entityId: moved.link.id, reason: 'evidence_link' }
		});
		expect(await snapshotOf(repo)).toEqual(before);
		// Independent, later: the moved link receives its own first assessment; still refused whole.
		const source = await repo.createEvidenceAssessment(moved.link.id, {
			outcome: 'completed',
			open: false
		});
		const bBefore = await evaluate(repo, b.id);
		expect(bBefore.outcome).toEqual({ value: 'completed', sourceId: source.id });
		before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(moved.operationId))).toBe('undo_unsupported');
		expect(await snapshotOf(repo)).toEqual(before);
		expect(await evaluate(repo, b.id)).toEqual(bBefore);
		expect(await linkById(moved.link.id)).toMatchObject({ isDeleted: false });
		expect(await linkById(old.id)).toMatchObject({ isDeleted: true });
		// The explicit correction back to A stays an ordinary command.
		const back = await repo.correctEvidenceTarget(moved.link.id, a.id);
		expect(back.assessment?.id).toBe(source.id);
		// A plain evidence link creation is not offered back either.
		const c = await repo.createTrace(plainDraft('C', 'intend'));
		const plain = await repo.createIntersection({ fromId: f.id, toId: c.id, kind: 'evidence_for' });
		const creation = (await repo.listLogs(plain.id))[0].operationId;
		expect(await outcome(repo.undoOperation(creation))).toBe('undo_unsupported');
	});

	it('inverts the latest of two moves and keeps the ordinary relink distinct from the return', async () => {
		open();
		const { b, c, link, source } = await scene();
		const first = await retarget(link.id, b);
		const second = await retarget(first.link.id, c);
		const undone = await repo.undoOperation(second.operationId);
		expect(await sourceById(source.id)).toMatchObject({
			intentionId: b.id,
			evidenceId: first.link.id,
			activationId: first.link.activationId,
			placementRevision: undone.operation.id
		});
		expect(await linkById(first.link.id)).toMatchObject({
			isDeleted: false,
			activationId: first.link.activationId,
			assessmentId: source.id
		});
		expect(await linkById(second.link.id)).toMatchObject({ isDeleted: true });
		// The restored row is the original activation, not a relink: no new source can be created for it.
		expect(await outcome(repo.createEvidenceAssessment(first.link.id, { open: true }))).toBe(
			'assessment_exists'
		);
	});
});
