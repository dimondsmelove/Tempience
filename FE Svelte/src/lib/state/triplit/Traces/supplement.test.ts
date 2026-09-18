import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import { traceAboutTimeBounds } from '../trace-time';
import {
	dayTime,
	markerDraft,
	markerFields,
	openRecordFixture,
	outcome,
	plainDraft,
	revisitsOf,
	snapshotOf,
	supplementOf,
	type RecordFixture
} from './record.fixture';
import { isSupplementMarker } from './supplement';

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

describe('supplement marker', () => {
	it('creates a supplement of a dated or undated original in one save, off the axis', async () => {
		open();
		const dated = await repo.createTrace(plainDraft('Оригинал'));
		const undated = await repo.createTrace(plainDraft('Без даты', 'actual', { basis: 'unknown' }));
		for (const original of [dated, undated]) {
			const result = await supplementOf(repo, original);
			expect(result.trace).toMatchObject({
				aboutKind: 'trace_ref',
				aboutTime: null,
				aboutTraceId: null,
				relation: 'actual',
				content: 'Уточнение'
			});
			expect(isSupplementMarker(result.trace)).toBe(true);
			expect(result.links.map((link) => [link.fromId, link.toId, link.kind])).toEqual([
				[result.trace.id, original.id, 'revisits']
			]);
			expect(traceAboutTimeBounds(result.trace.aboutKind, result.trace.aboutTime)).toBeNull();
			expect(result.trace.createdAt).toBe(result.operation.timestamp);
		}
		expect((await repo.listTraces()).find((row) => row.id === dated.id)).toEqual(dated);
	});

	it('refuses an orphan marker on every create path without writing', async () => {
		open();
		const scope = await repo.createScope({ name: 'A' });
		const before = await snapshotOf(repo);
		expect(await outcome(repo.createTrace(markerDraft()))).toBe('supplement_orphan');
		expect(await outcome(repo.createTraceWithScope(markerDraft(), scope.id))).toBe(
			'supplement_orphan'
		);
		expect(await outcome(repo.createTraceWithScopes(markerDraft(), [scope.id]))).toBe(
			'supplement_orphan'
		);
		expect(await outcome(repo.saveTraceRecord({ fields: markerFields() }))).toBe(
			'supplement_orphan'
		);
		expect(
			await outcome(
				repo.saveTraceRecord({
					fields: markerFields(),
					links: { add: [{ kind: 'revisits', originalId: 'trace:missing' }] }
				})
			)
		).toMatch(/not found/);
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('keeps exactly one original: a second revisits is refused on the save and on generic links', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		const other = await repo.createTrace(plainDraft('Другая запись'));
		const supplement = (await supplementOf(repo, original)).trace;
		expect(
			await outcome(
				repo.saveTraceRecord({
					fields: markerFields(),
					links: {
						add: [
							{ kind: 'revisits', originalId: original.id },
							{ kind: 'revisits', originalId: other.id }
						]
					}
				})
			)
		).toBe('supplement_cardinality');
		expect(
			await outcome(
				repo.saveTraceRecord({
					id: supplement.id,
					fields: {},
					links: { add: [{ kind: 'revisits', originalId: other.id }] }
				})
			)
		).toBe('supplement_cardinality');
		expect(
			await outcome(
				repo.createIntersection({ fromId: supplement.id, toId: other.id, kind: 'revisits' })
			)
		).toBe('supplement_cardinality');
		expect(await outcome(repo.linkTraceToTrace(supplement.id, other.id, 'revisits'))).toBe(
			'supplement_cardinality'
		);
		// The same original again is the existing link, and other relations stay open.
		expect(
			await outcome(
				repo.createIntersection({ fromId: supplement.id, toId: original.id, kind: 'revisits' })
			)
		).toBe('accepted');
		expect(
			await outcome(
				repo.createIntersection({ fromId: supplement.id, toId: other.id, kind: 'related_to' })
			)
		).toBe('accepted');
		expect(await revisitsOf(repo, supplement.id)).toEqual([[original.id, false]]);
	});

	it('keeps the marker a reference: no own date, no inline address, same shape is a no-op', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		const supplement = (await supplementOf(repo, original)).trace;
		expect(
			await outcome(
				repo.editTrace(supplement.id, { aboutKind: 'instant', aboutTime: dayTime('2026-09-12') })
			)
		).toBe('supplement_placement');
		expect(await outcome(repo.editTrace(supplement.id, { aboutTraceId: original.id }))).toBe(
			'supplement_placement'
		);
		expect(
			await outcome(
				repo.saveTraceRecord({
					id: supplement.id,
					fields: { aboutKind: 'instant', aboutTime: { basis: 'unknown' } }
				})
			)
		).toBe('supplement_placement');
		const resubmitted = await repo.saveTraceRecord({
			id: supplement.id,
			fields: { aboutKind: 'trace_ref', aboutTime: null, aboutTraceId: null }
		});
		expect(resubmitted.trace).toEqual(supplement);
		// A dated record does not become a marker through a plain edit either: the encoded
		// rewrite of its time is judged after decoding, and nothing of the attempt is kept.
		const dated = await repo.createTrace(plainDraft('Запись'));
		const before = await snapshotOf(repo);
		expect(
			await outcome(
				repo.editTrace(dated.id, { aboutKind: 'trace_ref', aboutTime: null, aboutTraceId: null })
			)
		).toBe('supplement_orphan');
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('is a completed record: an intention marker is refused on create and on edit', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		const before = await snapshotOf(repo);
		expect(
			await outcome(
				repo.saveTraceRecord({
					fields: { ...markerFields(), relation: 'intend' },
					links: { add: [{ kind: 'revisits', originalId: original.id }] }
				})
			)
		).toBe('supplement_relation');
		expect(await snapshotOf(repo)).toEqual(before);
		const supplement = (await supplementOf(repo, original)).trace;
		expect(await outcome(repo.editTrace(supplement.id, { relation: 'intend' }))).toBe(
			'supplement_relation'
		);
		expect(
			await outcome(repo.saveTraceRecord({ id: supplement.id, fields: { relation: 'intend' } }))
		).toBe('supplement_relation');
		expect((await repo.listTraces()).find((row) => row.id === supplement.id)?.relation).toBe(
			'actual'
		);
	});

	it('leaves legacy inline references and generic revisits of ordinary records untouched', async () => {
		open();
		const original = await repo.createTrace(plainDraft('Оригинал'));
		const other = await repo.createTrace(plainDraft('Ещё оригинал'));
		const inline = await repo.createTrace({
			...markerDraft('Старое дополнение'),
			aboutTraceId: original.id
		});
		expect(inline.aboutTraceId).toBe(original.id);
		expect(isSupplementMarker(inline)).toBe(false);
		expect(await revisitsOf(repo, inline.id)).toEqual([]);
		const relinked = await repo.editTrace(inline.id, { aboutTraceId: other.id });
		expect(relinked.aboutTraceId).toBe(other.id);
		const note = await repo.createTrace(plainDraft('Обычная запись'));
		const first = await repo.createIntersection({
			fromId: note.id,
			toId: original.id,
			kind: 'revisits'
		});
		const second = await repo.createIntersection({
			fromId: note.id,
			toId: other.id,
			kind: 'revisits'
		});
		expect(await revisitsOf(repo, note.id)).toEqual(
			expect.arrayContaining([
				[original.id, false],
				[other.id, false]
			])
		);
		await repo.setIntersectionDeleted(first.id, true);
		await repo.setIntersectionDeleted(second.id, true);
		expect(await revisitsOf(repo, note.id)).toEqual([]);
	});
});
