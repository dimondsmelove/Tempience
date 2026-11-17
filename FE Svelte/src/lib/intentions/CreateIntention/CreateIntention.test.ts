import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	openRecordFixture,
	plainDraft,
	snapshotOf,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import { createIntention } from './CreateIntention';

let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});
describe('createIntention', () => {
	it.each([
		[
			{ kind: 'day', dayKey: '2026-09-16' } as const,
			'instant',
			{ basis: 'absolute', precision: 'day', start: '2026-09-16', end: null }
		],
		[
			{ kind: 'week', weekStart: Date.parse('2026-09-13T22:00:00Z') } as const,
			'interval',
			{ basis: 'absolute', precision: 'day', start: '2026-09-14', end: '2026-09-20' }
		],
		[{ kind: 'undated' } as const, 'instant', { basis: 'unknown' }]
	])('creates a single intention for %s', async (target, aboutKind, aboutTime) => {
		fixture = openRecordFixture();
		const spy = vi.spyOn(fixture.repository, 'saveTraceRecord');
		const result = await createIntention(fixture.repository, {
			title: ' Task ',
			target,
			zone: 'Europe/Belgrade',
			now: Date.parse('2026-09-14T08:00:00Z')
		});
		expect(result.ok).toBe(true);
		expect(spy).toHaveBeenCalledTimes(1);
		expect((await fixture.repository.listTraces())[0]).toMatchObject({
			content: 'Task',
			relation: 'intend',
			capturedAt: '2026-09-14T08:00:00.000Z',
			timezone: 'Europe/Belgrade',
			aboutKind,
			aboutTime
		});
	});
	it('does not save an empty title', async () => {
		fixture = openRecordFixture();
		const spy = vi.spyOn(fixture.repository, 'saveTraceRecord');
		expect(
			await createIntention(fixture.repository, {
				title: '  ',
				target: { kind: 'undated' },
				zone: 'UTC',
				now: Date.now()
			})
		).toMatchObject({ ok: false, reason: 'empty' });
		expect(spy).not.toHaveBeenCalled();
	});
});

describe('creating a subtask', () => {
	it('copies memberships, creates part_of and defaults to undated; an explicit target also works', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const first = await repo.createScope({ name: 'First' });
		const second = await repo.createScope({ name: 'Second' });
		const parent = await repo.saveTraceRecord({
			fields: {
				title: 'Parent',
				relation: 'intend',
				capturedAt: new Date().toISOString(),
				timezone: 'UTC',
				aboutKind: 'instant',
				aboutTime: { basis: 'unknown' }
			},
			memberships: { add: [first.id, second.id] }
		});
		const result = await createIntention(repo, {
			title: 'Child',
			parentId: parent.trace.id,
			zone: 'UTC',
			now: Date.now()
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.reason);
		expect(result.trace.aboutTime).toEqual({ basis: 'unknown' });
		const links = (await repo.listIntersections()).filter(
			(item) => item.fromId === result.trace.id
		);
		expect(links.map((item) => [item.kind, item.toId]).sort()).toEqual(
			[
				['belongs_to', first.id],
				['belongs_to', second.id],
				['part_of', parent.trace.id]
			].sort()
		);
		const dated = await createIntention(repo, {
			title: 'Dated',
			parentId: parent.trace.id,
			target: { kind: 'day', dayKey: '2026-09-20' },
			zone: 'UTC',
			now: Date.now()
		});
		expect(dated.ok && dated.trace.aboutTime).toMatchObject({
			basis: 'absolute',
			start: '2026-09-20'
		});
	});
	it('refuses missing, closed and non-intention parents without writing', async () => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const parent = await repo.createTrace(plainDraft('Parent', 'intend'));
		const fact = await repo.createTrace(plainDraft('Fact'));
		await repo.createDirectAssessment(parent.id, { open: false });
		const before = await snapshotOf(repo);
		for (const [parentId, reason] of [
			['missing', 'parent_not_found'],
			[parent.id, 'parent_closed'],
			[fact.id, 'parent_not_intention']
		]) {
			expect(
				await createIntention(repo, { title: 'Child', parentId, zone: 'UTC', now: Date.now() })
			).toEqual({ ok: false, reason });
			expect(await snapshotOf(repo)).toEqual(before);
		}
	});
});

describe('explicit scope selection', () => {
	it.each([
		['explicit', false, false],
		['empty', false, true],
		['parent override', true, false],
		['parent empty', true, true]
	] as const)('%s', async (_label, withParent, empty) => {
		fixture = openRecordFixture();
		const repo = fixture.repository;
		const inherited = await repo.createScope({ name: 'Inherited' });
		const selected = await repo.createScope({ name: 'Selected' });
		const parent = await repo.saveTraceRecord({
			fields: {
				title: 'Parent',
				relation: 'intend',
				capturedAt: new Date().toISOString(),
				timezone: 'UTC',
				aboutKind: 'instant',
				aboutTime: { basis: 'unknown' }
			},
			memberships: { add: [inherited.id] }
		});
		const result = await createIntention(repo, {
			title: 'Child',
			target: { kind: 'undated' },
			parentId: withParent ? parent.trace.id : undefined,
			scopeIds: empty ? [] : [selected.id],
			zone: 'UTC',
			now: Date.now()
		});
		if (!result.ok) throw new Error(result.reason);
		const memberships = (await repo.listIntersections())
			.filter((link) => link.kind === 'belongs_to' && link.fromId === result.trace.id)
			.map((link) => link.toId);
		expect(memberships).toEqual(empty ? [] : [selected.id]);
	});
});
