import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import { asRepositoryClient } from '../Repository/client';
import type { RepositoryClient } from '../Repository/types';
import { createUndoRepository } from './Undo';
import {
	journalOf,
	openRecordFixture,
	outcome,
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

const membershipsOf = async (kindId: string) =>
	(await repo.listIntersections(true))
		.filter((row) => row.fromId === kindId && row.kind === 'belongs_to')
		.map((row) => [row.toId, row.isDeleted, row.scopeDeletionOperationId] as const)
		.toSorted();

const scene = async () => {
	const { kind } = await repo.createTraceKind({
		name: 'Замер',
		initialKindV: { dataSchema: { type: 'object', properties: {} } }
	});
	const a = await repo.createScope({ name: 'A' });
	const b = await repo.createScope({ name: 'B' });
	const c = await repo.createScope({ name: 'C' });
	await repo.setTraceKindScopes(kind.id, [a.id, b.id]);
	await repo.setScopeDeleted(a.id, true);
	const deletion = (await repo.listLogs(a.id))[0].operationId;
	return { kind, a, b, c, deletion };
};

describe('undoOperation — Scope deletion', () => {
	it('restores the Scope with the memberships it hid, leaving a rename and other memberships alone', async () => {
		open();
		const { kind, a, b, c, deletion } = await scene();
		expect(await membershipsOf(kind.id)).toEqual(
			[
				[a.id, true, deletion],
				[b.id, false, null]
			].toSorted()
		);
		await repo.editTraceKind(kind.id, 'Масса');
		await repo.setTraceKindScopes(kind.id, [b.id, c.id]);
		const undone = await repo.undoOperation(deletion);
		expect(undone.plan.steps).toEqual([{ kind: 'scope.lifecycle', scopeId: a.id }]);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intersection:restored:undo',
			'scope:restored:undo'
		]);
		expect((await repo.listScopes()).map((scope) => scope.id).toSorted()).toEqual(
			[a.id, b.id, c.id].toSorted()
		);
		expect(await membershipsOf(kind.id)).toEqual(
			[
				[a.id, false, null],
				[b.id, false, null],
				[c.id, false, null]
			].toSorted()
		);
		expect((await repo.listTraceKinds()).find((row) => row.id === kind.id)?.name).toBe('Масса');
	});

	it('restores memberships that left the local replica together with the deleted Scope', async () => {
		open();
		const { kind, a, deletion } = await scene();
		const membershipId = `${kind.id}:${a.id}:belongs_to`;
		// Active-only subscriptions no longer retain either deleted row. The server still has both.
		const absent = new Set([a.id, membershipId]);
		const client = asRepositoryClient(fixture.client);
		const replica: RepositoryClient = {
			...client,
			warm: async (rows) => {
				for (const row of rows) absent.delete(row.id);
			},
			transact: (callback) =>
				client.transact((transaction) =>
					callback({
						...transaction,
						fetch: async (collection) =>
							(await transaction.fetch(collection)).filter((row) => !absent.has(row.id)),
						fetchById: (collection, id) =>
							absent.has(id) ? Promise.resolve(null) : transaction.fetchById(collection, id)
					})
				)
		};
		const undone = await createUndoRepository(replica).undoOperation(deletion);
		expect((await repo.listScopes()).some((scope) => scope.id === a.id)).toBe(true);
		expect(await membershipsOf(kind.id)).toContainEqual([a.id, false, null]);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intersection:restored:undo',
			'scope:restored:undo'
		]);
	});

	it('does not return a hidden membership the user removed explicitly', async () => {
		open();
		const { kind, a, b, deletion } = await scene();
		// Explicit removal of the hidden membership itself: the deletion's provenance is gone.
		await repo.setIntersectionDeleted(`${kind.id}:${a.id}:belongs_to`, true);
		expect(await membershipsOf(kind.id)).toEqual(
			[
				[a.id, true, null],
				[b.id, false, null]
			].toSorted()
		);
		const undone = await repo.undoOperation(deletion);
		expect(await journalOf(repo, undone.operation.id)).toEqual(['scope:restored:undo']);
		expect((await repo.listScopes()).some((scope) => scope.id === a.id)).toBe(true);
		expect(await membershipsOf(kind.id)).toEqual(
			[
				[a.id, true, null],
				[b.id, false, null]
			].toSorted()
		);
	});

	it('cancels a pending return through explicit zero Scope and refuses once the Scope moved on', async () => {
		open();
		const { kind, a, b, deletion } = await scene();
		await repo.setTraceKindScopes(kind.id, []);
		expect(await membershipsOf(kind.id)).toEqual(
			[
				[a.id, true, null],
				[b.id, true, null]
			].toSorted()
		);
		await repo.undoOperation(deletion);
		expect((await repo.listScopes()).some((scope) => scope.id === a.id)).toBe(true);
		expect(await membershipsOf(kind.id)).toEqual(
			[
				[a.id, true, null],
				[b.id, true, null]
			].toSorted()
		);

		// Restored on its own and deleted again: the first deletion is no longer current.
		await repo.setScopeDeleted(a.id, true);
		const again = (await repo.listLogs(a.id))[0].operationId;
		await repo.setScopeDeleted(a.id, false);
		await repo.setScopeDeleted(a.id, true);
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(again))).toBe('undo_stale');
		expect(await outcome(repo.undoOperation(deletion))).toBe('undo_stale');
		expect(await snapshotOf(repo)).toEqual(before);
	});
});
