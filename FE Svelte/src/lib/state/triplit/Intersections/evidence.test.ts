import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { RepositoryError } from '../Repository/errors';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import type { TraceAboutTime, TraceDraft } from '../types';

const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const dated: TraceAboutTime = {
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start: '2026-09-11',
	end: null
};

const draft = (
	content: string,
	relation: TraceDraft['relation'],
	aboutTime: TraceAboutTime = dated
): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	relation
});

const failure = async (
	promise: Promise<unknown>
): Promise<{ code: string; details: Record<string, unknown> } | string> => {
	try {
		await promise;
		return 'accepted';
	} catch (error) {
		return error instanceof RepositoryError
			? { code: error.code, details: error.details }
			: String(error);
	}
};

const setup = async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	const repository = createTriplitRepository(client);
	const intention = await repository.createTrace(draft('Взвеситься', 'intend'));
	const fact = await repository.createTrace(draft('80 кг', 'actual'));
	const snapshot = async () => ({
		links: await repository.listIntersections(true),
		logs: await repository.listLogs(),
		assessments: await repository.listIntentionAssessments(true)
	});
	return { client, repository, intention, fact, snapshot };
};

const evidence = (fromId: string, toId: string) => ({
	fromId,
	toId,
	kind: 'evidence_for' as const
});

it('refuses evidence links with wrong roles, missing, deleted or identical endpoints without writing', async () => {
	const { repository, intention, fact, snapshot } = await setup();
	const other = await repository.createTrace(draft('Другой факт', 'actual'));
	const plan = await repository.createTrace(draft('План', 'intend'));
	const legacy = await repository.createTrace(draft('Старая запись', 'observe'));
	await repository.setTraceDeleted(plan.id, true);
	const before = await snapshot();
	expect(await failure(repository.createIntersection(evidence(fact.id, other.id)))).toMatchObject({
		code: 'intention_role'
	});
	expect(await failure(repository.createIntersection(evidence(other.id, fact.id)))).toMatchObject({
		code: 'intention_role'
	});
	expect(await failure(repository.createIntersection(evidence(fact.id, fact.id)))).toMatchObject({
		code: 'evidence_endpoint'
	});
	expect(await failure(repository.createIntersection(evidence(fact.id, 'missing')))).toMatchObject({
		code: 'evidence_endpoint',
		details: { missingId: 'missing' }
	});
	expect(await failure(repository.linkTraceToTrace(other.id, fact.id))).toMatchObject({
		code: 'intention_role'
	});
	expect(
		await failure(repository.createIntersection(evidence(plan.id, intention.id)))
	).toMatchObject({
		code: 'evidence_endpoint',
		details: { deletedId: plan.id }
	});
	expect(await snapshot()).toEqual(before);
	await repository.setTraceDeleted(plan.id, false);
	expect(
		await failure(repository.createIntersection(evidence(plan.id, intention.id)))
	).toMatchObject({ code: 'fact_role' });
	// Legacy non-intend relations still count as facts.
	const link = await repository.createIntersection(evidence(legacy.id, intention.id));
	expect(link.fromId).toBe(legacy.id);
});

it('links an undated fact without an assessment and refuses the explicit assessment atomically', async () => {
	const { repository, intention, snapshot } = await setup();
	const undated = await repository.createTrace(draft('Когда-то', 'actual', { basis: 'unknown' }));
	const link = await repository.createIntersection(evidence(undated.id, intention.id));
	expect(link.isDeleted).toBe(false);
	const before = await snapshot();
	expect(
		await failure(repository.createEvidenceAssessment(link.id, { outcome: 'completed' }))
	).toMatchObject({
		code: 'fact_undated'
	});
	expect(await snapshot()).toEqual(before);
});

it('re-validates endpoints on restore and relink but not on withdrawal', async () => {
	const { client, repository, intention, fact, snapshot } = await setup();
	const link = await repository.createIntersection(evidence(fact.id, intention.id));
	await repository.setIntersectionDeleted(link.id, true);
	await repository.setTraceDeleted(fact.id, true);
	const before = await snapshot();
	expect(await failure(repository.setIntersectionDeleted(link.id, false))).toMatchObject({
		code: 'evidence_endpoint',
		details: { deletedId: fact.id }
	});
	expect(
		await failure(repository.createIntersection(evidence(fact.id, intention.id)))
	).toMatchObject({
		code: 'evidence_endpoint'
	});
	expect(await snapshot()).toEqual(before);
	await repository.setTraceDeleted(fact.id, false);
	// A role that changed while the link was withdrawn also blocks its restoration.
	await client.update('traces', intention.id, { relation: 'actual' });
	expect(await failure(repository.setIntersectionDeleted(link.id, false))).toMatchObject({
		code: 'intention_role'
	});
	await client.update('traces', intention.id, { relation: 'intend' });
	const { link: restored } = await repository.setIntersectionDeleted(link.id, false);
	expect(restored).toMatchObject({ isDeleted: false, activationId: link.activationId });
	// Scope memberships and composition keep their own rules.
	const scope = await repository.createScope({ name: 'Здоровье' });
	expect((await repository.linkTraceToScope(fact.id, scope.id)).kind).toBe('belongs_to');
	expect(
		(await repository.createIntersection({ fromId: fact.id, toId: intention.id, kind: 'part_of' }))
			.kind
	).toBe('part_of');
});

const relationBlock = async (
	repository: TempienceRepository,
	id: string,
	relation: TraceDraft['relation']
) => failure(repository.editTrace(id, { relation }));

it('blocks a relation change only while an active evidence link depends on the role', async () => {
	const { client, repository, intention, fact } = await setup();
	const link = await repository.createIntersection(evidence(fact.id, intention.id));
	const scope = await repository.createScope({ name: 'Здоровье' });
	await repository.linkTraceToScope(fact.id, scope.id);
	const whole = await repository.createTrace(draft('Целое', 'actual'));
	await repository.createIntersection({ fromId: fact.id, toId: whole.id, kind: 'part_of' });

	expect(await relationBlock(repository, fact.id, 'intend')).toEqual({
		code: 'relation_blocked',
		details: {
			reason: 'intention',
			linkId: link.id,
			endpointId: intention.id,
			direction: 'outgoing'
		}
	});
	expect(await relationBlock(repository, intention.id, 'actual')).toEqual({
		code: 'relation_blocked',
		details: { reason: 'fact', linkId: link.id, endpointId: fact.id, direction: 'incoming' }
	});
	// Other fields, a same-class relation and unrelated links stay editable.
	expect((await repository.editTrace(fact.id, { content: '81 кг' })).content).toBe('81 кг');
	expect((await repository.editTrace(fact.id, { relation: 'observe' })).relation).toBe('observe');
	expect((await repository.editTrace(intention.id, { relation: 'intend' })).relation).toBe(
		'intend'
	);

	await repository.setIntersectionDeleted(link.id, true);
	expect((await repository.editTrace(fact.id, { relation: 'intend' })).relation).toBe('intend');
	// The withdrawn link can no longer be restored: its endpoints would not be fact -> intention.
	expect(await failure(repository.setIntersectionDeleted(link.id, false))).toMatchObject({
		code: 'fact_role'
	});

	// A legacy invalid link (intention -> intention) never blocks unrelated editing.
	const plan = await repository.createTrace(draft('План', 'intend'));
	await client.insert('intersections', {
		id: `${plan.id}:${intention.id}:evidence_for`,
		fromId: plan.id,
		toId: intention.id,
		kind: 'evidence_for',
		isDeleted: false,
		createdAt: '2026-09-13T08:00:00.000Z',
		updatedAt: '2026-09-13T08:00:00.000Z'
	} as never);
	expect((await repository.editTrace(plan.id, { content: 'План на осень' })).content).toBe(
		'План на осень'
	);
	expect(
		(await repository.editTrace(plan.id, { aboutTime: { basis: 'unknown' } })).aboutTime
	).toEqual({
		basis: 'unknown'
	});
	expect((await repository.editTrace(plan.id, { relation: 'actual' })).relation).toBe('actual');
});
