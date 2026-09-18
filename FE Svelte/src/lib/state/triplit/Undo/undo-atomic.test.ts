import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import {
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

describe('undoOperation — atomicity of a compound inverse', () => {
	it('leaves every collection and the journal unchanged when its final child refuses', async () => {
		open();
		const a = await repo.createScope({ name: 'A' });
		const intention = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const other = await repo.createTrace(plainDraft('Другая цель', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг', { relation: 'actual' }),
			memberships: { add: [a.id] },
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		// The incompatible evidence link goes first, as its own action (I3c relation guard).
		await repo.saveTraceRecord({
			id: fact.trace.id,
			fields: {},
			links: { remove: [fact.links[0].id] }
		});
		// One compound edit: the record becomes a plan, its membership goes, a new relation comes.
		const compound = await repo.saveTraceRecord({
			id: fact.trace.id,
			fields: { title: '80 кг (план)', relation: 'intend' },
			memberships: { remove: [a.id] },
			links: { add: [{ kind: 'related_to', traceId: other.id }] }
		});
		expect(compound.trace.relation).toBe('intend');
		expect(await journalOf(repo, compound.operation.id)).toEqual([
			'intersection:deleted:normal',
			'intersection:linked:normal',
			'trace:updated:normal'
		]);
		// Later, independent of that edit: the record gains its own evidence as an intention.
		const evidence = await repo.saveTraceRecord({
			fields: plainFields('90 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: fact.trace.id }] }
		});

		// Guards pass row by row and the membership and relation are compensated first, but the
		// inverse's last child (relation back to a fact) is blocked by that evidence: the earlier
		// compensations of this inverse must not survive on their own.
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(compound.operation.id))).toBe('relation_blocked');
		expect(await snapshotOf(repo)).toEqual(before);
		expect((await repo.listLogs()).filter((log) => log.cause === 'undo')).toEqual([]);

		// After the blocking evidence is withdrawn, the same inverse applies whole.
		await repo.setIntersectionDeleted(evidence.links[0].id, true);
		const undone = await repo.undoOperation(compound.operation.id);
		expect(await journalOf(repo, undone.operation.id)).toEqual([
			'intersection:deleted:undo',
			'intersection:restored:undo',
			'trace:updated:undo'
		]);
		expect((await repo.listTraces()).find((row) => row.id === fact.trace.id)).toMatchObject({
			content: '80 кг',
			relation: 'actual'
		});
		expect(
			(await repo.listIntersections())
				.filter((row) => row.fromId === fact.trace.id)
				.map((row) => [row.toId, row.kind])
		).toEqual([[a.id, 'belongs_to']]);
	});

	it('refuses an unavailable record without touching the rest', async () => {
		open();
		const a = await repo.createScope({ name: 'A' });
		const trace = await repo.saveTraceRecord({
			fields: plainFields('Прогулка'),
			memberships: { add: [a.id] }
		});
		const removal = await repo.saveTraceRecord({
			id: trace.trace.id,
			fields: { title: 'Пробежка' },
			memberships: { remove: [a.id] }
		});
		// A physically missing row (never synced here, or purged) is unavailable, not invented.
		await fixture.client.delete('intersections', `${trace.trace.id}:${a.id}:belongs_to`);
		const before = await snapshotOf(repo);
		expect(await outcome(repo.undoOperation(removal.operation.id))).toBe('undo_unavailable');
		expect(await snapshotOf(repo)).toEqual(before);
		expect((await repo.listTraces()).find((row) => row.id === trace.trace.id)?.content).toBe(
			'Пробежка'
		);
	});
});
