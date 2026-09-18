import { afterEach, expect, it } from 'vitest';
import { RepositoryError } from '../Repository/errors';
import { AI_WRITE_MESSAGE } from '../actor-guard';
import { asRepositoryClient } from '../repository';
import { createEvidenceAssessmentInTransaction } from './IntentionAssessments';
import { createAssessmentFixture, traceDraft, type AssessmentFixture } from './fixture';
import { assessmentIdFor } from './read';

const fixtures: AssessmentFixture[] = [];
const setup = async (): Promise<AssessmentFixture> => {
	const fixture = await createAssessmentFixture();
	fixtures.push(fixture);
	return fixture;
};
afterEach(async () => {
	for (const fixture of fixtures.splice(0)) await fixture.dispose();
});

const code = async (promise: Promise<unknown>): Promise<string | null> => {
	try {
		await promise;
		return null;
	} catch (error) {
		return error instanceof RepositoryError ? error.code : String(error);
	}
};

it('creates the first assessment of an evidence activation with only the explicit values', async () => {
	const { repository, link, fact, intention } = await setup();
	const assessment = await repository.createEvidenceAssessment(link.id, {
		outcome: 'partial',
		open: false
	});
	expect(assessment).toMatchObject({
		id: assessmentIdFor(link.activationId ?? ''),
		source: 'evidence',
		intentionId: intention.id,
		originIntentionId: intention.id,
		factId: fact.id,
		evidenceId: link.id,
		activationId: link.activationId,
		outcome: 'partial',
		open: false,
		isDeleted: false
	});
	const [log] = await repository.listLogs(assessment.id);
	expect(log).toMatchObject({ entityType: 'intentionAssessment', action: 'created' });
	expect(log.occurredAt).toBe(assessment.firstAssessedAt);
	expect(assessment.outcomeRevision).toBe(log.operationId);
	expect(assessment.openRevision).toBe(log.operationId);
	expect(await repository.listIntentionAssessments()).toEqual([assessment]);
});

it('refuses input without an explicit value, unknown features and invalid values', async () => {
	const { repository, link } = await setup();
	expect(await code(repository.createEvidenceAssessment(link.id, {}))).toBe('assessment_values');
	expect(await code(repository.createEvidenceAssessment(link.id, { outcome: null }))).toBe(
		'assessment_values'
	);
	expect(
		await code(repository.createEvidenceAssessment(link.id, { outcome: 'done' as never }))
	).toBe('assessment_values');
	expect(await code(repository.createEvidenceAssessment(link.id, { open: 'yes' as never }))).toBe(
		'assessment_values'
	);
	expect(await code(repository.createEvidenceAssessment(link.id, { rating: 5 } as never))).toBe(
		'assessment_values'
	);
	expect(await repository.listIntentionAssessments()).toEqual([]);
});

it('keeps one logical source per activation and points a second first assessment to editing', async () => {
	const { repository, link } = await setup();
	await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	expect(await code(repository.createEvidenceAssessment(link.id, { open: true }))).toBe(
		'assessment_exists'
	);
	expect(await repository.listIntentionAssessments()).toHaveLength(1);
});

it('requires an active evidence link, roles and a dated fact', async () => {
	const { repository, client, link, fact, intention } = await setup();
	const part = await repository.createIntersection({
		fromId: fact.id,
		toId: intention.id,
		kind: 'part_of'
	});
	expect(await code(repository.createEvidenceAssessment(part.id, { open: false }))).toBe(
		'evidence_kind'
	);
	const undated = await repository.createTrace(
		traceDraft('Без даты', 'actual', { basis: 'unknown' })
	);
	const undatedLink = await repository.createIntersection({
		fromId: undated.id,
		toId: intention.id,
		kind: 'evidence_for'
	});
	expect(await code(repository.createEvidenceAssessment(undatedLink.id, { open: false }))).toBe(
		'fact_undated'
	);
	// Roles are enforced when the link is made; a legacy invalid link still refuses assessment.
	const other = await repository.createTrace(traceDraft('Другой факт', 'actual'));
	expect(
		await code(
			repository.createIntersection({ fromId: fact.id, toId: other.id, kind: 'evidence_for' })
		)
	).toBe('intention_role');
	const plan = await repository.createTrace(traceDraft('План', 'intend'));
	expect(
		await code(
			repository.createIntersection({ fromId: plan.id, toId: intention.id, kind: 'evidence_for' })
		)
	).toBe('fact_role');
	const legacyInvalid = `${plan.id}:${intention.id}:evidence_for`;
	await client.insert('intersections', {
		id: legacyInvalid,
		fromId: plan.id,
		toId: intention.id,
		kind: 'evidence_for',
		isDeleted: false,
		createdAt: '2026-09-13T08:00:00.000Z',
		updatedAt: '2026-09-13T08:00:00.000Z'
	} as never);
	expect(await code(repository.createEvidenceAssessment(legacyInvalid, { open: false }))).toBe(
		'fact_role'
	);
	await repository.setIntersectionDeleted(link.id, true);
	expect(await code(repository.createEvidenceAssessment(link.id, { open: false }))).toBe(
		'evidence_inactive'
	);
	await repository.setIntersectionDeleted(link.id, false);
	await repository.setTraceDeleted(fact.id, true);
	expect(await code(repository.createEvidenceAssessment(link.id, { open: false }))).toBe(
		'fact_deleted'
	);
	await repository.setTraceDeleted(fact.id, false);
	await repository.setTraceDeleted(intention.id, true);
	expect(await code(repository.createEvidenceAssessment(link.id, { open: false }))).toBe(
		'intention_deleted'
	);
	expect(await repository.listIntentionAssessments()).toEqual([]);
});

it('edits only the given features, keeps the first time and records each revision', async () => {
	const { repository, link } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, {
		outcome: 'partial',
		open: false
	});
	const { assessment: edited } = await repository.editIntentionAssessment(created.id, {
		outcome: 'completed'
	});
	expect(edited).toMatchObject({
		outcome: 'completed',
		open: false,
		openRevision: created.openRevision,
		firstAssessedAt: created.firstAssessedAt
	});
	expect(edited.outcomeRevision).not.toBe(created.outcomeRevision);
	const [updateLog] = await repository.listLogs(created.id);
	expect(updateLog).toMatchObject({
		action: 'updated',
		operationId: edited.outcomeRevision,
		patch: { outcome: { before: 'partial', after: 'completed' } }
	});
	expect(Object.keys(updateLog.patch)).toEqual(['outcome', 'outcomeRevision']);
	// Repeating the current value changes nothing, adds no journal entry and names no operation.
	expect(await repository.editIntentionAssessment(created.id, { outcome: 'completed' })).toEqual({
		assessment: edited,
		operation: null
	});
	expect(await repository.listLogs(created.id)).toHaveLength(2);
	const { assessment: cleared } = await repository.editIntentionAssessment(created.id, {
		open: null
	});
	expect(cleared).toMatchObject({ outcome: 'completed', open: null });
	expect(cleared.openRevision).not.toBe(created.openRevision);
	expect((await repository.listLogs(created.id))[0].patch).toEqual({
		open: { before: false, after: null },
		openRevision: { before: expect.any(String), after: cleared.openRevision }
	});
	expect(await code(repository.editIntentionAssessment(created.id, { open: 'no' as never }))).toBe(
		'assessment_values'
	);
	expect(await repository.listIntentionAssessments()).toEqual([cleared]);
});

it('records a direct assessment as its own source with the action time', async () => {
	const { repository, intention, fact } = await setup();
	const direct = await repository.createDirectAssessment(intention.id, { open: false });
	expect(direct).toMatchObject({
		source: 'direct',
		intentionId: intention.id,
		factId: null,
		evidenceId: null,
		activationId: null,
		outcome: null,
		open: false
	});
	const [log] = await repository.listLogs(direct.id);
	expect(log.occurredAt).toBe(direct.firstAssessedAt);
	const second = await repository.createDirectAssessment(intention.id, { outcome: 'alternative' });
	expect(second.id).not.toBe(direct.id);
	expect(await code(repository.createDirectAssessment(fact.id, { open: false }))).toBe(
		'intention_role'
	);
	expect(await code(repository.createDirectAssessment(intention.id, {}))).toBe('assessment_values');
});

it('withdraws and restores a source without losing its first time', async () => {
	const { repository, link } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, { outcome: 'not_completed' });
	const { assessment: deleted } = await repository.setIntentionAssessmentDeleted(created.id, true);
	expect(deleted).toMatchObject({ isDeleted: true, firstAssessedAt: created.firstAssessedAt });
	expect(deleted.lifecycleId).not.toBe(created.lifecycleId);
	expect(await code(repository.editIntentionAssessment(created.id, { open: true }))).toBe(
		'assessment_deleted'
	);
	expect(await repository.listIntentionAssessments()).toEqual([]);
	expect(await repository.listIntentionAssessments(true)).toEqual([deleted]);
	// Withdrawing a withdrawn statement is nothing: the same row, and no operation to name.
	expect(await repository.setIntentionAssessmentDeleted(created.id, true)).toEqual({
		assessment: deleted,
		operation: null
	});
	const { assessment: restored } = await repository.setIntentionAssessmentDeleted(
		created.id,
		false
	);
	expect(restored).toMatchObject({ isDeleted: false, outcome: 'not_completed' });
	const logs = await repository.listLogs(created.id);
	expect(logs.map((log) => [log.action, log.cause])).toEqual([
		['restored', 'restore'],
		['deleted', 'normal'],
		['created', 'normal']
	]);
});

it('revives the same logical source after withdrawal and keeps the earliest first time', async () => {
	const { repository, link } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, { outcome: 'partial' });
	await repository.setIntentionAssessmentDeleted(created.id, true);
	const revived = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	expect(revived).toMatchObject({
		id: created.id,
		isDeleted: false,
		outcome: 'completed',
		firstAssessedAt: created.firstAssessedAt
	});
	expect(revived.updatedAt > created.updatedAt).toBe(true);
	expect((await repository.listLogs(created.id))[0]).toMatchObject({
		action: 'restored',
		cause: 'normal',
		patch: {
			isDeleted: { before: true, after: false },
			outcome: { before: 'partial', after: 'completed' }
		}
	});
});

it('refuses AI writes on every assessment command', async () => {
	const { repository, link, intention } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, { open: true });
	// The guard refuses before any transaction starts, so the refusal is synchronous.
	expect(() => repository.createEvidenceAssessment(link.id, { open: true }, 'ai')).toThrow(
		AI_WRITE_MESSAGE
	);
	expect(() => repository.createDirectAssessment(intention.id, { open: true }, 'ai')).toThrow(
		AI_WRITE_MESSAGE
	);
	expect(() => repository.editIntentionAssessment(created.id, { open: false }, 'ai')).toThrow(
		AI_WRITE_MESSAGE
	);
	expect(() => repository.setIntentionAssessmentDeleted(created.id, true, 'ai')).toThrow(
		AI_WRITE_MESSAGE
	);
	expect(await repository.listLogs(created.id)).toHaveLength(1);
});

it('joins a compound operation: one operationId and time for the whole transaction', async () => {
	const { client, repository, link } = await setup();
	const operation = { id: 'op-compound', timestamp: '2026-09-13T09:00:00.000Z' };
	const assessment = await asRepositoryClient(client).transact((transaction) =>
		createEvidenceAssessmentInTransaction(transaction, link.id, { open: false }, 'user', operation)
	);
	expect(assessment).toMatchObject({
		firstAssessedAt: operation.timestamp,
		openRevision: operation.id,
		updatedAt: operation.timestamp
	});
	expect((await repository.listLogs(assessment.id))[0]).toMatchObject({
		operationId: operation.id,
		occurredAt: operation.timestamp
	});
});

it('delivers normalized rows through the subscription after the readiness check', async () => {
	const { repository, link } = await setup();
	const snapshots: unknown[][] = [];
	const unsubscribe = repository.subscribeIntentionAssessments(
		(rows) => snapshots.push(rows),
		(error) => {
			throw error;
		}
	);
	try {
		const created = await repository.createEvidenceAssessment(link.id, { open: false });
		await expect.poll(() => snapshots.at(-1)?.length ?? 0, { timeout: 5000 }).toBe(1);
		expect(snapshots.at(-1)).toEqual([created]);
	} finally {
		unsubscribe();
	}
});

it('sorts the list by first time, newest first, independent of edits', async () => {
	const { repository, link, intention } = await setup();
	const first = await repository.createEvidenceAssessment(link.id, { open: false });
	const later = await repository.createDirectAssessment(intention.id, { open: true });
	await repository.editIntentionAssessment(first.id, { outcome: 'completed' });
	expect((await repository.listIntentionAssessments()).map((row) => row.id)).toEqual([
		later.id,
		first.id
	]);
});
