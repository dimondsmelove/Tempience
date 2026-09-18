import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { RepositoryError } from '../Repository/errors';
import {
	asRepositoryClient,
	createTriplitRepository,
	type TempienceRepository
} from '../repository';
import { schema } from '../schema';
import type { Intersection, Trace, TraceAboutTime, TraceDraft } from '../types';
import { createEvidenceAssessmentInTransaction } from './IntentionAssessments';
import { createIntersectionInTransaction } from '../Intersections/Intersections';
import { linkSourceId } from './binding';
import { assessmentIdFor } from './read';
import { evaluateIntention, type IntentionResult } from './result';

const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const day = (start: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end: null
});

const draft = (
	content: string,
	relation: 'intend' | 'actual',
	aboutTime: TraceAboutTime = day('2026-09-11')
): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	relation
});

const code = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
		return 'accepted';
	} catch (error) {
		return error instanceof RepositoryError ? error.code : String(error);
	}
};

const evaluate = async (
	repository: TempienceRepository,
	intentionId: string
): Promise<IntentionResult> =>
	evaluateIntention(intentionId, await repository.listIntentionAssessments(true), {
		tracesById: new Map<string, Trace>(
			(await repository.listTraces(true)).map((row) => [row.id, row])
		),
		intersectionsById: new Map<string, Intersection>(
			(await repository.listIntersections(true)).map((row) => [row.id, row])
		)
	});

const setup = async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	const repository = createTriplitRepository(client);
	const a = await repository.createTrace(draft('A', 'intend'));
	const b = await repository.createTrace(draft('B', 'intend'));
	const scope = await repository.createScope({ name: 'Здоровье' });
	const f = await repository.createTraceWithScope(draft('F', 'actual'), scope.id);
	const link = (fact: Trace, intention: Trace) =>
		repository.createIntersection({ fromId: fact.id, toId: intention.id, kind: 'evidence_for' });
	const snapshot = async () => ({
		links: await repository.listIntersections(true),
		assessments: await repository.listIntentionAssessments(true),
		logs: await repository.listLogs(),
		traces: await repository.listTraces(true)
	});
	return { client, repository, a, b, f, scope, link, snapshot };
};

it('moves the link and its own source to the corrected intention as one operation (P3)', async () => {
	const { repository, a, b, f, link, snapshot } = await setup();
	const g = await repository.createTrace(draft('G', 'actual'));
	const fa = await link(f, a);
	const fSource = await repository.createEvidenceAssessment(fa.id, {
		outcome: 'completed',
		open: false
	});
	const gb = await link(g, b);
	const gSource = await repository.createEvidenceAssessment(gb.id, { outcome: 'partial' });
	const factBefore = (await snapshot()).traces.find((row) => row.id === f.id);
	const membershipsBefore = (await repository.listIntersections()).filter(
		(row) => row.kind === 'belongs_to'
	);

	const { link: fb, assessment } = await repository.correctEvidenceTarget(fa.id, b.id);
	expect(fb).toMatchObject({
		fromId: f.id,
		toId: b.id,
		kind: 'evidence_for',
		isDeleted: false,
		assessmentId: fSource.id
	});
	expect(fb.activationId).not.toBe(fa.activationId);
	expect(assessment).toMatchObject({
		id: fSource.id,
		intentionId: b.id,
		originIntentionId: a.id,
		evidenceId: fb.id,
		activationId: fb.activationId,
		outcome: 'completed',
		open: false,
		firstAssessedAt: fSource.firstAssessedAt,
		outcomeRevision: fSource.outcomeRevision,
		openRevision: fSource.openRevision
	});
	expect(assessment?.placementRevision).toBe(assessment?.lifecycleId);
	expect(await repository.getTrace(f.id)).toEqual(factBefore);
	expect((await repository.listIntersections()).filter((row) => row.kind === 'belongs_to')).toEqual(
		membershipsBefore
	);
	const old = (await repository.listIntersections(true)).find((row) => row.id === fa.id);
	expect(old).toMatchObject({ isDeleted: true, lifecycleId: assessment?.lifecycleId });
	expect(fb.lifecycleId).toBe(assessment?.lifecycleId);
	const group = (await repository.listLogs()).filter(
		(log) => log.operationId === assessment?.lifecycleId
	);
	expect(group.map((log) => [log.entityType, log.action]).toSorted()).toEqual([
		['intentionAssessment', 'updated'],
		['intersection', 'deleted'],
		['intersection', 'linked']
	]);
	expect(group.every((log) => log.occurredAt === group[0].occurredAt)).toBe(true);
	expect(group.find((log) => log.entityType === 'intentionAssessment')?.patch).toMatchObject({
		intentionId: { before: a.id, after: b.id },
		evidenceId: { before: fa.id, after: fb.id }
	});

	// A recomputes from what remains; B keeps the newer G because F's first time stays earlier.
	expect(await evaluate(repository, a.id)).toMatchObject({
		outcome: { value: null },
		open: { value: true }
	});
	const onB = await evaluate(repository, b.id);
	expect(onB.outcome).toEqual({ value: 'partial', sourceId: gSource.id });
	expect(onB.open).toEqual({ value: false, sourceId: fSource.id });
	expect(onB.sources.map((source) => source.assessment.id)).toEqual([fSource.id, gSource.id]);
	// Correcting F's values afterwards edits the moved source without moving its first time.
	const { assessment: corrected } = await repository.editIntentionAssessment(fSource.id, {
		outcome: 'alternative'
	});
	expect(corrected).toMatchObject({ intentionId: b.id, firstAssessedAt: fSource.firstAssessedAt });
	expect((await evaluate(repository, b.id)).outcome.sourceId).toBe(gSource.id);
});

it('refuses when the target link is already active (P2), with or without an assessment', async () => {
	const { repository, a, b, f, link, snapshot } = await setup();
	const fa = await link(f, a);
	await repository.createEvidenceAssessment(fa.id, { outcome: 'completed' });
	const fb = await link(f, b);
	const before = await snapshot();
	expect(await code(repository.correctEvidenceTarget(fa.id, b.id))).toBe('target_linked');
	expect(await snapshot()).toEqual(before);
	await repository.createEvidenceAssessment(fb.id, { open: false });
	const withAssessment = await snapshot();
	expect(await code(repository.correctEvidenceTarget(fa.id, b.id))).toBe('target_linked');
	expect(await snapshot()).toEqual(withAssessment);
	// Same target is a no-op; withdrawn, foreign or missing links are refused explicitly.
	expect(await repository.correctEvidenceTarget(fa.id, a.id)).toMatchObject({
		link: { id: fa.id }
	});
	expect(await snapshot()).toEqual(withAssessment);
	await repository.setIntersectionDeleted(fb.id, true);
	expect(await code(repository.correctEvidenceTarget(fb.id, a.id))).toBe('evidence_inactive');
	expect(await code(repository.correctEvidenceTarget('missing', a.id))).toMatch('not found');
	const other = await repository.createTrace(draft('Other', 'actual'));
	expect(await code(repository.correctEvidenceTarget(fa.id, other.id))).toBe('intention_role');
	expect(await code(repository.correctEvidenceTarget(fa.id, f.id))).toBe('evidence_endpoint');
});

it('transfers onto a previously withdrawn target and leaves its historical source detached', async () => {
	const { repository, a, b, f, link } = await setup();
	const fbOld = await link(f, b);
	const oldSource = await repository.createEvidenceAssessment(fbOld.id, { outcome: 'alternative' });
	await repository.setIntersectionDeleted(fbOld.id, true);
	const fa = await link(f, a);
	const moved = await repository.createEvidenceAssessment(fa.id, { outcome: 'completed' });

	const { link: fb, assessment } = await repository.correctEvidenceTarget(fa.id, b.id);
	expect(fb.id).toBe(fbOld.id);
	expect(fb.activationId).not.toBe(fbOld.activationId);
	expect(linkSourceId(fb)).toBe(moved.id);
	expect(assessment?.id).toBe(moved.id);
	const onB = await evaluate(repository, b.id);
	expect(onB.outcome).toEqual({ value: 'completed', sourceId: moved.id });
	expect(onB.sources.map((source) => [source.assessment.id, source.eligibility])).toEqual([
		[moved.id, { eligible: true }],
		[oldSource.id, { eligible: false, reason: 'activation_mismatch' }]
	]);
	// The current link now edits the transferred source; a new first assessment is refused.
	expect(await code(repository.createEvidenceAssessment(fb.id, { open: false }))).toBe(
		'assessment_exists'
	);
	const { assessment: edited } = await repository.editIntentionAssessment(moved.id, { open: true });
	expect(edited).toMatchObject({ id: moved.id, intentionId: b.id, open: true });
	expect((await evaluate(repository, b.id)).open).toEqual({ value: true, sourceId: moved.id });

	// The same resolver serves withdrawal, restore, fresh relink and fact eligibility.
	await repository.setIntersectionDeleted(fb.id, true);
	expect((await evaluate(repository, b.id)).sources[0].eligibility).toEqual({
		eligible: false,
		reason: 'link_inactive'
	});
	const { link: restored } = await repository.setIntersectionDeleted(fb.id, false);
	expect(restored).toMatchObject({ activationId: fb.activationId, assessmentId: moved.id });
	expect((await evaluate(repository, b.id)).outcome.sourceId).toBe(moved.id);
	await repository.setIntersectionDeleted(fb.id, true);
	const fresh = await repository.createIntersection({
		fromId: f.id,
		toId: b.id,
		kind: 'evidence_for'
	});
	expect(fresh.assessmentId).toBeNull();
	expect(linkSourceId(fresh)).toBe(assessmentIdFor(fresh.activationId ?? ''));
	const afterRelink = await evaluate(repository, b.id);
	expect(afterRelink.outcome.sourceId).toBeNull();
	expect(
		afterRelink.sources.find((source) => source.assessment.id === moved.id)?.eligibility
	).toEqual({
		eligible: false,
		reason: 'activation_mismatch'
	});
	const renewed = await repository.createEvidenceAssessment(fresh.id, { outcome: 'partial' });
	expect(renewed.id).toBe(assessmentIdFor(fresh.activationId ?? ''));
	expect((await evaluate(repository, b.id)).outcome.sourceId).toBe(renewed.id);
	await repository.editTrace(f.id, { aboutTime: { basis: 'unknown' } });
	expect((await evaluate(repository, b.id)).sources[0].eligibility).toEqual({
		eligible: false,
		reason: 'fact_undated'
	});
	await repository.editTrace(f.id, { aboutTime: day('2026-09-11') });
	await repository.setTraceDeleted(f.id, true);
	expect((await evaluate(repository, b.id)).sources[0].eligibility).toEqual({
		eligible: false,
		reason: 'fact_deleted'
	});
});

it('transfers an empty link without inventing a source and refuses a missing bound source', async () => {
	const { client, repository, a, b, f, link } = await setup();
	const fa = await link(f, a);
	const logs = (await repository.listLogs()).length;
	const { link: fb, assessment } = await repository.correctEvidenceTarget(fa.id, b.id);
	expect(assessment).toBeNull();
	expect(fb.assessmentId).toBeNull();
	expect(await repository.listIntentionAssessments(true)).toEqual([]);
	expect((await repository.listLogs()).length).toBe(logs + 2);
	// A binding whose source is not present is unavailable, never replaced by a new first row.
	await client.update('intersections', fb.id, { assessmentId: 'assessment:missing' });
	expect(await code(repository.createEvidenceAssessment(fb.id, { open: false }))).toBe(
		'source_unavailable'
	);
	expect(await code(repository.correctEvidenceTarget(fb.id, a.id))).toBe('source_unavailable');
	expect(await repository.listIntentionAssessments(true)).toEqual([]);
});

it('keeps sibling links of one operation and independent direct closures untouched', async () => {
	const { client, repository, a, b, f, snapshot } = await setup();
	const c = await repository.createTrace(draft('C', 'intend'));
	const operation = { id: 'op-multi', timestamp: '2026-09-13T09:00:00.000Z' };
	const { fa, fb } = await asRepositoryClient(client).transact(async (transaction) => {
		const fa = await createIntersectionInTransaction(
			transaction,
			{ fromId: f.id, toId: a.id, kind: 'evidence_for' },
			'user',
			operation
		);
		const fb = await createIntersectionInTransaction(
			transaction,
			{ fromId: f.id, toId: b.id, kind: 'evidence_for' },
			'user',
			operation
		);
		await createEvidenceAssessmentInTransaction(
			transaction,
			fa.id,
			{ outcome: 'completed' },
			'user',
			operation
		);
		await createEvidenceAssessmentInTransaction(
			transaction,
			fb.id,
			{ outcome: 'partial', open: false },
			'user',
			operation
		);
		return { fa, fb };
	});
	expect(fa.activationId).not.toBe(fb.activationId);
	const closure = await repository.createDirectAssessment(b.id, { open: false });
	const bSourceBefore = (await snapshot()).assessments.find(
		(row) => row.id === assessmentIdFor(fb.activationId ?? '')
	);

	await repository.correctEvidenceTarget(fa.id, c.id);
	const bSourceAfter = (await snapshot()).assessments.find(
		(row) => row.id === assessmentIdFor(fb.activationId ?? '')
	);
	expect(bSourceAfter).toEqual(bSourceBefore);
	expect((await evaluate(repository, c.id)).outcome).toEqual({
		value: 'completed',
		sourceId: assessmentIdFor(fa.activationId ?? '')
	});
	expect((await evaluate(repository, b.id)).outcome.sourceId).toBe(bSourceBefore?.id);
	await repository.editIntentionAssessment(assessmentIdFor(fa.activationId ?? ''), { open: true });
	expect((await snapshot()).assessments.find((row) => row.id === bSourceBefore?.id)).toEqual(
		bSourceBefore
	);
	await repository.setIntersectionDeleted(fb.id, true);
	expect(await evaluate(repository, b.id)).toMatchObject({
		outcome: { value: null },
		open: { value: false, sourceId: closure.id }
	});
});

it('refuses to act through a stale link whose source now belongs to another link', async () => {
	const { repository, a, b, f, link, snapshot } = await setup();
	const c = await repository.createTrace(draft('C', 'intend'));
	const d = await repository.createTrace(draft('D', 'intend'));
	const fa = await link(f, a);
	const source = await repository.createEvidenceAssessment(fa.id, {
		outcome: 'completed',
		open: false
	});
	const { link: fb } = await repository.correctEvidenceTarget(fa.id, b.id);
	const { link: fc } = await repository.correctEvidenceTarget(fb.id, c.id);
	// Ordinary restore keeps the old B link's activation and binding: it now points at C's source.
	await repository.setIntersectionDeleted(fb.id, false);
	const before = await snapshot();
	const onC = await evaluate(repository, c.id);
	expect(onC.outcome).toEqual({ value: 'completed', sourceId: source.id });

	expect(await code(repository.correctEvidenceTarget(fb.id, d.id))).toBe('source_detached');
	expect(await code(repository.correctEvidenceTarget(fb.id, b.id))).toBe('source_detached');
	expect(await code(repository.createEvidenceAssessment(fb.id, { outcome: 'partial' }))).toBe(
		'source_detached'
	);
	expect(await snapshot()).toEqual(before);
	expect(await evaluate(repository, c.id)).toEqual(onC);
	// The stale link shows the detachment; the current link still owns the source.
	const stale = (await evaluate(repository, b.id)).sources.find(
		(entry) => entry.assessment.id === source.id
	);
	expect(stale).toBeUndefined();
	expect((await evaluate(repository, c.id)).sources[0].eligibility).toEqual({ eligible: true });

	// An explicitly withdrawn source at C cannot be revived through the stale link either.
	await repository.setIntentionAssessmentDeleted(source.id, true);
	const withdrawn = await snapshot();
	expect(await code(repository.createEvidenceAssessment(fb.id, { outcome: 'partial' }))).toBe(
		'source_detached'
	);
	expect(await snapshot()).toEqual(withdrawn);
	expect(
		(await repository.listIntentionAssessments(true)).find((row) => row.id === source.id)
	).toMatchObject({
		isDeleted: true,
		intentionId: c.id,
		outcome: 'completed'
	});
	await repository.setIntentionAssessmentDeleted(source.id, false);

	// The restored original link resolves its deterministic source id to the same moved source.
	await repository.setIntersectionDeleted(fa.id, false);
	const restoredOriginal = await snapshot();
	expect(await code(repository.correctEvidenceTarget(fa.id, d.id))).toBe('source_detached');
	expect(await code(repository.createEvidenceAssessment(fa.id, { open: true }))).toBe(
		'source_detached'
	);
	expect(await snapshot()).toEqual(restoredOriginal);

	// The legitimate current link still moves its source even while the fact has no date.
	await repository.editTrace(f.id, { aboutTime: { basis: 'unknown' } });
	expect((await evaluate(repository, c.id)).sources[0].eligibility).toEqual({
		eligible: false,
		reason: 'fact_undated'
	});
	await repository.setIntersectionDeleted(fa.id, true);
	await repository.setIntersectionDeleted(fb.id, true);
	const { link: fd, assessment: moved } = await repository.correctEvidenceTarget(fc.id, d.id);
	expect(moved).toMatchObject({
		id: source.id,
		intentionId: d.id,
		firstAssessedAt: source.firstAssessedAt
	});
	expect(fd.assessmentId).toBe(source.id);
	expect((await evaluate(repository, d.id)).sources[0].eligibility).toEqual({
		eligible: false,
		reason: 'fact_undated'
	});
	await repository.editTrace(f.id, { aboutTime: day('2026-09-11') });
	expect((await evaluate(repository, d.id)).outcome).toEqual({
		value: 'completed',
		sourceId: source.id
	});
});
