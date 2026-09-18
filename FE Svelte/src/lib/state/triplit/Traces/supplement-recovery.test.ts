import { afterEach, describe, expect, it } from 'vitest';
import { intersectionIdFor } from '../Intersections/read';
import type { TempienceRepository } from '../repository';
import {
	openRecordFixture,
	outcome,
	plainDraft,
	revisitsOf,
	snapshotOf,
	supplementOf,
	type RecordFixture
} from './record.fixture';
import { supplementState } from './supplement';

let fixture: RecordFixture;
let repo: TempienceRepository;
afterEach(async () => {
	await fixture?.dispose();
});
const open = () => {
	fixture = openRecordFixture();
	repo = fixture.repository;
	return repo;
};

describe('supplement marker — lifecycle integrity and recovery', () => {
	it('refuses to withdraw the last link of an active supplement, deletes the supplement whole instead', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		const created = await supplementOf(repo, original);
		const link = created.links[0];
		expect(await outcome(repo.setIntersectionDeleted(link.id, true))).toBe('supplement_orphan');
		expect(
			await outcome(
				repo.saveTraceRecord({ id: created.trace.id, fields: {}, links: { remove: [link.id] } })
			)
		).toBe('supplement_orphan');
		expect(await revisitsOf(repo, created.trace.id)).toEqual([[original.id, false]]);
		const { trace: deleted } = await repo.setTraceDeleted(created.trace.id, true);
		expect(deleted.isDeleted).toBe(true);
		expect((await repo.listTraces()).map((row) => row.id)).toEqual([original.id]);
		// An inactive supplement is not governed; its link may go and come back before a restore.
		expect(await outcome(repo.setIntersectionDeleted(link.id, true))).toBe('accepted');
		expect(await outcome(repo.setTraceDeleted(created.trace.id, false))).toBe('supplement_orphan');
		expect(
			(await repo.listTraces(true)).find((row) => row.id === created.trace.id)?.isDeleted
		).toBe(true);
		expect(await outcome(repo.setIntersectionDeleted(link.id, false))).toBe('accepted');
		expect((await repo.setTraceDeleted(created.trace.id, false)).trace.isDeleted).toBe(false);
		expect(await revisitsOf(repo, created.trace.id)).toEqual([[original.id, false]]);
	});

	it('never cascades: a deleted original keeps its supplement editable and restorable', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		const created = await supplementOf(repo, original);
		await repo.setTraceDeleted(original.id, true);
		expect((await repo.listTraces()).map((row) => row.id)).toEqual([created.trace.id]);
		const edited = await repo.saveTraceRecord({
			id: created.trace.id,
			fields: { title: 'Уточнение (правка)', description: 'подробности' }
		});
		expect(edited.trace).toMatchObject({
			content: 'Уточнение (правка)',
			description: 'подробности',
			aboutKind: 'trace_ref'
		});
		await repo.setTraceDeleted(created.trace.id, true);
		expect((await repo.setTraceDeleted(created.trace.id, false)).trace.isDeleted).toBe(false);
		expect((await repo.listTraces(true)).find((row) => row.id === original.id)?.isDeleted).toBe(
			true
		);
	});

	it('diagnoses a stored self-original marker and repairs it only through the explicit path', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		// A corrupt row pair no command can create: the supplement revisits itself.
		const at = '2026-09-12T12:00:00.000Z';
		const selfId = 'trace:self-supplement';
		const selfLinkId = intersectionIdFor(selfId, selfId, 'revisits');
		await fixture.client.insert('traces', {
			id: selfId,
			capturedAt: at,
			timezone: 'UTC',
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: null,
			content: 'Само-дополнение',
			relation: 'actual',
			isDeleted: false,
			createdAt: at,
			updatedAt: at
		} as never);
		await fixture.client.insert('intersections', {
			id: selfLinkId,
			fromId: selfId,
			toId: selfId,
			kind: 'revisits',
			activationId: 'activation:self',
			lifecycleId: 'op:self',
			isDeleted: false,
			createdAt: at,
			updatedAt: at
		} as never);
		const links = (await repo.listIntersections()).filter((row) => row.fromId === selfId);
		expect(
			supplementState(selfId, 'actual', links, (id) => id === selfId || id === original.id)
		).toEqual({ status: 'self', originalId: selfId, linkIds: [selfLinkId] });
		// The corrupt pair never passes as valid: unrelated edits and a restore are refused whole.
		const before = await snapshotOf(repo);
		expect(await outcome(repo.editTrace(selfId, { content: 'Правка' }))).toBe('supplement_self');
		expect(await outcome(repo.saveTraceRecord({ id: selfId, fields: { title: 'Правка' } }))).toBe(
			'supplement_self'
		);
		expect(
			await outcome(
				repo.createIntersection({ fromId: selfId, toId: original.id, kind: 'revisits' })
			)
		).toBe('supplement_cardinality');
		expect(await outcome(repo.setIntersectionDeleted(selfLinkId, true))).toBe('supplement_orphan');
		expect(await snapshotOf(repo)).toEqual(before);
		await repo.setTraceDeleted(selfId, true);
		expect(await outcome(repo.setTraceDeleted(selfId, false))).toBe('supplement_self');
		// Explicit repair with existing operations: withdraw the pair, link the real original, restore.
		await repo.setIntersectionDeleted(selfLinkId, true);
		const relinked = await repo.createIntersection({
			fromId: selfId,
			toId: original.id,
			kind: 'revisits'
		});
		const { trace: restored } = await repo.setTraceDeleted(selfId, false);
		expect(restored).toMatchObject({ isDeleted: false, content: 'Само-дополнение', createdAt: at });
		expect(await revisitsOf(repo, selfId, true)).toEqual(
			expect.arrayContaining([
				[selfId, true],
				[original.id, false]
			])
		);
		expect(relinked.isDeleted).toBe(false);
		const edited = await repo.saveTraceRecord({ id: selfId, fields: { title: 'После починки' } });
		expect(edited.trace.content).toBe('После починки');
		// Nothing else was rewritten: the original keeps its row and dates, the journal only grew.
		expect((await repo.listTraces(true)).find((row) => row.id === original.id)).toEqual(original);
		const after = await snapshotOf(repo);
		expect(before.logs.every((log) => after.logs.some((row) => row.id === log.id))).toBe(true);
		expect(
			after.logs.filter((log) => ![selfId, selfLinkId, relinked.id].includes(log.entityId))
		).toEqual(
			before.logs.filter((log) => ![selfId, selfLinkId, relinked.id].includes(log.entityId))
		);
	});
});
