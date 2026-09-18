import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factFor, intentionOf } from '$lib/state/TraceDraft/results.fixture';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

/** The operations the journal of one record knows, newest first. */
const operationsOf = async (id: string): Promise<string[]> => [
	...new Set((await fx.repository.listLogsFor([id])).map((log) => log.operationId))
];

describe('what a lifecycle command answers with', () => {
	it('names the operation of a deletion once, and none for the deletion of a deleted record', async () => {
		const plan = await intentionOf(fx, 'План');
		const journal = await operationsOf(plan.id);
		const first = await fx.repository.setTraceDeleted(plan.id, true, 'user');
		expect(first.trace.isDeleted).toBe(true);
		expect(first.operation).not.toBeNull();
		// Exactly one new operation, and it is the one the command named.
		expect(await operationsOf(plan.id)).toEqual([first.operation!.id, ...journal]);
		// The same command again — another device may already have done it — writes nothing,
		// so there is no operation of its own to name, least of all the earlier one.
		const again = await fx.repository.setTraceDeleted(plan.id, true, 'user');
		expect(again).toEqual({ trace: first.trace, operation: null });
		expect(await operationsOf(plan.id)).toEqual([first.operation!.id, ...journal]);
		// The way back is a new operation of its own, with its own cause.
		const back = await fx.repository.setTraceDeleted(plan.id, false, 'user');
		expect(back.operation?.id).not.toBe(first.operation!.id);
		expect((await fx.repository.listLogsFor([plan.id]))[0]).toMatchObject({
			operationId: back.operation!.id,
			cause: 'restore'
		});
	});

	it('names the operation of a withdrawal once, never the lifecycle of an earlier command', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		const link = fact.links[0];
		const withdrawn = await fx.repository.setIntersectionDeleted(link.id, true, 'user');
		expect(withdrawn.link.isDeleted).toBe(true);
		expect(withdrawn.operation?.id).toBe(withdrawn.link.lifecycleId);
		const again = await fx.repository.setIntersectionDeleted(link.id, true, 'user');
		// The row still carries the first withdrawal's lifecycle; the command does not claim it.
		expect(again.link.lifecycleId).toBe(withdrawn.link.lifecycleId);
		expect(again.operation).toBeNull();
		expect(await operationsOf(link.id)).toContain(withdrawn.operation!.id);
		expect((await operationsOf(link.id))[0]).toBe(withdrawn.operation!.id);
	});

	it('names a correction by its own operation, which the lifecycle stamp never carries', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'partial' });
		const source = fact.assessments[0];
		const corrected = await fx.repository.editIntentionAssessment(
			source.id,
			{ outcome: 'completed' },
			'user'
		);
		expect(corrected.operation).not.toBeNull();
		// The correction is a new operation of the statement's journal, and the row's lifecycle
		// stamp still names the creation: offering that one back would offer the wrong action.
		expect(corrected.operation!.id).toBe(corrected.assessment.outcomeRevision);
		expect(corrected.operation!.id).not.toBe(corrected.assessment.lifecycleId);
		expect((await operationsOf(source.id))[0]).toBe(corrected.operation!.id);
		// Saying again what the statement already says is not a correction.
		const same = await fx.repository.editIntentionAssessment(
			source.id,
			{ outcome: 'completed' },
			'user'
		);
		expect(same).toEqual({ assessment: corrected.assessment, operation: null });
		// A withdrawal names its operation; withdrawing a withdrawn statement names none.
		const withdrawn = await fx.repository.setIntentionAssessmentDeleted(source.id, true, 'user');
		expect(withdrawn.operation?.id).toBe(withdrawn.assessment.lifecycleId);
		expect(
			(await fx.repository.setIntentionAssessmentDeleted(source.id, true, 'user')).operation
		).toBeNull();
	});

	it('names no operation for a correction of the address that moved nothing', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		const journal = await operationsOf(fact.links[0].id);
		const same = await fx.repository.correctEvidenceTarget(fact.links[0].id, plan.id, 'user');
		expect(same.operation).toBeNull();
		expect(same.link.id).toBe(fact.links[0].id);
		expect(await operationsOf(fact.links[0].id)).toEqual(journal);
	});

	it('names the operation of a Scope deletion once, and none for a deleted Scope', async () => {
		const scope = await fx.repository.createScope({ name: 'Работа' });
		const deleted = await fx.repository.setScopeDeleted(scope.id, true, 'user');
		expect(deleted.scope.isDeleted).toBe(true);
		expect(deleted.scope.deletionOperationId).toBe(deleted.operation!.id);
		expect(await fx.repository.setScopeDeleted(scope.id, true, 'user')).toEqual({
			scope: deleted.scope,
			operation: null
		});
		expect((await fx.repository.setScopeDeleted(scope.id, false, 'user')).operation).not.toBeNull();
	});
});
