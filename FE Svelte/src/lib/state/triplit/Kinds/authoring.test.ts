import { TriplitClient } from '@triplit/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import type { TraceKindVDraft } from '../types';

const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});
const NUMBER: TraceKindVDraft = {
	dataSchema: { type: 'object', properties: { value: { type: 'number' } } }
};
const setup = async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	const repo = createTriplitRepository(client);
	const a = await repo.createScope({ name: 'A' });
	const b = await repo.createScope({ name: 'B' });
	return { repo, a, b };
};
const membershipsOf = async (repo: TempienceRepository, kindId: string) =>
	(await repo.listIntersections())
		.filter((link) => link.fromId === kindId && link.kind === 'belongs_to')
		.map((link) => link.toId)
		.toSorted();
const operationsOf = async (repo: TempienceRepository) =>
	new Set((await repo.listLogs()).map((log) => log.operationId));

describe('Kind authoring commits the Kind and its memberships together', () => {
	it('creates the Kind, its first version and the chosen memberships in one operation', async () => {
		const { repo, a, b } = await setup();
		const before = await operationsOf(repo);
		const { kind, kindV } = await repo.createTraceKind({
			name: 'Замер',
			initialKindV: NUMBER,
			scopeIds: [a.id, b.id]
		});
		expect(kindV.kindId).toBe(kind.id);
		expect(await membershipsOf(repo, kind.id)).toEqual([a.id, b.id].toSorted());
		const operations = [...(await operationsOf(repo))].filter((id) => !before.has(id));
		expect(operations).toHaveLength(1);
		const logs = (await repo.listLogs()).filter((log) => log.operationId === operations[0]);
		expect(logs.map((log) => `${log.entityType}:${log.action}`).toSorted()).toEqual([
			'intersection:linked',
			'intersection:linked',
			'traceKind:created',
			'traceKindV:created'
		]);
	});

	it('creates nothing when a chosen Scope is unavailable', async () => {
		const { repo, a } = await setup();
		await repo.setScopeDeleted(a.id, true);
		const logs = await repo.listLogs();
		await expect(
			repo.createTraceKind({ name: 'Замер', initialKindV: NUMBER, scopeIds: [a.id] })
		).rejects.toThrow('Scope');
		expect(await repo.listTraceKinds()).toEqual([]);
		expect(await repo.listTraceKindVersions()).toEqual([]);
		expect(await repo.listLogs()).toEqual(logs);
	});

	it('publishes a new version with memberships atomically and leaves the old one on refusal', async () => {
		const { repo, a, b } = await setup();
		const { kind, kindV } = await repo.createTraceKind({
			name: 'Замер',
			initialKindV: NUMBER,
			scopeIds: [a.id]
		});
		const next = await repo.createTraceKindV(kind.id, {
			...NUMBER,
			parentKindVIds: [kindV.id],
			scopeIds: [b.id]
		});
		expect((await repo.listTraceKinds())[0].currentKindVId).toBe(next.id);
		expect(await membershipsOf(repo, kind.id)).toEqual([b.id]);
		const logs = await repo.listLogs();
		await repo.setScopeDeleted(a.id, true);
		await expect(
			repo.createTraceKindV(kind.id, { ...NUMBER, parentKindVIds: [next.id], scopeIds: [a.id] })
		).rejects.toThrow('Scope');
		expect((await repo.listTraceKinds())[0].currentKindVId).toBe(next.id);
		expect(await repo.listTraceKindVersions(kind.id)).toHaveLength(2);
		expect(await membershipsOf(repo, kind.id)).toEqual([b.id]);
		expect((await repo.listLogs()).length).toBe(logs.length + 1);
	});

	it('edits the name and the memberships in one operation, and still accepts a plain rename', async () => {
		const { repo, a } = await setup();
		const { kind } = await repo.createTraceKind({ name: 'Замер', initialKindV: NUMBER });
		const before = await operationsOf(repo);
		const renamed = await repo.editTraceKind(kind.id, { name: 'Вес', scopeIds: [a.id] });
		expect(renamed.name).toBe('Вес');
		expect(await membershipsOf(repo, kind.id)).toEqual([a.id]);
		expect([...(await operationsOf(repo))].filter((id) => !before.has(id))).toHaveLength(1);
		expect((await repo.editTraceKind(kind.id, 'Масса')).name).toBe('Масса');
		expect((await repo.editTraceKind(kind.id, { name: 'Масса' })).name).toBe('Масса');
		expect(await membershipsOf(repo, kind.id)).toEqual([a.id]);
	});

	it('a rename without a membership choice keeps a hidden membership restorable; an explicit «Без Scope» withdraws it', async () => {
		const { repo, a, b } = await setup();
		const first = await repo.createTraceKind({
			name: 'Первый',
			initialKindV: NUMBER,
			scopeIds: [a.id]
		});
		const second = await repo.createTraceKind({
			name: 'Второй',
			initialKindV: NUMBER,
			scopeIds: [a.id]
		});
		const third = await repo.createTraceKind({
			name: 'Третий',
			initialKindV: NUMBER,
			scopeIds: [a.id]
		});
		await repo.setScopeDeleted(a.id, true);
		expect(await membershipsOf(repo, first.kind.id)).toEqual([]);
		// Rename only: the untouched selection is not sent.
		await repo.editTraceKind(first.kind.id, { name: 'Первый переименован' });
		// Explicit «Без Scope» on an already empty selection: sent, and it cancels the restore.
		await repo.editTraceKind(second.kind.id, { name: 'Второй', scopeIds: [] });
		// Another membership changed: the hidden one stays restorable.
		await repo.editTraceKind(third.kind.id, { scopeIds: [b.id] });
		await repo.setScopeDeleted(a.id, false);
		expect(await membershipsOf(repo, first.kind.id)).toEqual([a.id]);
		expect(await membershipsOf(repo, second.kind.id)).toEqual([]);
		expect(await membershipsOf(repo, third.kind.id)).toEqual([a.id, b.id].toSorted());
	});
});
