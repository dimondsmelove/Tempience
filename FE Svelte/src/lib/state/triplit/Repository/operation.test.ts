import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { createEvidenceAssessmentInTransaction } from '../IntentionAssessments/IntentionAssessments';
import { assessmentIdFor } from '../IntentionAssessments/read';
import { createIntersectionInTransaction } from '../Intersections/Intersections';
import { createTraceInTransaction } from '../Traces/create';
import { editTraceInTransaction, setTraceDeletedInTransaction } from '../Traces/edit';
import { asRepositoryClient, createTriplitRepository } from '../repository';
import { schema } from '../schema';
import type { TraceDraft } from '../types';
import type { Operation } from './transaction';

const clients: TriplitClient<typeof schema>[] = [];
const createClient = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return client;
};
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const draft = (content: string, relation: 'intend' | 'actual'): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	},
	relation
});

const operation: Operation = { id: 'op-compound-1', timestamp: '2026-09-13T09:00:00.000Z' };

it('shares one operation across Trace, membership, evidence link, assessment and their journal', async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const scope = await repository.createScope({ name: 'Здоровье' });
	const intention = await repository.createTrace(draft('Взвеситься', 'intend'));
	const logsBefore = (await repository.listLogs()).length;

	const { fact, link, assessment } = await asRepositoryClient(client).transact(
		async (transaction) => {
			const fact = await createTraceInTransaction(
				transaction,
				draft('80 кг', 'actual'),
				[scope.id],
				'user',
				operation
			);
			const link = await createIntersectionInTransaction(
				transaction,
				{ fromId: fact.id, toId: intention.id, kind: 'evidence_for' },
				'user',
				operation
			);
			const assessment = await createEvidenceAssessmentInTransaction(
				transaction,
				link.id,
				{ outcome: 'completed', open: false },
				'user',
				operation
			);
			return { fact, link, assessment };
		}
	);

	const logs = (await repository.listLogs()).filter((log) => log.operationId === operation.id);
	expect(logs.map((log) => [log.entityType, log.action]).toSorted()).toEqual([
		['intentionAssessment', 'created'],
		['intersection', 'linked'],
		['intersection', 'linked'],
		['trace', 'created']
	]);
	expect(logs.every((log) => log.occurredAt === operation.timestamp)).toBe(true);
	expect((await repository.listLogs()).length).toBe(logsBefore + 4);

	// Operation identity is not entity, activation or first-assessment identity.
	expect(fact.id).not.toBe(operation.id);
	expect(fact.createdAt).toBe(operation.timestamp);
	expect(link.activationId).not.toBe(operation.id);
	expect(link.lifecycleId).toBe(operation.id);
	expect(assessment.id).toBe(assessmentIdFor(link.activationId ?? ''));
	expect(assessment.firstAssessedAt).toBe(operation.timestamp);
	const membership = (await repository.listIntersections()).find((row) => row.toId === scope.id);
	expect(membership).toMatchObject({
		fromId: fact.id,
		kind: 'belongs_to',
		lifecycleId: operation.id
	});
	expect(membership?.activationId).not.toBe(link.activationId);
	expect(new Set([fact.id, link.id, membership?.id, assessment.id, operation.id]).size).toBe(5);
	expect(await repository.getTrace(fact.id)).toEqual(fact);
});

it('leaves no partial rows or journal when a compound operation fails', async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const scope = await repository.createScope({ name: 'Здоровье' });
	const intention = await repository.createTrace(draft('Взвеситься', 'intend'));
	const before = {
		traces: await repository.listTraces(true),
		intersections: await repository.listIntersections(true),
		assessments: await repository.listIntentionAssessments(true),
		logs: await repository.listLogs()
	};
	await expect(
		asRepositoryClient(client).transact(async (transaction) => {
			const fact = await createTraceInTransaction(
				transaction,
				draft('80 кг', 'actual'),
				[scope.id],
				'user',
				operation
			);
			const link = await createIntersectionInTransaction(
				transaction,
				{ fromId: fact.id, toId: intention.id, kind: 'evidence_for' },
				'user',
				operation
			);
			await createEvidenceAssessmentInTransaction(
				transaction,
				link.id,
				{ open: true },
				'user',
				operation
			);
			throw new Error('validation failed after every write');
		})
	).rejects.toThrow('validation failed');
	expect(await repository.listTraces(true)).toEqual(before.traces);
	expect(await repository.listIntersections(true)).toEqual(before.intersections);
	expect(await repository.listIntentionAssessments(true)).toEqual(before.assessments);
	expect(await repository.listLogs()).toEqual(before.logs);
});

it('keeps standalone commands on their own fresh operations while edits and lifecycle accept a shared one', async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const scope = await repository.createScope({ name: 'Здоровье' });
	const trace = await repository.createTraceWithScope(draft('Прогулка', 'actual'), scope.id);
	const [membershipLog, createdLog] = await repository
		.listLogs(trace.id)
		.then(async (own) => [
			(await repository.listLogs()).find(
				(log) => log.entityType === 'intersection' && log.entityId.startsWith(trace.id)
			),
			own[0]
		]);
	expect(createdLog?.operationId).toBe(membershipLog?.operationId);
	expect(createdLog?.occurredAt).toBe(membershipLog?.occurredAt);
	expect(createdLog?.operationId).not.toBe(trace.id);

	const first = await repository.editTrace(trace.id, { content: 'Прогулка утром' });
	const second = await repository.editTrace(trace.id, { content: 'Прогулка вечером' });
	const [secondLog, firstLog] = await repository.listLogs(trace.id);
	expect(firstLog.operationId).not.toBe(secondLog.operationId);
	expect(first.updatedAt < second.updatedAt).toBe(true);

	const shared: Operation = { id: 'op-shared-edit', timestamp: '2026-09-13T10:00:00.000Z' };
	await asRepositoryClient(client).transact(async (transaction) => {
		await editTraceInTransaction(
			transaction,
			trace.id,
			{ content: 'Прогулка ночью' },
			'user',
			shared
		);
		await setTraceDeletedInTransaction(transaction, trace.id, true, 'user', shared);
	});
	const sharedLogs = (await repository.listLogs(trace.id)).filter(
		(log) => log.operationId === shared.id
	);
	expect(sharedLogs.map((log) => log.action).toSorted()).toEqual(['deleted', 'updated']);
	expect(sharedLogs.every((log) => log.occurredAt === shared.timestamp)).toBe(true);
	expect((await repository.listTraces(true)).find((row) => row.id === trace.id)).toMatchObject({
		content: 'Прогулка ночью',
		isDeleted: true,
		updatedAt: shared.timestamp
	});
});
